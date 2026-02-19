# Arena Race MVP — Progress Notes

**Purpose:** Record of what has been achieved so far, aligned with the Execution Plan v1.0 and TDD v1.1 (LOCKED).  
**Updated:** As of completion of Phase 12 Step 20 (pre-mainnet checklist).

---

## Summary

| Phase | Step | Status | Notes |
|-------|------|--------|--------|
| 1 | 1 — Lock Spec | ✅ Complete (pre-existing) | TDD v1.1 locked. |
| 1 | 2 — Implementation Backlog | ✅ Complete | 4 tracks, dependencies documented. |
| 2 | 3 — Implement Escrow Contract | ✅ Complete | ArenaRaceEscrow.sol per TDD §3. |
| 2 | 4 — Unit Test Contract | ✅ Complete | 23 tests, ≥95% coverage. |
| 2 | 5 — Deploy to Testnet | ✅ Complete | Sepolia deploy + runbook; 50-match sim available. |
| 3 | 6 — resolveTurn() (pure engine) | ✅ Complete | movement, trap, zone, overtake, survival, scoring, tie-break. |
| 3 | 7 — Determinism & replay test | ✅ Complete | 1,000× identical output; replay reproduces result. |
| 4 | 8 — Connect backend to contract | ✅ Complete | Entry flow; start only when Escrowed; expire → triggerRefund. |
| 5 | 9 — Queue logic | ✅ Complete | In-memory FIFO; pop 4; merge 180s, timeout 240s. |
| 5 | 10 — Turn timer | ✅ Complete | 6 s window; late → default; tests. |
| 6 | 11 — Consecutive 4th tracker | ✅ Complete | 3 consecutive 4th → token; 7-day expiry; max 1 active. |
| 6 | 12 — Free entry funding flow | ✅ Complete | Treasury tops up when free token used; token consumed. |
| 7 | 13 — Co-occurrence & win-rate flags | ✅ Complete | N_together ≥15, avg≤2.2; ≥80% 1st/50; no false positive &lt;20. |
| 8 | 14 — Replay tool | ✅ Complete | replayMatch; tamper detected; REPLAY_RUNBOOK.md. |
| 9 | 15 — 1,000-match simulation | ✅ Complete | Random legal actions; placement 1–4; survival cap 75; overtake cap 8. |
| 9 | 16 — Concurrency stress | ✅ Complete | 4 and 8 simultaneous matches; all valid; no crash. |
| 10 | 17 — Key management | ✅ Complete | KEY_MANAGEMENT_RUNBOOK.md; HSM/secret manager; multisig; signer rotation. |
| 10 | 18 — Red-team pass | ✅ Complete | RED_TEAM_SCENARIOS.md; signature-replay test; all scenarios documented. |
| 12 | 20 — Pre-mainnet checklist | ✅ Complete | DEPLOY_RUNBOOK.md § Pre-mainnet gate; 9 items with verification. |
| 11+ | 19, 21 onward | ⏳ Not started | Audit (external); mainnet deploy, launch. |

**Critical path:** Through Step 20 ✅ **done.** Next: Step 19 — Contract audit (provide TDD, coverage); Step 21 — Deploy to mainnet.

---

## Phase 1 — Specification & Backlog

### Step 1 — Lock Spec Snapshot
- **Status:** Complete (before this run).
- **Rule:** TDD v1.1 is the single source of truth; no gameplay/economic changes without explicit change request.

### Step 2 — Create Implementation Backlog
- **Deliverable:** Task ordering is in [MVP_Execution_Plan.md](MVP_Execution_Plan.md) (4 tracks: Contract, Engine, Queue+Entry, Infra).
- **Content:** Contract first; engine in parallel; entry/queue after contract testnet stable.

---

## Phase 2 — Smart Contract

### Step 3 — Implement Escrow Contract
- **Deliverables:**
  - `arena-race/contracts/ArenaRaceEscrow.sol` — full escrow per TDD §3.
  - `arena-race/contracts/MockERC20.sol` — test USDC for tests and testnet.
