# Arena Race — Technical Design Document (Engineering Spec)

**Document type:** Engineering specification for MVP implementation  
**Source:** Locked Production Validation + Architecture Spec  
**Scope:** Backend, contracts, match engine, data, APIs, deployment. No product redesign.  
**Version:** 1.1 (precision hardening).

---

## 1. System Overview

### 1.1 Components

| Component | Role |
|-----------|------|
| **Web client** | Next.js (or equivalent). Renders UI; submits actions; displays match state. Untrusted. |
| **Authoritative game server** | Single backend service. Owns match state, turn resolution, scoring, queue. All gameplay authority. |
| **Smart contract** | Escrow + payout only. Accepts USDC entry, deducts 8% fee, stores match escrow, accepts signed result, distributes 38/30/20/12. No game logic. |
| **Database** | Postgres. Persistent storage: users, matches, turns, stats, queue metadata, flags, tokens, payouts, disputes. |
| **Redis** | Queue state (active queue entries, match formation), session cache, rate-limit state. |
| **Blockchain RPC provider** | Read/write for contract calls (entry, result submission, payouts). Retry and failover required. |
| **Multisig wallet** | Pause/resume contract only. No fund movement from multisig. |

### 1.2 Trust Boundaries

- **Client:** Untrusted. No client-calculated scores accepted. Client sends only: queue join/leave, match actions (move/ability), entry confirmation. Server validates and resolves.
- **Server:** Authoritative for gameplay. Computes state, placement, scores. Produces signed match result for contract.
- **Contract:** Authoritative for money. Validates signed result; distributes from escrow per 38/30/20/12; no override by server for amounts.
- **Database/Redis:** Trusted by server only; not exposed to client.

---

## 2. High-Level Architecture Diagram (Textual)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Untrusted)                              │
│  Next.js — Queue UI, Match UI, Wallet Connect, Action Submit, Leaderboard   │
└───────────────────────────────────────────┬─────────────────────────────────┘
                                            │ HTTPS / WSS
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTHORITATIVE GAME SERVER                            │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │ Queue       │ │ Match       │ │ Scoring    │ │ Bronze Cushion /        │ │
│  │ Matchmaking │ │ Engine      │ │ Engine     │ │ Anti-Collusion Flags    │ │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └───────────┬─────────────┘ │
│         │               │               │                     │              │
│         └───────────────┴───────────────┴─────────────────────┘              │
│                                     │                                         │
│                    ┌────────────────┼────────────────┐                        │
│                    ▼                ▼                ▼                        │
│              ┌──────────┐    ┌──────────────┐  ┌─────────────┐                 │
│              │ Postgres │    │ Redis        │  │ Signing     │                 │
│              │ (persist)│    │ (queue/cache)│  │ (result)    │                 │
│              └──────────┘    └──────────────┘  └──────┬──────┘                 │
└───────────────────────────────────────────────────────┼───────────────────────┘
                                                        │ submitResult(matchId, sig)
                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BLOCKCHAIN (RPC Provider)                             │
│  Escrow: submitEntry(), submitResult(), refundMatch(), setResultSigner() [multisig], pause() [multisig] │
│  USDC transfers in/out; fee → treasury                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Data flow (match):** Client joins queue (Redis) → Server forms match (4 players) → Entries confirmed on-chain → Server runs turn loop (6 s/turn, 5 min max) → Server resolves state deterministically → Server computes final placement → Server signs result → Server calls contract submitResult → Contract distributes 92% pool 38/30/20/12.

---

## 3. Smart Contract Architecture

### 3.1 Contract Responsibilities

- Accept entry (USDC) per player for a match.
- Deduct 8% fee (platform); send fee to treasury address.
- Store match escrow (92% of total entry = prize pool).
- Accept signed match result from server (authorized signer key).
- Distribute pool: 1st 38%, 2nd 30%, 3rd 20%, 4th 12%.
- Handle tie: split payout for tied places (e.g. 2-way tie for 2nd/3rd → (Payout_2nd + Payout_3rd) / 2 each).
- Emergency pause (multisig only); no new entries; in-progress matches complete and can be paid out.
- No upgradeable fund logic (immutable or explicitly non-upgradeable for fund flows).

### 3.2 No Game Logic in Contract

- No scoring, no placement calculation, no turn data. Contract only: match id, 4 wallet addresses, entry amount, fee, and signed result (placement order or payout amounts per wallet). Game scoring is entirely off-chain.

### 3.3 Match Struct (Contract)

