# Arena Race MVP — Execution Plan (Ordered)

**Purpose:** Complete the MVP one step at a time, in dependency order, with no blocking issues.  
**Source:** Plan of Action.md + TDD v1.1.  
**Rule:** Do not start a step until all its prerequisites are done and verified.

---

## Dependency Overview

```
Phase 1 (Spec) → Phase 2 (Contract) → Phase 4 (Backend↔Contract) → Phase 5 (Queue/Timer)
       ↓                  ↓                            ↓                      ↓
   [FREEZE]        [TEST + TESTNET]              [ENTRY FLOW]          [QUEUE + TURN]
                                                                              ↓
Phase 3 (Engine) ────────────────────────────────→ Phase 6 (Bronze) → Phase 7 (Flags)
       ↓                                                                    ↓
   [PURE + DETERMINISM]                                              Phase 8 (Replay)
                                                                              ↓
                                                              Phase 9 (Stress) → Phase 10 (Security)
                                                                              ↓
                                                              Phase 11 (Audit) → Phase 12 (Gate) → Phase 13 (Launch)
```

**Critical path:** Spec freeze → Contract → Contract tests → Testnet deploy → Backend engine → Entry flow integration → Queue + turn timer → Rest.

---

## Execution Order (One by One)

---

### PHASE 1 — Specification Freeze (1–3 days)

#### Step 1 — Lock Spec Snapshot
- [ ] Freeze TDD v1.1 as the single source of truth.
- [ ] Tag it (e.g. `ArenaRace_TDD_MVP_v1.1_LOCKED`).
- [ ] Rule: No gameplay or economic changes during implementation unless critical (document any exception).

**Done when:** Tag exists; team agrees no spec changes without explicit change request.

---

#### Step 2 — Create Implementation Backlog
- [ ] Split work into 4 tracks: **Smart Contract** | **Match Engine Backend** | **Queue + Entry Flow** | **Infrastructure & DevOps**.
- [ ] All tasks ordered by dependency (contract first, then engine, then integration).
- [ ] No coding starts until backlog is ordered and assigned.

**Done when:** Backlog is visible and ordered; everyone knows “contract first.”

---

### PHASE 2 — Smart Contract (Critical Path)

#### Step 3 — Implement Escrow Contract
- [ ] Implement in dependency-safe order:
  - [ ] Match struct + status (PendingEntries, Escrowed, Expired, Refunded, Resolved).
  - [ ] `submitEntry(matchId, amount)` + entry window (5 min from creation).
  - [ ] On 4th entry: fee 8%, pool 92%, status = Escrowed.
  - [ ] `submitResult(matchId, placementOrPayouts, signature)` + 38/30/20/12 + tie split.
  - [ ] `refundMatch(matchId)` or `claimRefund(matchId)` for Expired/partial; 100% refund; no fee.
  - [ ] `setResultSigner(address)` — multisig only; emit SignerUpdated.
  - [ ] `pause()` / `unpause()` — multisig only.
  - [ ] Reentrancy guard on all state-changing + transfer functions.
- [ ] Do **not** connect frontend or backend yet.

**Done when:** Contract compiles; all state transitions and functions exist per TDD §3.

---

#### Step 4 — Unit Test Contract
- [ ] Tests (target 95%+ coverage):
  - [ ] 0–3 entries → expire → full refund.
  - [ ] 4 entries → Escrowed → fee exactly 8%.
  - [ ] submitResult → correct 38/30/20/12 payout.
  - [ ] Tie split payout correct.
  - [ ] Double submitResult blocked.
  - [ ] Expired match cannot resolve.
  - [ ] Resolved match cannot refund.
  - [ ] Signer rotation (setResultSigner) + signature validation.
  - [ ] Pause blocks new entry; submitResult still works for Escrowed.
  - [ ] Reentrancy attack simulation.
- [ ] All tests pass.

**Done when:** Test suite green; coverage report ≥95%.

---

#### Step 5 — Deploy to Testnet
- [ ] Deploy contract to testnet (e.g. Sepolia).
- [ ] Verify on block explorer.
- [ ] Run 50–100 manual/simulated matches (entry → escrow → result → payout).
- [ ] Test: entry expiration (wait 5 min with &lt;4 entries) → refund.
- [ ] Do **not** proceed to backend integration until contract is stable on testnet.

**Done when:** 50+ testnet matches successful; expiration + refund verified; no critical bugs.

---

### PHASE 3 — Backend Match Engine (Pure Logic)

