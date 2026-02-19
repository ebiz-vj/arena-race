# Production-Ready Game Development — Local Environment Plan

**Purpose:** (1) Verify the current arena-race stack (contracts, backend libs, frontend) with which basic game plan testing is already complete. (2) Plan and execute **real game development** — the authoritative game server, persistence, and full game client — so the game is production-ready in the local environment before mainnet.

**Prerequisite:** All work through Step 20 (Pre-Mainnet Checklist) is complete per [PROGRESS_NOTES.md](PROGRESS_NOTES.md).

**Reference docs:** [README.md](../README.md), [MVP_Execution_Plan.md](MVP_Execution_Plan.md), [ARENA_RACE_TECHNICAL_DESIGN.md](ARENA_RACE_TECHNICAL_DESIGN.md), [ARENA_RACE_ARCHITECTURE_SPEC.md](ARENA_RACE_ARCHITECTURE_SPEC.md), [DEPLOY_RUNBOOK.md](DEPLOY_RUNBOOK.md), [REPLAY_RUNBOOK.md](REPLAY_RUNBOOK.md).

---

## Current state (what exists in arena-race/)

| Layer | What exists | What is missing for the “real game” |
|-------|-------------|-------------------------------------|
| **Contracts** | ArenaRaceEscrow, MockERC20; deploy + tests | — (done) |
| **Backend** | Pure libs: engine (resolveTurn, movement, trap, zone, overtake, survival, scoring, turnTimer), entry (entryFlow), queue (queueService), bronze, flags, replay, simulation, stress | **No running game server**: no HTTP/WebSocket API, no turn loop, no persistence |
| **Webapp** | Escrow-only UI: create match, enter match, fetch match, submit result (placement) | **No queue UI**, **no in-match UI** (board, turn timer, submit actions) |
| **Signer** | Result signer (POST /sign, GET /whoami) | — (done) |

**Design target (TDD §4.1, §10):** Client joins queue → server forms match (4 players) → entries on-chain → **server runs turn loop** (6 s/turn, 5 min max) → server resolves placement → server signs → server calls submitResult. That full flow requires an **authoritative game server** and a **game client** (queue + match UI), which are not yet built.

---

## Document structure

- **Part I — Verify current stack:** Run existing tests and escrow flow once. Confirms basic game plan testing remains green.
- **Part II — Real game development:** Build the game server (API + turn loop + persistence), then the full game client (queue + match UI), integrate with contract/signer, and test end-to-end locally until production-ready.

---

# Part I — Verify Current Stack

Use this to confirm that the existing backend and frontend (with which basic game plan testing is done) still pass. Execute in order.

### Step I1 — Environment

- [x] Node.js 18+, npm. From repo root: `cd arena-race && npm install`, `cd backend && npm install`, `cd webapp && npm install`.

### Step I2 — Contract compile and tests

```bash
cd arena-race
npm run compile
npm run test
```

- [x] All contract tests pass (e.g. 24 tests).

### Step I3 — Backend tests

```bash
cd arena-race/backend
npm test
```

- [x] All backend tests pass (engine, entry, queue, bronze, flags, replay, simulation, stress).

### Step I4 — Pre-mainnet verification

```bash
cd arena-race
npm run verify:checklist
```

- [x] Contract tests + backend replay/1k sim + local 100 matches + expiration pass.

### Step I5 — Local escrow flow (one full cycle)

1. [ ] Terminal 1: `npm run node:localhost` (wait for RPC on 8545).
2. [ ] Terminal 2: `npm run deploy:localhost` (writes webapp config).
3. [ ] Terminal 3: `npm run signer`.
4. [ ] Terminal 4: `cd webapp && npm run dev`; open http://localhost:5173.
5. [ ] MetaMask: Localhost 8545, import 4 Hardhat accounts.
6. [ ] Create match (seed 1) → Enter with 4 accounts → Fetch match (Escrowed) → Submit result (e.g. 0,1,2,3) → Verify Resolved and balances.