- `matchId` (bytes32 or uint256)
- `entryAmountPerPlayer` (uint256, USDC units)
- `totalEntry` (4 * entryAmountPerPlayer)
- `feeAmount` (8% of totalEntry)
- `poolAmount` (totalEntry - feeAmount)
- `playerWallets` [4] (address)
- `entriesReceived` (uint8, 0–4)
- `status`: PendingEntries | Escrowed | Expired | Refunded | Resolved
- `resultSubmittedAt` (timestamp, 0 until resolved)
- `entryDeadline` (timestamp: match creation + entry window)

### 3.4 Match Entry States (Explicit)

| Status | Meaning | Allowed transitions |
|--------|---------|---------------------|
| **PendingEntries** | 0–3 entries received; entry window open | → Escrowed (4th entry), → Expired (timeout), → Refunded (manual refund of partial) |
| **Escrowed** | 4 entries received; fee deducted; pool locked | → Resolved (submitResult) |
| **Expired** | Entry window elapsed without 4 entries | → Refunded (refund all received) |
| **Refunded** | All received entries returned to payers | Terminal. No further state change. |
| **Resolved** | Result submitted; payouts sent | Terminal. |

**Idempotency:** Expired match cannot transition to Escrowed. Refunded match cannot be resolved. Resolved match cannot be refunded.

### 3.5 Entry Mapping and Entry Window

- `matchId → Match` struct.
- **Entry window:** 5 minutes from match creation (`entryDeadline = createdAt + 300`).
- **Per-player entry:** Contract exposes `submitEntry(matchId, amount)` (or equivalent). On each call: require `status == PendingEntries`, `block.timestamp <= entryDeadline`, amount == entryAmountPerPlayer, sender not already entered; accept USDC; increment `entriesReceived`; record sender in `playerWallets` at next index.
- **Fourth entry:** When `entriesReceived` becomes 4: deduct 8% fee (to treasury), set pool = 92% of totalEntry, set `status = Escrowed`. No fee is taken until 4 entries received.
- **Timeout:** If `block.timestamp > entryDeadline` and `entriesReceived < 4`: set `status = Expired`. Match cannot later become Escrowed.

### 3.6 Fee Routing

- Sum of 4 entries = totalEntry. Fee = totalEntry * 8 / 100. Transfer fee to `treasuryWallet` only when 4th entry is received (same transaction as setting Escrowed). Pool = totalEntry - fee. No fee retained on Expired or Refunded matches.

### 3.7 Refund Mechanism (Partial or Expired)

- **Expired (0–3 entries):** All received entries must be refunded 100% to each payer. No fee retained.
- **Implementation:** Either (A) automatic: contract allows each payer to call `claimRefund(matchId)` when status == Expired or Refunded and sender had entered; or (B) server-triggered: `refundMatch(matchId)` callable by authorized signer (same privilege as result signer or multisig), which transfers back to each of the `entriesReceived` payers their full entry amount, then sets status = Refunded.
- **Refund amount:** 100% of that payer’s entry. Match must not transition to Escrowed unless exactly 4 entries confirmed on-chain.
- **MatchId invalidation:** After Expired → Refunded, matchId is not reused; server must not start gameplay for this matchId.

### 3.8 Result Submission Function

- `submitResult(matchId, placementOrPayouts, signature)`.
- **placementOrPayouts:** Either [4] wallet order (1st..4th) or [4] payout amounts. If amounts: require sum(payouts) == poolAmount (92% pool).
- **Validation:** Signature from authorized `resultSigner` (server-held key) over matchId + placement + nonce. Contract verifies signature; then distributes USDC to the 4 wallets per 38/30/20/12 (or per provided amounts if sum == pool).
- **Tie:** If contract receives placement with ties, contract computes split: e.g. two players for places 2–3 → each gets (30+20)/2 = 25% of pool.
- **Idempotency:** Require status == Escrowed; set status = Resolved and store resultSubmittedAt; prevent double-submit. Revert if status is PendingEntries, Expired, or Refunded.

### 3.9 Payout Sum Validation

- On submit: require `sum(payouts[0..3]) == poolAmount` (exactly 92% of total entry). Revert otherwise.

### 3.10 Reentrancy Protection

- Use reentrancy guard (e.g. OpenZeppelin) on entry, refund, and submitResult; external USDC transfers after state updates (checks-effects-interactions).

### 3.11 Result Signer Storage and Rotation

