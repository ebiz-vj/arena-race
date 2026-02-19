# Arena Race MVP — Implementation Backlog v1.0

**Purpose:** Ordered, dependency-aware task list for MVP execution.  
**Source:** Execution Plan v1.0, TDD v1.1 (LOCKED), ARENA_RACE_TECHNICAL_DESIGN.md.  
**Rule:** No coding starts until backlog is ordered and assigned. Contract first.

---

## Dependency Overview

```
TRACK 1: Smart Contract (BLOCKS all entry/queue integration)
    ↓
TRACK 2: Match Engine Backend (can start in parallel after backlog; no contract dependency for pure logic)
    ↓
TRACK 4: Entry Flow + Queue (depends on: Contract testnet stable, Entry flow defined)
    ↓
TRACK 3: Infrastructure & DevOps (supports all; can run in parallel where no app dependency)
```

**Critical path:** Contract → Contract tests → Testnet deploy → Entry flow integration → Queue + turn timer.

---

## Track 1 — Smart Contract

**Owner:** ENGINE_AGENT  
**Dependencies:** None (first in order).  
**Blocks:** Entry flow, queue integration, backend submitResult flow.

| ID | Task | Depends On | Done When |
|----|------|------------|-----------|
| 1.1 | Implement Match struct + status enum (PendingEntries, Escrowed, Expired, Refunded, Resolved) per TDD §3.3–3.4 | — | Struct and enum compile; status transitions documented |
| 1.2 | Implement `submitEntry(matchId, amount)` + entry window (5 min from creation); record playerWallets; enforce entryDeadline | 1.1 | Entries accepted only when PendingEntries and before deadline |
| 1.3 | On 4th entry: deduct 8% fee to treasury, set pool 92%, set status = Escrowed (TDD §3.5–3.6) | 1.2 | Fee and pool correct; status Escrowed |
| 1.4 | Implement `submitResult(matchId, placementOrPayouts, signature)` with 38/30/20/12 and tie-split (TDD §3.8–3.9) | 1.3 | Payouts sum to pool; double-submit blocked |
| 1.5 | Implement `refundMatch(matchId)` or `claimRefund(matchId)` for Expired/partial; 100% refund; no fee (TDD §3.7) | 1.1, 1.2 | Expired/Refunded paths refund full entry |
| 1.6 | Implement `setResultSigner(address)` — multisig only; emit SignerUpdated (TDD §3.11) | 1.4 | Only multisig can set; event emitted |
| 1.7 | Implement `pause()` / `unpause()` — multisig only (TDD §3.13) | 1.2 | Pause blocks new entry; submitResult/refund still work |
| 1.8 | Add reentrancy guard (OpenZeppelin) on all state-changing + transfer functions; checks-effects-interactions (TDD §3.10, §12.5) | 1.2–1.5 | No reentrancy on entry, refund, submitResult |
| 1.9 | Unit test contract: 0–3 entries → expire → full refund | 1.5 | Test passes |
| 1.10 | Unit test: 4 entries → Escrowed → fee exactly 8% | 1.3 | Test passes |
| 1.11 | Unit test: submitResult → correct 38/30/20/12; tie split; double submit blocked; Expired/Resolved/Refunded guards | 1.4, 1.5 | All tests pass |
| 1.12 | Unit test: setResultSigner + signature validation; pause blocks entry, submitResult works for Escrowed; reentrancy simulation | 1.6, 1.7, 1.8 | All tests pass; coverage ≥95% |
| 1.13 | Deploy to testnet (e.g. Sepolia); verify on explorer | 1.1–1.12 | Contract live on testnet |
| 1.14 | Run 50–100 testnet matches (entry → escrow → result → payout); verify expiration + refund | 1.13 | 50+ matches successful; no critical bugs |

---

## Track 2 — Match Engine Backend

**Owner:** ENGINE_AGENT  
**Dependencies:** None for pure logic (can start in parallel with Track 1 after backlog created).  
**Blocks:** Entry flow start condition (match starts only when contract = Escrowed); replay; stress sims.

| ID | Task | Depends On | Done When |
|----|------|------------|-----------|
| 2.1 | Implement `resolveTurn(previousState, playerActions[])` — movement in fixed player order (TDD §4.4, §5.1) | — | Pure function; movement applied |
| 2.2 | Implement trap resolution (tiles, damage/effects) | 2.1 | Traps applied deterministically |
| 2.3 | Implement zone: contested-only (≥2 players ≥1 token); 2 pts per zone per player per turn (TDD §6.1) | 2.1 | Zone points correct |
| 2.4 | Implement overtake: tileIndex = row*7+col; overtake condition; cap 8 per player per match (TDD §5.5, §6.1) | 2.1 | Overtake count and cap correct |
| 2.5 | Implement survival: safe tokens × 0.5; match cap min(., 75) (TDD §6.1) | 2.1 | Survival points and cap correct |
| 2.6 | Score accumulation: position 0.13×(6−row), zone, overtake, survival; tie-break total → overtake+zone → overtake count → split (TDD §6.2–6.4) | 2.3–2.5 | Final ranking and tie handling correct |
| 2.7 | Determinism test: 1,000 identical (state, actions) runs → identical output | 2.1–2.6 | 1,000× test passes |
| 2.8 | Replay test: full match from stored action log → same final score and placement | 2.7 | Replay reproduces result |
| 2.9 | Structured JSON logging: match creation, entry received, escrow confirmed, entry expired, refund executed, result signed, result submitted | 2.1 | All major actions logged |