### Step I6 — E2E script (no UI)

```bash
cd arena-race
npx hardhat run contracts/scripts/e2e-localhost-flow.ts
```

- [ ] Output: "E2E flow OK: create -> enter x4 -> resolve -> status and payouts verified."

**Part I sign-off:** All steps I1–I6 pass. Current stack verified. _________________ Date: __________

---

# Part II — Real Game Development (Production-Ready)

Build the authoritative game server and full game client so that: **queue → match formation → on-chain entry → turn-by-turn gameplay → result submission → payouts** runs end-to-end locally. Align with [ARENA_RACE_TECHNICAL_DESIGN.md](ARENA_RACE_TECHNICAL_DESIGN.md) §4 (match lifecycle), §10 (API), §11 (data models).

---

## Phase G1 — Game server skeleton

**Goal:** A running HTTP (and optionally WebSocket) service that will host queue, match state, and turn loop.

- [ ] **G1.1** Create `arena-race/server/` (or `arena-race/game-server/`) with Node + TypeScript (or align with backend’s TS).
- [ ] **G1.2** Add HTTP framework (e.g. Express or Fastify). Expose health/readiness (e.g. `GET /health`).
- [ ] **G1.3** Server reads config from env: port, chain RPC URL, escrow address, signer URL (or signer key for server-side submitResult). Document in README or ENV_SETUP.
- [ ] **Done when:** `npm run dev` (or equivalent) starts the server; `GET /health` returns 200.

---

## Phase G2 — Persistence

**Goal:** Store matches and turns for replay and dispute (TDD §11). For local, SQLite is sufficient; Postgres can be targeted for production.

- [x] **G2.1** SQLite via better-sqlite3 in `game-server/src/db/`. Schema: **matches**, **match_turns** per TDD §11.
- [x] **G2.2** Optional tables deferred.
- [x] **G2.3** Init on first run in `initDb()`.
- [x] **Done when:** Server creates match rows and turn rows; replay via GET /match/replay (G11).

---

## Phase G3 — Queue API and match formation

**Goal:** Clients join a queue; when 4 players are in the same tier, server forms a match and creates a match record.

- [ ] **G3.1** Implement or reuse queue store: in-memory (e.g. `InMemoryQueueStore` from `backend/queue`) or Redis. Tiers: Bronze-10, Bronze-25 (TDD §7.1).
- [ ] **G3.2** Expose **POST /queue/join** (body: tier), **POST /queue/leave**. Require wallet (or session) identity.
- [ ] **G3.3** Background or on-join: when 4 players in same tier, pop 4, generate `matchId` (e.g. keccak256(seed)), create **match** row (status = pending_entries, entry_deadline = now + 300), notify or return “match found” to the 4 clients (e.g. via WebSocket or polling).
- [ ] **G3.4** Optional: merge prompt (180 s) and queue timeout (240 s) per TDD §7.4–7.5.
- [ ] **Done when:** Four clients can join the same tier and receive a common matchId and entry_deadline; match row exists in DB.

---

## Phase G4 — Escrow integration (entry window)

**Goal:** Match starts only when contract status = Escrowed; never for PendingEntries/Expired/Refunded (TDD §7.7, backend `entryFlow`).

- [x] **G4.1** Escrow adapter in `game-server/src/escrow/`; `checkEntryFlow(rpc, escrow, matchId, entryDeadline, now)`.
- [x] **G4.2** **GET /match/entry-status**; turn loop started only via **POST /match/start** after client checks entry-status (or server checks); expired matches updated in DB.
- [x] **G4.3** (B) Client/owner creates match via webapp "Create this match on-chain"; server only reads state.
- [x] **Done when:** Turn loop starts only when Escrowed (POST /match/start checks entry-status).

---

## Phase G5 — Turn loop (authoritative)