- **Signer storage:** Contract stores `resultSigner` (address). Used to verify match result signatures on `submitResult`. Only this address’s signatures are accepted.
- **Rotation function:** `setResultSigner(address newSigner)`.
  - Callable only by multisig (same as pause).
  - Require `newSigner != address(0)`.
  - Set `resultSigner = newSigner`; emit `SignerUpdated(oldSigner, newSigner)`.
- **Signature validity:** Signatures are valid only for the signer that was active at the time the match was **created** (or at the time the result was signed, per implementation choice). Define clearly: e.g. “Contract accepts signature if it verifies against current `resultSigner`.” For rotation safety: matches created and escrowed under signer A must be submitted (if at all) with a signature from A; after rotation to B, only new matches use B. Recommended: contract stores `resultSigner` only; server signs with current key. So matches created under old signer must be submitted before rotation, or contract may store `signerAtCreation` per match and accept either that signer or current signer for submitResult (document one rule).

**Recommended rule:** Contract validates signature against **current** `resultSigner`. Therefore: complete and submit all results for matches created under signer A before calling `setResultSigner(B)`. Old signatures (from A) remain valid only for matches already Escrowed before rotation; any match not yet submitted must be submitted with a new signature from B (server must use new key for new signatures). Document in runbook: “Before rotating signer, ensure no Escrowed match is still pending result; or re-sign with new key if server supports it.”

### 3.12 Signer Security Constraints

- Signer private key stored in HSM or secret manager (e.g. AWS Secrets Manager, Vault). Not in application code or env files in plaintext.
- Rotation procedure documented in ops runbook: generate new key, deploy new signer address, multisig calls setResultSigner, verify with test match, then rotate server to use new key.
- Old signatures: as per §3.11 (matches escrowed under old signer must be submitted with that signer’s signature before rotation, or contract accepts current signer only and all pending matches must be re-signed with new key).

### 3.13 Multisig Pause

- `pause()` and `unpause()` callable only by multisig (e.g. 2-of-3). When paused: reject new entries and new match creation; allow `submitResult` and `refundMatch` for existing matches so payouts and refunds can complete.

---

## 4. Match Engine Architecture

### 4.1 Match Lifecycle

1. **Queue** — Players in Redis queue (Bronze-10 or Bronze-25).
2. **Match Created** — Server groups 4 players; creates match record; generates matchId; **entry window starts** (5 min).
3. **Entry / Escrow** — Clients submit USDC to contract. When 4th entry received on-chain: fee deducted; escrow stored; status = Escrowed. If entry window (5 min) elapses with &lt;4 entries: match status → Expired; all received entries refunded; no fee; matchId invalidated for gameplay.
4. **Draft** — Phase 1a: no draft; fixed ability set (Boost, Block, Trap). Draft deferred to Phase 2.
5. **Turn Loop** — Every 6 s: collect actions (or default no-op); resolve turn deterministically; update state; broadcast state; update scores.
6. **Finalize** — At 5-minute timeout or all objectives resolved: compute final placement; build result payload; sign.
7. **Result Signed** — Server holds signed result; call contract submitResult.
8. **Contract Submit** — Contract distributes 38/30/20/12 (or tie-split); match closed.

### 4.2 Timers

- **Match hard timeout:** 5 minutes (300 s). At expiry, match ends; no further turns.
- **Entry window:** 5 minutes from match creation. If 4 entries not confirmed on-chain within this window, match → Expired; refund all; no gameplay.
- **Turn timer:** 6 s per turn, enforced server-side (§4.3). If a player does not submit in time, server applies default action (no move, no ability). All player inputs stored per turn for replay.

### 4.3 Turn Timing Boundary (Explicit)

- **Turn window:** For each turn, `turnStartTime` = server wall-clock at turn begin; `turnDeadline = turnStartTime + 6000` ms.
- **Action acceptance:** Server accepts a player’s action only if `receivedAt <= turnDeadline`. Late actions are ignored. No grace period.
- **Default action:** If no valid action submitted before turnDeadline: no movement, no ability, no energy consumption; that player’s tokens remain in place. Must be deterministic (same as stored “no-op” action).
- **Replay consistency:** Turn timing does not influence scoring. Replay uses only stored actions (and state_before); timestamps are not inputs to resolveTurn. Stored actions are the single source of truth for replay.

### 4.4 Resolution Order (Deterministic)