- **Implemented:**
  - Match struct + status enum (PendingEntries, Escrowed, Expired, Refunded, Resolved).
  - `createMatch(matchId, entryAmountPerPlayer)` — 5 min entry window.
  - `submitEntry(matchId, amount)` — on 4th entry: 8% fee to treasury, 92% pool, status = Escrowed.
  - `submitResultWithPlacement(matchId, placement[4], signature)` — 38/30/20/12.
  - `submitResult(matchId, payoutAmounts[4], signature)` — exact payouts (tie-split).
  - `expireMatch(matchId)`, `claimRefund(matchId)`, `refundMatch(matchId)` — 100% refund, no fee.
  - `setResultSigner(address)` (owner/multisig), `pause()` / `unpause()`.
  - ReentrancyGuard (OpenZeppelin); checks-effects-interactions.
- **Comments:** Contract comments reference TDD §3 sections.
- **No frontend/backend** connected; Solidity only.

### Step 4 — Unit Test Contract
- **Deliverable:** `arena-race/contracts/test/ArenaRaceEscrow.test.ts`
- **Coverage:** ArenaRaceEscrow **98.28% lines**, **98.84% statements** (target ≥95%).
- **Tests (23 total):**
  - createMatch (deadline 5 min, PendingEntries, already exists, when paused).
  - submitEntry (4 entries → Escrowed & 8% fee, wrong amount, already entered, past deadline).
  - expireMatch + claimRefund / refundMatch (0–3 entries → full refund).
  - submitResult with placement (38/30/20/12, double submit blocked, invalid signature).
  - submitResult with payouts (tie-split, sum ≠ pool reverted).
  - Expired cannot resolve; Resolved cannot refund.
  - setResultSigner (owner only, SignerUpdated, zero address reverted).
  - Pause (blocks entry; submitResult still works for Escrowed; unpause).
  - MatchNotFound; reentrancy (claimRefund protected).
- **Run:** `npm run test` in `arena-race`. All passing.

### Step 5 — Deploy to Testnet
- **Deliverables:**
  - `arena-race/contracts/scripts/deploy.ts` — deploy MockERC20 (optional) + ArenaRaceEscrow to Sepolia.
  - `arena-race/contracts/scripts/deploy-and-run-local.ts` — local 50 matches + expiration simulation.
  - `arena-race/contracts/scripts/run-testnet-matches.ts` — run N matches against deployed escrow (+ optional expiration).
  - `arena-race/contracts/scripts/expire-and-refund.ts` — call expireMatch after 5 min (live testnet).
  - `docs/DEPLOY_RUNBOOK.md` — runbook (env, deploy, verify, 50 matches, expiration).
  - `docs/ENV_SETUP.md` — where each env variable comes from (wallet vs RPC vs Etherscan). (Moved from arena-race/docs.)
  - `arena-race/.env.example` — template; `arena-race/.gitignore` — includes `.env`.
- **Config:**
  - `arena-race/hardhat.config.ts` — Sepolia network, 90s timeout, default RPC fallback (PublicNode), gas overrides in deploy script to avoid “replacement transaction underpriced.”
- **Actual deploy (Sepolia):**
  - **MockERC20 (test USDC):** `0x4Af903BA6662E71B1EA92dcEbf789A4184b703b1`
  - **ArenaRaceEscrow:** `0xC4f4346e107D6627114AbFea1b519AC59b7c17C2`
  - **Treasury & result signer:** deployer `0x8b5a0DDF7d7c7f53Ef5832C5AE0dC70fF5b95D7A`
  - **Network:** Sepolia (chain id 11155111).