---

## Track 3 — Queue + Entry Flow

**Owner:** ENGINE_AGENT  
**Dependencies:** Contract testnet stable (1.14); entry flow design from TDD §7.7.  
**Blocks:** Bronze retention, flags, replay integration with live matches.

| ID | Task | Depends On | Done When |
|----|------|------------|-----------|
| 3.1 | Define entry flow: Queue → Create match (matchId, entry_deadline) → Entry window 5 min → Wait for on-chain 4 entries (Escrowed) → Start match only when contract status = Escrowed | 1.14 | Flow documented and agreed |
| 3.2 | Implement backend: create match record (match_id, entry_deadline = now + 300); do not start turn loop until contract status = Escrowed | 1.14, 2.1 | Server never starts turn for PendingEntries/Expired/Refunded |
| 3.3 | Test: 4 players pay → Escrowed → match starts | 3.2 | Scenario passes |
| 3.4 | Test: 1 player never pays → entry expires → refund all → no match start | 3.2, 1.5 | Scenario passes |
| 3.5 | Test: Entry expires (5 min) → refund triggered → matchId not used for gameplay | 3.2 | Scenario passes |
| 3.6 | Redis queue: Bronze-10, Bronze-25; FIFO pop 4 → create match (TDD §7.1–7.3) | 3.2 | Queues form matches |
| 3.7 | 180 s merge prompt (Standard → Casual); 240 s queue timeout; entry deadline 5 min aligned with contract (TDD §7.4–7.5) | 3.6 | Merge and timeout per TDD §7 |
| 3.8 | Turn timer: turnDeadline = turnStartTime + 6000 ms; accept action only if receivedAt ≤ turnDeadline; default no-op (TDD §4.3) | 2.1 | Late packet ignored; default applied |
| 3.9 | Tests: late packet ignored; simultaneous before deadline accepted; disconnect mid-match → tokens frozen, match continues | 3.8 | All timer tests pass |

---

## Track 4 — Infrastructure & DevOps

**Owner:** ENGINE_AGENT  
**Dependencies:** None for env setup; contract deploy (1.13) for testnet; backend for CI.  
**Can run in parallel** where no app dependency.

| ID | Task | Depends On | Done When |
|----|------|------------|-----------|
| 4.1 | Create folder structure: /arena-race/{docs, contracts, backend, infrastructure, scripts} per Execution Plan | — | Structure exists and is documented |
| 4.2 | Contract toolchain: Hardhat or Foundry; test runner; coverage (≥95% target) | — | Compile and test from CLI |
| 4.3 | Backend: Node/TS project; Jest for engine tests; no DB/RPC in engine unit tests | 2.1 | Pure engine tests run |
| 4.4 | Staging env: game server, Postgres, Redis, testnet RPC, test USDC (TDD §14.1) | 1.13, 3.2 | Staging deployable |
| 4.5 | CI: build and test on commit (unit tests, determinism test, scoring tests) (TDD §14.3) | 2.7, 1.12 | CI green on contract + engine |
| 4.6 | Secret management: result signer key in HSM/secret manager; multisig for pause/setResultSigner (TDD §14.5–14.6) | 1.6, 1.7 | Keys secured; multisig configured |
| 4.7 | Monitoring: payout success rate, match crash rate, RPC failure rate; alert thresholds per TDD §15 | 3.2 | Metrics and alerts defined |

---

## Execution Order Summary

1. **Contract first:** 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8 → 1.9–1.12 → 1.13 → 1.14.
2. **Engine in parallel (after backlog):** 2.1 → 2.2 → … → 2.9; 2.7–2.8 are gates before backend integration.
3. **Entry integration only after contract testnet stable:** 3.1–3.5 depend on 1.14; 3.6–3.9 depend on 3.2.
4. **Queue only after entry flow defined:** 3.6–3.7 follow 3.1–3.5.
5. **Infrastructure:** 4.1–4.3 early; 4.4–4.7 as needed for deploy and security.

---

## Document Control

- **Version:** 1.0  
- **Aligned with:** Execution Plan v1.0, TDD v1.1 (LOCKED).  
- **Owner placeholder:** ENGINE_AGENT for all tasks.  
- **No code written until backlog approved;** Step 2 complete when this document exists and order is clear.