**Goal:** Every 6 s, collect actions from the 4 players, run `resolveTurn`, persist turn, broadcast state (TDD §4.1–4.4).

- [x] **G5.1** `TurnLoop.startMatch()` uses `createInitialState`, default board/start from backend.
- [x] **G5.2** **POST /match/action** (matchId, turnIndex, playerIndex, moves); idempotent; `resolveAction` for late/missing.
- [x] **G5.3** setInterval 1s tick: at deadline run `resolveTurn`, persist to match_turns; clients poll **GET /match/state**.
- [x] **G5.4** MATCH_MAX_MS 5 min; 15 turns then end.
- [x] **Done when:** Match runs multiple turns; state persisted; replay via G11.

---

## Phase G6 — Match end and result submission

**Goal:** Compute final placement, sign, submit to contract, update match record (TDD §4.1 step 6–8).

- [ ] **G6.1** At match end, compute placement via `computePlacement(state.scores, state.overtakeCounts)` from `backend/engine/scoring`.
- [ ] **G6.2** Build signed result (matchId + placement or payouts). Use existing signer service (POST to signer URL) or server-held key; then call contract `submitResultWithPlacement` or `submitResult` (from server or via existing script). Ensure signer address matches contract’s resultSigner.
- [ ] **G6.3** On success, update match row (status = result_submitted, final_placement, contract_tx_hash).
- [ ] **Done when:** Finished match results in on-chain payouts; match record is final.

---

## Phase G7 — Game client: Queue UI

**Goal:** Player can join/leave queue and see “Match found” when a match is formed.

- [ ] **G7.1** Add Queue screen to webapp (or new game client app): select tier (Bronze-10 / Bronze-25), Join queue, Leave queue.
- [ ] **G7.2** Poll or WebSocket: when server assigns the player to a match (matchId, entry_deadline), show “Match found” and redirect to entry + match flow (e.g. “Proceed to pay entry”).
- [ ] **G7.3** Optional: show queue wait time, merge prompt at 180 s, timeout message at 240 s.
- [ ] **Done when:** User can join queue and be directed to entry when a match is formed.

---

## Phase G8 — Game client: Match UI

**Goal:** In-match experience: board, tokens, scores, turn timer, submit moves.

- [x] **G8.1** Live match card: 7×7 grid, token positions, scores, turn index.
- [x] **G8.2** Turn deadline countdown; 3 inputs (tile 0–48) + Submit move → **POST /match/action**.
- [x] **G8.3** Poll GET /match/state every 1.5 s.
- [x] **G8.4** Match end handled by server; result submitted on-chain (G6).
- [x] **Done when:** All 4 can play full match (submit moves, see state) until end.

---

## Phase G9 — Wallet and entry flow in client

**Goal:** When “Match found”, each of the 4 players approves USDC and submits entry to the contract; client and server stay in sync with contract state.

- [ ] **G9.1** After “Match found”, client shows entry amount (e.g. 10 or 25 USDC) and “Pay entry” (approve + submitEntry to contract). Reuse or share logic with existing webapp entry flow (wallet connect, approve, submitEntry(matchId, amount)).
- [ ] **G9.2** Server waits for Escrowed (Phase G4) before starting turn loop; client can show “Waiting for other players…” until server transitions to “Match starting.”
- [ ] **G9.3** Handle expiration: if entry window passes, show “Match expired; refund available” and link to claimRefund or document manual refund.
- [ ] **Done when:** Four players can complete entry on-chain; server starts the match only when Escrowed.

---

## Phase G10 — Local E2E (full game)

**Goal:** Run the full game locally: 4 clients join queue → match forms → 4 entries on-chain → turn loop runs → match ends → result submitted → payouts.