- **50-match simulation:** `npm run deploy:local` runs 50 full matches + expiration test on Hardhat (no live RPC needed).
- **Verification:** Manual verification on [Sepolia Etherscan](https://sepolia.etherscan.io) (compiler 0.8.20, 200 runs, **Via IR: Yes**). Verify command printed in deploy summary.

---

## Phase 3 — Backend Match Engine (Pure Logic)

### Step 6 — Implement resolveTurn() (Pure Engine Only)
- **Deliverables:** `arena-race/backend/engine/` — pure TypeScript; no DB, no blockchain.
- **Implemented (TDD §4.4, §5–6):**
  - **types.ts:** MatchState, PlayerAction, TokenPositions, BoardConfig, createInitialState, defaultAction.
  - **movement.ts:** applyMovement in fixed player order (0,1,2,3); first mover wins tile.
  - **trap.ts:** resolveTraps — tokens on trap tiles eliminated (position = -1).
  - **zone.ts:** contested-only (zone = row); 2 pts per contested zone per player per turn.
  - **overtake.ts:** tileIndex = row*7+col; overtake condition; cap 8 per player per match; 4 pts per overtake.
  - **survival.ts:** safe tokens × 0.5; match cap 75 applied at ranking.
  - **scoring.ts:** position 0.13×(6−row), zone/overtake/survival accumulation; applySurvivalCapAndTotal; computePlacement with tie-break (total → overtake+zone → overtake count).
  - **resolveTurn.ts:** movement → trap → zone → overtake → survival → score update; returns new state.
- **Unit tests:** movement.test.ts, trap.test.ts, zone.test.ts, overtake.test.ts, survival.test.ts, scoring.test.ts, resolveTurn.test.ts.

### Step 7 — Determinism and Replay Test
- **Deliverable:** `arena-race/backend/engine/determinism.test.ts`
- **Tests:**
  - 1,000 identical (state + actions) runs → identical output (turnIndex, tokenPositions, scores, overtakeCounts).
  - Replay full match from stored action log → same final score and placement.
- **Run:** From `arena-race/backend`: `npm install` then `npm test`. (If disk space error, free space and retry.)

---

## Phase 4 — Entry Flow + Escrow Integration

### Step 8 — Connect Backend to Contract
- **Deliverables:** `arena-race/backend/entry/`
- **Implemented (TDD §7.7):**
  - **types.ts:** EscrowMatchStatus (aligned with contract enum), MatchRecord, IEscrowAdapter.
  - **entryFlow.ts:** checkEntryFlow(adapter, matchId, entryDeadline, now) → shouldStart only when Escrowed; triggerRefund when past deadline and still PendingEntries; never start for PendingEntries/Expired/Refunded.
  - **entryFlow.test.ts:** 4 players pay → Escrowed → shouldStart true; 1 never pays → shouldStart false; entry expires → triggerRefund; server never starts for Expired/Refunded.
- **Run:** `npm test` in `arena-race/backend` (11 suites, 34 tests).

---

## Phase 5 — Queue & Turn Timing

### Step 9 — Implement Queue Logic
- **Deliverables:** `arena-race/backend/queue/`
- **Implemented (TDD §7.1–7.5):**
  - **types.ts:** Tier (bronze-10, bronze-25), QueueEntry, MERGE_PROMPT_AFTER_MS 180s, QUEUE_TIMEOUT_MS 240s.
  - **queueService.ts:** QueueService (join, leave, tryFormMatch), IQueueStore, InMemoryQueueStore; FIFO pop 4 → create match; shouldShowMergePrompt (180s for bronze-25); isQueueTimeout (240s).
- **queueService.test.ts:** tryFormMatch null when <4; FIFO pop 4; merge 180s; timeout 240s; leave removes.

### Step 10 — Implement Turn Timer
- **Deliverables:** `arena-race/backend/engine/turnTimer.ts`
- **Implemented (TDD §4.3):**
  - TURN_WINDOW_MS = 6000; isActionOnTime(receivedAt, turnDeadline); resolveAction(submitted, receivedAt, turnStartTime, currentPositions, playerIndex) → use submitted if on time, else defaultAction.
- **turnTimer.test.ts:** accept when receivedAt ≤ deadline; reject late; default when late; on-time uses submitted; simultaneous before deadline accepted.

---

## Phase 6 — Bronze Retention Cushion

### Step 11 — Consecutive 4th Tracker
- **Deliverables:** `arena-race/backend/bronze/`
- **Implemented (TDD §8):** consecutiveFourth.ts (recordBronzeMatchResult, canUseFreeToken), types.ts (BronzeToken, IBronzeStore), inMemoryBronzeStore.ts. After 3 consecutive 4th (paid) → grant token; 7-day expiry; max 1 active; no stacking; reset on non-4th.
- **consecutiveFourth.test.ts:** reset on non-4th; increment on 4th; grant after 3; no stacking; free_token doesn’t increment; expiry; consume.

### Step 12 — Free Entry Funding Flow
- **Deliverables:** `arena-race/backend/bronze/freeEntry.ts`
- **Implemented (TDD §8.2):** getFreeEntryPlayerIndex, shouldTreasuryFundEntry (treasury sends 10 USDC for that player so contract receives 4×10), useFreeTokenIfEligible (consume on use).
- **freeEntry.test.ts:** index of free user; treasury funds only that index; token consumed on use; expiry.

---

## Phase 7 — Anti-Collusion (MVP)

### Step 13 — Co-Occurrence and Win-Rate Flags
- **Deliverables:** `arena-race/backend/flags/`
- **Implemented (TDD §9):** coOccurrence.ts (rolling 200, N_together ≥15, avg(min(place)) ≤2.2), winRate.ts (≥20 matches, ≥80% 1st over 50); insert review_flags (return list); no auto-restrict.
- **flags.test.ts:** co-occurrence flags pair; no false positive when N&lt;15; win-rate flags at 80%; no false positive when &lt;20 matches.

---

## Phase 8 — Replay & Dispute

### Step 14 — Replay Tool
- **Deliverables:** `arena-race/backend/replay/`, `docs/REPLAY_RUNBOOK.md`
- **Implemented (TDD §13):** replay.ts — replayMatch(turns, storedPlacement), replayMatchStrict(turns); compare final placement; tamper → mismatch.
- **replay.test.ts:** replay reproduces placement; wrong stored placement → mismatch; tampered action → strict detects mismatch.
- **REPLAY_RUNBOOK.md:** load match → replay → approve or correct payout; tamper check.

---

## Phase 9 — Stress & Simulation

### Step 15 — 1,000-Match Simulation
- **Deliverables:** `arena-race/backend/simulation/runMatch.ts`, `run1000Matches.test.ts`
- **Implemented:** runOneMatch(options) with random legal actions (moves in [0, TILES-1]); assertMatchResultValid checks placement 1–4, survival ≤75, overtake ≤8.
- **Test:** Runs 1,000 matches; all pass checks; no stuck state.

### Step 16 — Concurrency Stress
- **Deliverables:** `arena-race/backend/stress/concurrencyStress.test.ts`
- **Implemented:** Promise.all for 4 then 8 simultaneous runOneMatch(); each result asserted valid.
- **Done when:** Stress runs pass; no crash.

---

## Phase 10 — Security Hardening

### Step 17 — Key Management
- **Deliverable:** `docs/KEY_MANAGEMENT_RUNBOOK.md`
- **Content:** Result signer key in HSM or secret manager (not code/env); multisig for pause and setResultSigner; signer rotation procedure and dry run on testnet.
- **Done when:** Runbook in place; ops can follow for key storage and rotation.

### Step 18 — Red-Team Pass
- **Deliverable:** `docs/RED_TEAM_SCENARIOS.md` + contract test
- **Scenarios:** Double entry, reentrancy, signature replay, expired match forced resolution, entry window race, late submitResult — each documented with handling and test reference.
- **Contract test added:** `ArenaRaceEscrow.test.ts` — "red-team: signature for match A cannot be used for match B (replay)".
- **Done when:** All scenarios handled or documented; signature-replay test passes.

---

## Phase 12 — Production Readiness Gate

### Step 20 — Pre-Mainnet Checklist
- **Deliverable:** Pre-mainnet gate in `docs/DEPLOY_RUNBOOK.md` (§ Pre-mainnet gate).
- **Content:** Nine requirements that must be TRUE before mainnet:
  1. 100+ testnet matches successful
  2. Entry expiration verified
  3. Refund verified
  4. Tie payout verified
  5. Pause tested
  6. Signer rotation tested
  7. Replay verified
  8. 1,000 sim matches clean
  9. No unresolved critical bug
- Each item has “How to verify” and “Evidence / reference” (contract tests, scripts, runbooks).
- Sign-off placeholder for tech lead.
- **Done when:** Checklist document complete; tech lead verifies and checks each item before mainnet.

---

## Supporting Work (Environment & Ops)

- **Env variables:**
  - `DEPLOYER_PRIVATE_KEY` — from wallet (e.g. MetaMask); not from Etherscan.
  - `SEPOLIA_RPC_URL` — RPC endpoint (default in config: PublicNode); optional Alchemy/Infura for stability.
  - `USDC_ADDRESS` — optional; if set, deploy uses existing USDC (e.g. already-deployed MockERC20).
  - `ETHERSCAN_API_KEY` — optional; from [Etherscan API dashboard](https://etherscan.io/apidashboard) for automated verify.
- **Fixes applied:**
  - **HeadersTimeoutError:** Sepolia network timeout increased to 90s; default RPC set to PublicNode when `SEPOLIA_RPC_URL` unset.
  - **Replacement transaction underpriced:** Gas overrides (120% of fee data + gasLimit) added to ArenaRaceEscrow deploy; option to deploy only escrow by setting `USDC_ADDRESS` to existing MockERC20.
- **Wallet/faucet:** One address and one private key per MetaMask account across all networks; Sepolia ETH obtained via Google Cloud Sepolia faucet (0.05 ETH used for deploy).

---

## Repo Layout (Relevant to Achievements)

```
arena-race/
  backend/
    engine/
      types.ts
      movement.ts
      trap.ts
      zone.ts
      overtake.ts
      survival.ts
      scoring.ts
      resolveTurn.ts
      movement.test.ts
      trap.test.ts
      zone.test.ts
      overtake.test.ts
      survival.test.ts
      scoring.test.ts
      resolveTurn.test.ts
      determinism.test.ts
      turnTimer.ts
      turnTimer.test.ts
    entry/
      types.ts
      entryFlow.ts
      entryFlow.test.ts
    queue/
      types.ts
      queueService.ts
      queueService.test.ts
    bronze/
      types.ts
      consecutiveFourth.ts
      inMemoryBronzeStore.ts
      consecutiveFourth.test.ts
      freeEntry.ts
      freeEntry.test.ts
    flags/
      types.ts
      coOccurrence.ts
      winRate.ts
      flags.test.ts
    replay/
      types.ts
      replay.ts
      replay.test.ts
    simulation/
      runMatch.ts
      run1000Matches.test.ts
    stress/
      concurrencyStress.test.ts
    package.json
    jest.config.js
    tsconfig.json
  contracts/
    ArenaRaceEscrow.sol
    MockERC20.sol
    test/
      ArenaRaceEscrow.test.ts
    scripts/
      deploy.ts
      deploy-and-run-local.ts
      run-testnet-matches.ts
      expire-and-refund.ts
  hardhat.config.ts
  package.json
  .env.example
  .gitignore
docs/
  MVP_Execution_Plan.md
  PROGRESS_NOTES.md   (this file)
  ARENA_RACE_TECHNICAL_DESIGN.md
  ARENA_RACE_ARCHITECTURE_SPEC.md
  DEPLOY_RUNBOOK.md   (testnet + pre-mainnet gate)
  ENV_SETUP.md
  KEY_MANAGEMENT_RUNBOOK.md
  RED_TEAM_SCENARIOS.md
  REPLAY_RUNBOOK.md
```

---

## Next Steps (Execution Plan)

- **Step 19 — Contract audit:** Provide TDD, coverage, edge-case list, state diagram; fix critical/high (external).
- **Step 21 — Deploy contract to mainnet:** Deploy; verify; configure multisig; set resultSigner; run 1 live internal match.
- **Step 22–23 — Soft launch; open public Phase 1a.**

---

**Document control:** Progress notes v1.0. Aligned with Execution Plan v1.0 and TDD v1.1. Update this file as further steps are completed.