- **Fixed player order:** By join order (player index 0..3 as assigned at match creation) or by deterministic hash of wallet addresses (e.g. sort by address). Document one chosen rule and never change for same match.
- **Per turn:**
  1. Movement applied (in fixed player order).
  2. Trap resolution (tiles, damage/effects).
  3. Zone calculation (§6.1): contested-only; award 2 pts per contested zone per player with ≥1 token in zone.
  4. Overtake detection (§5.5): row-major tile index; count overtakes; cap 8 per player per match.
  5. Survival evaluation (§6.1): danger = trap or tile with ≥2 tokens; safe tokens × 0.5; cap 75 per match.
  6. Score update (position + zone + survival + overtake for this turn).
- **End of match:** Final placement = rank by total score (descending). Tie-break: §6.

### 4.5 Single Authoritative Instance

- One server process (or one leader per match) owns the match. No split-brain; no client authority.

---

## 5. Deterministic Turn Resolution Design

### 5.1 Pure Function

- `newState = resolveTurn(previousState, playerActions[])`
- **Inputs:** previousState (board, token positions, scores, zone state, overtake counts, etc.), playerActions[4] (each player’s move + ability for the turn).
- **Output:** newState (updated board, positions, scores, events).
- No randomness. No timestamp-based ordering. Same (previousState, playerActions[]) → same newState always.

### 5.2 Deterministic Tie-Break (In-Game)

- Order of resolution: fixed player index order (e.g. 0, 1, 2, 3).
- Tie-break for **placement** (who is 1st–4th): (1) Higher total score; (2) higher (overtake_points + zone_points); (3) higher overtake count; (4) if still tied: **payout split** (no random winner). E.g. tie for 2nd/3rd → both get (30% + 20%)/2 = 25% of pool.

### 5.3 Unit Test Requirement

- Same input (previousState, playerActions[]) must produce same output across 1,000+ runs (e.g. 1,000 simulations).
- Replay: given full action log, replay must produce identical final score and placement.

### 5.4 No Client-Side Resolution

- Client never computes authoritative score or placement. Server is sole source of truth.

### 5.5 Overtake Algorithm (Explicit)

- **Tile index (Board A, 7×7):** `tileIndex = row * 7 + column`. Row and column 0-based. Lower index = earlier in track order (row-major).
- **Overtake condition:** For two tokens A and B (distinct players), an overtake occurs in a turn iff:
  - `previousIndex_A < previousIndex_B` and `newIndex_A > newIndex_B`.
  - Count at most one overtake per (A, B) pair per turn. Per player: count overtakes where that player’s token is the one that passed (newIndex &gt; other’s newIndex where previously own was behind).
- **Cap:** Maximum 8 overtakes per player per match. After 8, further overtakes for that player add 0 points.
- **Determinism:** Evaluation order = fixed player index order (e.g. player 0’s tokens, then 1, then 2, then 3). No double counting (each pair considered once). No randomness.

---

## 6. Scoring Engine Implementation

### 6.1 Calculation Modules

- **Position:** Per turn, per token: `0.13 * (6 - row_index)` for row 0..6. Sum over player’s 3 tokens, then over all turns. `Position_points = Σ_turns Σ_my_tokens [ 0.13 × (6 - row(tile)) ]`.
- **Zone (contested-only, MVP):**
  - **Contested rule:** A zone is contested iff at least 2 distinct players have ≥1 token in that zone at end of turn.
  - **Award rule:** If contested, each player with ≥1 token in that zone receives **2 zone points** for that turn. Awarded once per zone per turn per player (not per token). So a player with multiple tokens in the same zone still gets 2 pts for that zone that turn.
  - **No diminishing in MVP:** No multiplier, no stacking, no carry-over. Flat 2 pts per contested zone per player present.
- **Overtake:** Per §5.5. `Overtake_points = 4 * N_overtakes`. Cap 8 overtakes per player per match (max 32 points).
- **Survival:**
  - **Per turn:** `safeTokens = count of player tokens that are NOT on a trap tile AND NOT on a tile with ≥2 tokens`. `turnSurvival = 0.5 * safeTokens`. Sum over turns → raw total.
  - **Match cap:** After summing over all turns, `SurvivalPoints = min(totalSurvival, 75)`. Cap enforced before final score calculation and before ranking. No cap per turn; only the match total is capped at 75.

### 6.2 Score Object Structure

- Per player: `{ positionPoints, zonePoints, overtakePoints, survivalPoints, total }`. Running totals updated each turn. Before final ranking: apply `survivalPoints = min(survivalPoints, 75)`; then `total = position + zone + overtake + survivalPoints`.

### 6.3 Final Ranking Sort

- Sort players by total (desc). Apply tie-break: (overtake+zone) desc, then overtake count desc. Assign placement 1..4. For payout: if tie on placement, split payout for those places (e.g. two players for 2nd/3rd → (30+20)/2 each).