- [ ] **G10.1** Start: chain (node:localhost), deploy (deploy:localhost), signer, game server, webapp. Four browser tabs (or devices) with 4 Hardhat accounts.
- [ ] **G10.2** All 4 join same queue (e.g. Bronze-10). Match forms; all 4 get “Match found” and pay entry (approve + submitEntry). After 4th entry, server starts turn loop.
- [ ] **G10.3** Play multiple turns (each player submits moves; state updates). Let match end (5 min or last turn).
- [ ] **G10.4** Verify: match status Resolved on contract; USDC balances reflect 38/30/20/12 (or tie-split).
- [ ] **Done when:** At least one full game (queue → entry → play → result) completes locally with correct payouts.

---

## Phase G11 — Replay and determinism

**Goal:** Persisted turns can be replayed; tamper detection works (TDD §13, REPLAY_RUNBOOK).

- [x] **G11.1** **GET /match/replay?matchId=0x...** loads match_turns, builds StoredTurn[], calls `replayMatch`; returns `{ match, message?, ... }`.
- [x] **G11.2** Replay endpoint exposed; returns match true/false.
- [x] **G11.3** Tamper: backend replayMatchStrict detects state_after mismatch (existing backend tests).
- [x] **Done when:** Replay from DB reproduces result; tamper detectable via replay.

---

## Phase G12 — Production-ready local checklist

Before considering the **game** production-ready for mainnet, all below must be TRUE.

| # | Requirement | How verified |
|---|-------------|--------------|
| 1 | Part I (current stack) verified | Steps I1–I6 |
| 2 | Game server runs; health OK | G1 |
| 3 | Matches and turns persisted; replay works | G2, G11 |
| 4 | Queue forms matches; entry window respected | G3, G4 |
| 5 | Turn loop runs; 6 s timer; 5 min max | G5 |
| 6 | Result submitted on-chain; payouts correct | G6 |
| 7 | Client: queue → entry → match UI → result | G7, G8, G9 |
| 8 | Full local E2E: 4 players, one full game | G10 |
| 9 | Replay from DB matches result; tamper detected | G11 |
| 10 | Contract tests + backend tests + verify:checklist still pass | Re-run I2–I4 |
| 11 | No unresolved critical bug | Your log |

**Sign-off:** Tech lead (or assignee): _________________ Date: __________ Notes: _________________

---

## After production-ready local

- **Next:** Step 19 (contract audit), Step 21 (deploy to mainnet), Steps 22–23 (soft launch, Phase 1a). See [MVP_Execution_Plan.md](MVP_Execution_Plan.md) and [PROGRESS_NOTES.md](PROGRESS_NOTES.md).
- **Pre-mainnet gate:** [DEPLOY_RUNBOOK.md](DEPLOY_RUNBOOK.md) § Pre-mainnet gate (100+ testnet matches, expiration, refund, pause, signer rotation, etc.) still applies before mainnet deploy.

---

## Quick reference — Commands (existing)

| Command | Where | Purpose |
|---------|--------|--------|
| `npm run compile` | arena-race | Compile contracts |
| `npm run test` | arena-race | Contract tests |
| `npm test` | arena-race/backend | Backend tests |
| `npm run verify:checklist` | arena-race | Full pre-mainnet verification |
| `npm run node:localhost` | arena-race | Hardhat node |
| `npm run deploy:localhost` | arena-race | Deploy + webapp config |
| `npm run signer` | arena-race | Result signer |
| `npm run dev` | arena-race/webapp | Webapp dev server |
| `npx hardhat run contracts/scripts/e2e-localhost-flow.ts` | arena-race | E2E escrow flow (no UI) |

| `npm run game-server` | arena-race | Start game server (or `cd game-server && npm run dev`) |
| `GET http://localhost:3000/health` | — | Game server health |
| `GET http://localhost:3000/match/replay?matchId=0x...` | — | Replay match from DB (G11) |

---

**Document control:** Production-Ready Local Development Plan v2.0. Part I verifies current stack (basic game plan done); Part II defines real game development (authoritative server + full client) for production-ready local testing. Aligned with TDD v1.1 and PROGRESS_NOTES through Step 20.