#### Step 6 — Implement resolveTurn() (Pure Engine Only)
- [ ] No DB, no blockchain. Pure function: `newState = resolveTurn(previousState, playerActions[])`.
- [ ] Implement in order:
  - [ ] Movement (fixed player order).
  - [ ] Trap resolution.
  - [ ] Zone: contested-only (≥2 players with ≥1 token); 2 pts per zone per player per turn.
  - [ ] Overtake: tileIndex = row*7+col; overtake condition; cap 8 per player per match.
  - [ ] Survival: safe tokens × 0.5; match cap min(., 75).
  - [ ] Score accumulation (position 0.13×(6−row), zone, overtake, survival).
  - [ ] Tie-break: total → overtake+zone → overtake count → split payout.
- [ ] All formulas per TDD §5–6.

**Done when:** resolveTurn runs in isolation; unit tests for each scoring component pass.

---

#### Step 7 — Determinism and Replay Test
- [ ] Run 1,000 identical (same state + actions) simulations → identical output every time.
- [ ] Randomized stress test with legal actions only (no RNG inside game logic).
- [ ] Replay full match from stored action log → same final score and placement.
- [ ] Do **not** integrate with DB or API until this passes.

**Done when:** 1,000× determinism test passes; replay matches recorded result.

---

### PHASE 4 — Entry Flow + Escrow Integration

#### Step 8 — Connect Backend to Contract
- [ ] Implement flow: Queue → Create match (matchId, entry_deadline) → Entry window (5 min) → Wait for on-chain 4 entries (Escrowed) → Start match **only** when contract status = Escrowed.
- [ ] Test cases:
  - [ ] 4 players pay → Escrowed → match starts.
  - [ ] 1 player never pays → entry expires → refund all → no match start.
  - [ ] Entry expires (5 min) → refund triggered → matchId not used for gameplay.
- [ ] Server must never start turn loop for PendingEntries, Expired, or Refunded.

**Done when:** All four entry scenarios work; no match starts without Escrowed.

---

### PHASE 5 — Queue & Turn Timing

#### Step 9 — Implement Queue Logic
- [ ] Redis queue: Bronze-10, Bronze-25 (Phase 1a).
- [ ] FIFO pop 4 → create match.
- [ ] 180 s merge prompt (Standard → Casual).
- [ ] 240 s queue timeout (practice / downgrade offer).
- [ ] Entry deadline (5 min) aligned with contract; on timeout set match expired and trigger refund.

**Done when:** Queues form matches; merge and timeout behave per TDD §7.

---

#### Step 10 — Implement Turn Timer
- [ ] Turn window: turnDeadline = turnStartTime + 6000 ms.
- [ ] Accept action only if receivedAt ≤ turnDeadline; late actions ignored; no grace.
- [ ] Default action: no move, no ability; deterministic no-op.
- [ ] Tests:
  - [ ] Late packet → ignored; default applied.
  - [ ] Simultaneous action submission → all accepted if before deadline.
  - [ ] Player disconnect mid-match → tokens frozen; match continues; placement from final score.

**Done when:** Turn timer and default action verified; disconnect handling does not crash match.

---

### PHASE 6 — Bronze Retention Cushion

#### Step 11 — Consecutive 4th Tracker
- [ ] Track per user (Bronze): consecutive 4th-place count in paid matches.
- [ ] Reset on non-4th placement.
- [ ] After 3 consecutive 4th → grant one Bronze free-entry token (DB only; 7-day expiry; max 1 active).

**Done when:** Tracker and token grant logic work; no stacking; expiry enforced.

---

#### Step 12 — Free Entry Funding Flow
- [ ] When player uses free token: treasury sends that player’s 10 USDC to contract so contract still receives 4×10.
- [ ] Contract logic unchanged (always 4 entries, 38/30/20/12).
- [ ] Tests: token expiry; no stacking; token consumed on use.

**Done when:** One free-entry match runs end-to-end; payout correct; token consumed.

---

### PHASE 7 — Anti-Collusion (MVP)

#### Step 13 — Co-Occurrence and Win-Rate Flags
- [ ] Co-occurrence: rolling 200 matches; N_together ≥ 15 and avg(min(place_A, place_B)) ≤ 2.2 → insert review_flags.
- [ ] Win-rate: ≥20 ranked matches, then ≥80% 1st over rolling 50 → insert review_flags.
- [ ] No auto-restrict; manual review only.
- [ ] Tests: synthetic match data; flag creation; no false positive on small samples (&lt;20 matches).

**Done when:** Flags created correctly; no false positives on minimal data.

---

### PHASE 8 — Replay & Dispute