### 6.4 Tie Handling (Split Payout)

- Implement in server: compute payout amounts per wallet so that tied players receive equal share of the combined place payouts. Contract receives either placement (and computes split) or exact amounts; if amounts, sum must equal pool.

---

## 7. Queue & Matchmaking System

### 7.1 Phase 1a Queues

- **2 queues only:** Bronze-10, Bronze-25 (entry in USDC).
- No Silver until 7-day rolling DAU ≥ 1,000 (Phase 1b).

### 7.2 Redis Queue Structure

- Keys e.g. `queue:bronze:10`, `queue:bronze:25`. Each entry: `{ playerId, wallet, joinedAt, tier }`. List or sorted set by joinedAt.
- Match formation: when 4 players in same queue, pop 4, create match, assign matchId, move to “match pending entry” state.

### 7.3 Match Creation Trigger

- 4 players in same queue → create match. No skill-based matching in MVP; random grouping from queue order (FIFO or random draw from waiting set).

### 7.4 Merge Prompt (180 s)

- After 180 s in queue: if in Bronze-25 (Standard), prompt: “Join Casual queue for faster match? Stakes and prizes will be 10 USDC.” If user accepts, remove from Bronze-25, add to Bronze-10. No mixing 10 and 25 in same match.

### 7.5 Timeout (240 s)

- At 240 s: present “Start practice match (no entry, no ELO)” or “Join lower tier for faster match” (Standard→Casual). No bot backfill for paid matches.

### 7.6 Fairness

- Random match grouping from queue; no ELO/skill match in MVP.

### 7.7 Queue & Entry Flow (Server-Side)

- **Match creation:** On 4 players popped from queue, server creates match record with `match_id`, `status = pending_entries`, `entry_deadline = now + 300` (5 min). Server does not start turn loop until contract status is Escrowed.
- **Entry window (5 min):** Server and/or client poll or listen for on-chain entries. If 4 entries confirmed on-chain before entry_deadline → server sets match status to in_progress and starts turn loop. If entry_deadline passes with &lt;4 entries on-chain: server sets match status to expired; server calls or triggers contract refund path (refundMatch or players claimRefund); matchId is not used for gameplay; no fee retained.
- **Idempotency:** Server must not transition a match to in_progress if contract status is not Escrowed. Server must not submit result for match_id in Expired or Refunded state. Expired match cannot later become Escrowed; refunded match cannot be resolved.

---

## 8. Bronze Retention Cushion Logic

### 8.1 Server-Side Tracking

- Per user (Bronze): track **consecutive 4th-place** count in paid Bronze matches.
- If **3 consecutive 4th** → issue one **BronzeFreeEntryToken**.

### 8.2 Token Model

- **Non-transferable:** DB flag only; not an on-chain asset.
- **Expires:** 7 days from grant. After 7 days, token invalid.
- **Consumption:** Auto-consumed on next Bronze-10 entry (one free entry; no USDC from that player). **Recommended:** Contract always receives 4 × 10 USDC and distributes 38/30/20/12 of 92% of that; when a player uses a free token, platform (treasury) sends the 4th 10 USDC so contract logic is unchanged. No “free slot” path in contract.
- **Cannot stack:** Max 1 active token per account. New grant only when current token absent or expired.
- **Cannot convert to USDC:** Token is entry-only for one Bronze-10 match.

### 8.3 Scope

- Phase 1a only (Bronze). Does not affect contract payout math (pool and 38/30/20/12); only who pays the entry for one player.

### 8.4 Data

- Table (e.g. `bronze_tokens`): user_id, granted_at, expires_at, consumed_at, match_id (when consumed). Consecutive 4th count in `player_match_stats` or dedicated field; reset when placement ≠ 4.

---

## 9. Anti-Collusion Flag System (MVP Scope)

### 9.1 Co-Occurrence Detection

- **Data:** Rolling last **200 matches** per player. For each pair (A, B), count `N_together` = matches where both A and B participated.
- **Trigger:** `N_together ≥ 15` **and** in those matches `avg(min(place_A, place_B)) ≤ 2.2`.
- **Action:** Add both accounts to **review queue**. No automatic restriction in MVP.

### 9.2 Win-Rate Flag

- **Minimum sample:** Evaluate only after **≥ 20** ranked (paid) matches.
- **Condition:** Over rolling **50** paid matches, 1st-place rate **≥ 80%**.
- **Action:** Add account to review queue. No auto-restrict in MVP.

### 9.3 On Trigger

- Insert into `review_flags` (or equivalent); link to account; reason (co-occurrence / win-rate). Ops use queue for manual review. No automatic stake cap or ban in MVP.

### 9.4 Data Tables for Match History

- **matches:** match_id, tier, ended_at, result (placement per player).
- **player_match_stats** (or match_participants): match_id, user_id, wallet, place, score, entry_used (paid/free).
- **Co-occurrence:** Query from match history: for each pair, count shared matches and compute avg(min(place_A, place_B)) over last 200 per player.
- **Win-rate:** Per user, last 50 paid matches; count 1st place; flag if count ≥ 40.

---

## 10. API Surface (Backend ↔ Client)

### 10.1 Endpoints

| Method | Path | Purpose |
|--------|------|--------|
| POST | /queue/join | Join queue (body: tier e.g. bronze-10, bronze-25). Require auth. |
| POST | /queue/leave | Leave queue. |
| GET | /match/state | Get current match state (board, scores, turn, time remaining). Require match participation. |
| POST | /match/action | Submit move + ability for current turn. Require match participation; reject if turn closed. |
| POST | /match/finalize | Server-only or internal; client does not finalize. (If exposed for ops: restricted.) |
| GET | /player/stats | Own stats (ELO, placement history, net USDC, etc.). |
| GET | /player/tokens | Bronze free-entry token status (if any): granted_at, expires_at, consumed. |
| POST | /entry/confirm | Confirm entry (after wallet approval); server verifies on-chain entry then allows match start. |
| GET | /leaderboard | Leaderboard (e.g. by ELO or net wins); scope and filters per product. |

### 10.2 Authentication

- **Wallet signature:** Client signs a nonce (or message); server verifies signature and binds session to wallet.
- **Session token:** Issued after wallet auth; used for subsequent requests (Bearer or cookie). Short-lived; refresh as needed.
- **Rate limits:** Per wallet / per IP: e.g. queue join 10/min; match action 20/min per match; leaderboard 60/min.

### 10.3 Idempotency

- POST /match/action: idempotency key (e.g. matchId + turnIndex + clientId) so duplicate submits do not apply twice.

---

## 11. Data Models (Database Schemas)

### 11.1 users

- `id` (PK), `wallet` (unique), `created_at`, `updated_at`, `age_confirmed_at`, `entry_confirmation_at`, `geo_blocked` (bool), optional KYC/restriction fields.

### 11.2 matches

- `id` (PK), `match_id` (unique, contract-facing), `tier` (e.g. bronze-10), `status` (pending_entries, escrowed, expired, refunded, in_progress, finalized, result_submitted). pending_entries/expired/refunded align with contract; escrowed = 4 entries on-chain; in_progress = turn loop running; finalized = match ended; result_submitted = contract paid out. `entry_deadline` (timestamp), `board_variant` (A for MVP), `started_at`, `ended_at`, `final_placement` (JSON or 4 rows), `result_signature`, `contract_tx_hash`, `created_at`. Index (match_id), (status).

### 11.3 match_turns

- `id` (PK), `match_id` (FK), `turn_index` (0..N), `state_before` (JSON/snapshot), `actions` (JSON array [4]), `state_after` (JSON), `scores_after` (JSON), `created_at`. Index (match_id, turn_index).

### 11.4 player_match_stats

- `id` (PK), `match_id` (FK), `user_id` (FK), `wallet`, `placement` (1–4), `total_score`, `position_pts`, `zone_pts`, `overtake_pts`, `survival_pts`, `entry_type` (paid, free_token), `created_at`. Index (user_id), (match_id).

### 11.5 queue_entries

- `id` (PK), `user_id` (FK), `tier`, `joined_at`, `match_id` (nullable, set when matched). Index (tier, joined_at). Redis can be source of truth for active queue; Postgres for audit.

### 11.6 review_flags

- `id` (PK), `user_id` (FK), `reason` (co_occurrence, win_rate), `payload` (JSON: e.g. pair wallet, N_together, avg_place; or win_rate, sample size), `status` (open, cleared, restricted), `created_at`, `reviewed_at`. Index (status), (user_id).

### 11.7 bronze_tokens

- `id` (PK), `user_id` (FK), `granted_at`, `expires_at`, `consumed_at`, `match_id` (nullable). Unique constraint: one active (consumed_at IS NULL, expires_at > now) per user.

### 11.8 payouts

- `id` (PK), `match_id` (FK), `wallet`, `placement`, `amount`, `currency`, `tx_hash`, `status` (pending, sent, failed), `created_at`, `updated_at`. Index (wallet), (match_id).