#### Step 14 — Replay Tool
- [ ] Load match_turns; re-run resolveTurn in sequence.
- [ ] Compare state_after and final score/placement to stored result.
- [ ] Tamper test: modify one action in log → replay must show mismatch.
- [ ] Document admin flow: load match → replay → approve or correct payout.

**Done when:** Replay reproduces result; tamper detected; runbook written.

---

### PHASE 9 — Stress & Simulation

#### Step 15 — 1,000-Match Simulation
- [ ] Automated run: 1,000 matches with random legal actions.
- [ ] Verify: placement always 1–4; payout sum = 92% of entry; survival cap 75; overtake cap 8.

**Done when:** All 1,000 runs pass checks; no stuck state.

---

#### Step 16 — Concurrency Stress
- [ ] 4 simultaneous matches (16 clients); then 8 matches.
- [ ] RPC latency simulation; entry race (e.g. 4th entry at same time as expiry).
- [ ] No wrong payout; no double-spend; no crash.

**Done when:** Stress runs pass; no critical race conditions.

---

### PHASE 10 — Security Hardening

#### Step 17 — Key Management
- [ ] Result signer key in HSM or secret manager (not in code/env plaintext).
- [ ] Multisig configured for pause and setResultSigner.
- [ ] Signer rotation dry run on testnet.

**Done when:** Keys secured; multisig and rotation tested.

---

#### Step 18 — Red-Team Pass
- [ ] Simulate: double entry; reentrancy; signature replay; expired match forced resolution; entry window race; late submitResult.
- [ ] Fix any finding.

**Done when:** All red-team scenarios handled or documented as non-issues.

---

### PHASE 11 — Audit Prep

#### Step 19 — Contract Audit
- [ ] Provide: full TDD, test coverage, edge-case list, state transition diagram.
- [ ] Fix all critical/high findings; document medium/low.

**Done when:** Audit report received; critical/high closed.

---

### PHASE 12 — Production Readiness Gate

#### Step 20 — Pre-Mainnet Checklist
Before mainnet, all must be TRUE:
- [ ] 100+ testnet matches successful
- [ ] Entry expiration verified
- [ ] Refund verified
- [ ] Tie payout verified
- [ ] Pause tested
- [ ] Signer rotation tested
- [ ] Replay verified
- [ ] 1,000 sim matches clean
- [ ] No unresolved critical bug

**Done when:** Every item checked; sign-off from tech lead.

---

### PHASE 13 — Mainnet Launch

#### Step 21 — Deploy Contract to Mainnet
- [ ] Deploy; verify on explorer.
- [ ] Configure multisig; set resultSigner.
- [ ] Run 1 live internal match end-to-end.

**Done when:** Contract live; one full match paid on mainnet.

---

#### Step 22 — Soft Launch
- [ ] Invite-only; low volume.
- [ ] Monitor RPC and payout success rate; fix issues.

**Done when:** Stable for agreed period (e.g. 1 week).

---

#### Step 23 — Open Public Phase 1a
- [ ] Bronze only; 2 queues (10, 25 USDC).
- [ ] Monitor DAU and queue time; keep merge and timeout as per TDD.

**Done when:** Public Phase 1a live; monitoring in place.

---

## Execution Rules

1. **One step at a time.** Do not start step N+1 until step N is “Done when” satisfied.
2. **Contract first.** Backend integration (Step 8) waits for Steps 3–5. Engine (Steps 6–7) can parallelize with contract after Step 2, but entry flow depends on contract.
3. **No scope creep.** Do not add ability draft, multiple boards, Silver, diminishing zone, auto-restrict, or non-essential UI until MVP stable 30+ days.
4. **Reference:** TDD v1.1 is the spec. When in doubt, check TDD and Plan of Action.md.

---

## Timeline (3–5 Engineers)

| Phase | Focus | Duration |
|-------|--------|----------|
| 1 | Spec freeze + backlog | 1–3 days |
| 2 | Contract + tests + testnet | 2–3 weeks |
| 3 | Engine + determinism | 2–3 weeks |
| 4–5 | Entry flow + queue + timer | 2 weeks |
| 6–8 | Bronze cushion, flags, replay | 1–2 weeks |
| 9–10 | Stress + security | 2 weeks |
| 11–12 | Audit + gate | 2–4 weeks |
| 13 | Mainnet + launch | 1–2 weeks |

**Total realistic MVP: 10–14 weeks.**

---

**Document control:** Execution plan v1.0. Aligned with Plan of Action.md and TDD v1.1. Use checkboxes to track progress; only tick “Done when” after verification.