### 11.9 dispute_cases

- `id` (PK), `match_id` (FK), `reporter_user_id` (FK), `status` (open, replayed, upheld, rejected), `replay_result` (JSON), `resolution` (refund, corrected_payout, no_change), `created_at`, `resolved_at`. Index (match_id), (status).

### 11.10 Indexing Strategy

- Match lookup: match_id, status. User history: user_id on player_match_stats, payouts. Queue: tier + joined_at. Flags: status, user_id. Consecutive 4th: user_id + match order for Bronze paid matches.

### 11.11 Foreign Keys

- match_turns.match_id → matches.id; player_match_stats.match_id → matches.id, user_id → users.id; queue_entries.user_id → users.id; review_flags.user_id → users.id; bronze_tokens.user_id → users.id; payouts.match_id → matches.id; dispute_cases.match_id, reporter_user_id → users.id.

---

## 12. Security Model

### 12.1 Client Never Trusted for Score

- Server computes all scores and placement. Client cannot submit “my score” or “my place.” Only actions (moves, abilities) are accepted.

### 12.2 Signed Server Result Before Contract Submit

- Server holds private key for current `resultSigner`. After finalizing match, server signs (matchId, placement or amounts, nonce). Contract verifies signature against stored `resultSigner` address before distributing. Signer rotation: §3.11–3.12; complete pending result submissions before rotating or re-sign with new key per runbook.

### 12.3 Replay Verification

- Dispute flow: load match_turns; run resolveTurn in sequence; compare final placement and scores to stored result. If mismatch, correct result and supplementary payout or clawback per dispute policy.

### 12.4 RPC Failure Retry

- Contract calls (entry, submitResult): retry with exponential backoff (e.g. 3 attempts). On persistent failure, match marked payout_pending; manual runbook (§13, §3.7 Prod Val).

### 12.5 Reentrancy Guards

- Contract: reentrancy guard on all state-changing functions that perform external transfers.

### 12.6 Gas Estimation Safety Margin

- When estimating gas for submitResult, use 1.2× estimated gas or block-based limit to avoid revert due to gas.

### 12.7 Transaction Idempotency

- Contract: match status must be Escrowed before submitResult; after success set Resolved so same result cannot be submitted again. Expired or Refunded match cannot be resolved. Server: track contract_tx_hash per match; do not resubmit if already succeeded. Do not start gameplay for match_id in Expired or Refunded state.

---

## 13. Dispute & Replay System

### 13.1 Match Log Storage

- **Format:** Per match: header (match_id, tier, board, player list, start/end). Per turn: turn_index, state_before hash or snapshot, actions[4], state_after, scores_after. Stored in DB (match_turns) and optionally exported as JSON for ops.

### 13.2 Deterministic Replay Engine

- Load match_turns in order. For each turn: `state_next = resolveTurn(state_before, actions)`. Use only stored actions; do not use timestamps or receipt time. Assert state_next equals stored state_after (or scores match). Final step: compare computed placement and scores to stored match result. Turn timing does not affect replay outcome.

### 13.3 Admin Tool Flow

- Load match by match_id. Replay from log (same resolveTurn code path). Compare final score and placement to recorded result. If identical → dispute rejected (or closed). If different → correct result; compute correct payouts; approve supplementary transfer or clawback; update dispute_cases and payouts.

### 13.4 Refund / Void Rules (from Spec)

- Server crash < 50% match time: void; full refund (contract or manual). ≥ 50%: resolve from last known state; pay 38/30/20/12 from that state. Log missing/corrupt: refund per policy (§4.5 Prod Val).

---

## 14. Deployment Architecture

### 14.1 Environments

- **Staging:** Staging game server, staging Postgres/Redis, testnet contract (e.g. Sepolia), test USDC. No production wallets.
- **Production:** Production game server(s), production Postgres (single primary + replica if needed), production Redis, mainnet contract, mainnet USDC, treasury and multisig on mainnet.

### 14.2 Testnet vs Mainnet Contract

- Same bytecode and logic; deploy to testnet for 100+ test matches (entry, fee, 38/30/20/12, tie-split). Then deploy to mainnet; no upgradeable fund logic.

### 14.3 CI/CD

- Build and test on commit (unit tests, deterministic resolution test, scoring tests). Deploy staging on merge to staging branch. Production deploy: tagged release, manual or automated with approval. Run migration scripts for DB; contract deploy is one-time or via factory, no in-place upgrade of fund logic.

### 14.4 Environment Separation

- Staging and production: separate DB, Redis, RPC, keys. No shared secrets. Server config (env) points to correct contract address and RPC.

### 14.5 Secret Management

- Wallet keys (result signer, treasury) in secret manager (e.g. AWS Secrets Manager, Vault). Server reads at startup or per-request. Multisig keys for pause held by ops; not in app.

### 14.6 Multisig Configuration

- Pause/unpause: 2-of-3 multisig. Document signer set and process; test on testnet before mainnet.

---

## 15. Monitoring & Alerting

### 15.1 Metrics

- **Active matches:** Count of matches in status in_progress.
- **Queue length:** Per queue (Bronze-10, Bronze-25); current waiting count.
- **Avg wait time:** Time from join to match creation, per queue.
- **Payout success rate:** % of finalized matches where contract submitResult succeeded within 3 retries.
- **Flagged accounts:** Count in review_flags with status open.
- **Match crash rate:** Matches that ended in error or void (server crash, etc.) / total matches.
- **RPC failure rate:** Failed contract calls / total contract calls (retries counted once per logical call).

### 15.2 Alert Thresholds

- Payout success rate < 95% over 1 hour → alert.
- Match crash rate > 2% over 1 hour → alert.
- RPC failure rate > 5% over 15 min → alert.
- Queue length > 50 per queue for > 10 min → optional alert (capacity).
- Any failed submitResult after 3 retries → alert (manual payout runbook).

---

## 16. Production Checklist Integration

Convert Production Validation checklist (§8) into technical validation gates:

| Gate | Implementation |
|------|----------------|
| **Smart contract audit** | Escrow, fee, 38/30/20/12, pause, no upgradeable fund logic; audit report and fixes before mainnet. |
| **1,000-match simulation** | Automated run: 1,000 matches with deterministic actions; every match yields placement 1–4; payout sum = 92% of entry; no stuck state. |
| **Deterministic turn resolution test** | Unit test: same (state, actions) → same output 1,000×; replay of N matches reproduces exact final score and placement. |
| **Stress test concurrency** | ≥4 concurrent matches (16 clients); no drop, correct result, match log written per match. |
| **Geo-block test** | Blocked regions cannot complete entry or access paid match; list enforced at join/entry. |
| **Testnet 100+ matches** | Run 100+ test matches on testnet (entry, fee, payout, tie-split). |
| **Multisig pause tested** | Pause/unpause on testnet; verify no new entries; verify existing match can be paid. |
| **Manual payout runbook** | Document and test once: simulate failed payout, manual transfer 38/30/20/12 from escrow/treasury. |
| **Dispute replay test** | 10 scenarios; replay from log; result matches or corrected payout executed. |
| **Entry timeout & refund test** | Match created with &lt;4 entries; after 5 min verify status = Expired; verify 100% refund to all who entered; no fee retained; matchId not used for gameplay. |

---

## 17. Known Tradeoffs / Technical Risks

- **Sync desync risk:** If client and server state diverge (e.g. missed message), client may show stale state. Mitigation: server is authority; client reconciles from server state on next snapshot; no client-authoritative transition.
- **Turn timer drift:** Wall-clock drift can make 6 s turn slightly variable. Mitigation: server uses turnDeadline = turnStartTime + 6000 ms; action accepted only if receivedAt <= turnDeadline; no grace window. Replay ignores timing and uses stored actions only.
- **RPC latency:** High latency can delay entry confirmation or result submit. Mitigation: retries, async submit with status polling; manual payout if contract submit fails after retries.
- **Escrow migration complexity:** If contract must be replaced, migrating open escrow to new contract requires pause, signed withdrawals or migration flow, and no double-spend. Design migration path when needed; not required for initial MVP.
- **Queue starvation at low DAU:** At very low DAU, 240 s timeout and 180 s merge may still leave long waits. Accepted per Phase 1a; no bot backfill; transparency (“peak hours”) and practice option.

No additional solutions beyond what is already defined in Architecture Spec and Production Validation.

---

**Document control:** TDD v1.1. Precision hardening: entry timeout & refund (5 min window, PendingEntries/Escrowed/Expired/Refunded, 100% refund, idempotency); result signer rotation (setResultSigner, multisig, runbook); explicit overtake (tileIndex = row*7+col, overtake condition, cap 8); explicit zone (contested = ≥2 players, 2 pts/zone/player/turn, no diminishing); survival cap min(., 75); turn timing (6000 ms window, receivedAt ≤ turnDeadline, default no-op, replay uses actions only). Locked to Production Validation and Architecture Spec. Ready for MVP implementation.
