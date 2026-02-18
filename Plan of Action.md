🟢 PHASE 1 — Specification Freeze (1–3 days)
1️⃣ Lock Spec Snapshot
• Freeze TDD v1.1
• Tag it internally (e.g., ArenaRace_TDD_MVP_v1.1_LOCKED)
• No gameplay changes allowed during implementation unless critical
2️⃣ Create Implementation Backlog
Split into 4 tracks:
• Smart Contract
• Match Engine Backend
• Queue + Entry Flow
• Infrastructure & DevOps
Do not start coding randomly — start in dependency order below.

---

🔵 PHASE 2 — Smart Contract First (Critical Path)
Everything depends on escrow behavior.
3️⃣ Write Escrow Contract
Implement:
• submitEntry()
• entry window logic
• status transitions
• refundMatch() / claimRefund()
• submitResult()
• 38/30/20/12 split
• tie split logic
• reentrancy guard
• pause/unpause
• setResultSigner()
Do NOT connect frontend yet.

---

4️⃣ Unit Test Contract (Hard)
You need tests for:
• 0–3 entries → expire → full refund
• 4 entries → escrow → fee correct (8%)
• submitResult correct payout
• tie split payout
• double submitResult blocked
• expired cannot resolve
• resolved cannot refund
• signer rotation
• pause blocks new entry
• reentrancy attack simulation
Target: 95%+ coverage.

---

5️⃣ Deploy to Testnet
• Deploy contract
• Verify on explorer
• Run 50–100 manual simulated matches
• Test refund expiration manually
Only move forward once contract is stable.

---

🟣 PHASE 3 — Backend Match Engine
Now build deterministic engine.
6️⃣ Implement resolveTurn() (Pure Engine First)
No DB. No blockchain. Just logic.
Implement:
• movement
• zone contested logic
• overtake algorithm
• survival logic
• scoring accumulation
• survival cap
• tie-break
Then:
7️⃣ Determinism Test
• 1,000 identical simulations → same output
• Randomized stress test (no RNG used in logic)
• Replay full match from action log
Engine must be pure and reproducible before integrating.

---

🟡 PHASE 4 — Entry Flow + Escrow Integration
8️⃣ Connect Backend to Contract
Flow:
Queue → Create match → Entry window → Wait for on-chain confirmation → Start match only if Escrowed.
Test cases:
• 4 players pay normally
• 1 player fails to pay
• Entry expires
• Refund triggered
Do NOT allow match to start before Escrowed confirmed.

---

🟠 PHASE 5 — Queue & Timing System
9️⃣ Implement Queue Logic
• Redis queue
• FIFO pop 4
• 180s merge
• 240s timeout
• Entry deadline sync with contract
Then:
🔟 Implement Turn Timer
• 6000 ms hard window
• receivedAt <= deadline
• no-op default
• late actions ignored
Test:
• Late packet simulation
• Simultaneous action submission
• Player disconnect mid-match

---

🔴 PHASE 6 — Bronze Cushion
1️⃣1️⃣ Implement Consecutive 4th Tracker
• Track per user
• Reset on non-4th
• Grant token after 3 consecutive
1️⃣2️⃣ Implement Free Entry Funding Flow
• Treasury sends entry when token used
• Contract receives full 4 × entry always
• No special logic in contract
Test:
• Token expiry
• Token stacking prevention
• Token consumed correctly

---

🟤 PHASE 7 — Anti-Collusion (MVP Version)
1️⃣3️⃣ Implement:
• Co-occurrence query (15 matches / avg ≤2.2)
• Win-rate flag (≥20 matches, ≥80% over last 50)
• Insert into review_flags
No auto-restrict.
Test:
• Synthetic match data
• Flag creation
• No false positive from small samples

---

⚫ PHASE 8 — Replay & Dispute System
1️⃣4️⃣ Build Replay Tool
• Load match_turns
• Re-run resolveTurn
• Compare state
• Compare final score
Test:
• Tamper test (modify one action → mismatch)
• Confirm deterministic reproduction
This is critical for audit confidence.

---

🟢 PHASE 9 — Stress & Simulation
1️⃣5️⃣ Run 1,000 Match Simulation
• Automated matches
• Random legal actions
• Verify:
o Always 1–4 placement
o Payout sum = 92%
o Survival cap applied
o Overtake cap enforced
1️⃣6️⃣ Concurrency Stress
• 4 matches simultaneously
• 8 matches
• RPC latency simulation
• Entry race condition test

---

🟢 PHASE 10 — Security Hardening
1️⃣7️⃣ Key Management
• Move signer key to HSM/secret manager
• Multisig configured
• Rotation dry run on testnet
1️⃣8️⃣ Red-Team Pass
Simulate:
• Double entry attack
• Reentrancy attempt
• Signature replay
• Expired match forced resolution
• Entry window race
• Late submitResult
Fix anything discovered.

---

🟢 PHASE 11 — Audit Prep
1️⃣9️⃣ Contract Audit
Provide:
• Full TDD
• Test coverage
• Edge-case list
• State transition diagram
Fix findings.

---

🟢 PHASE 12 — Production Readiness Gate
Before mainnet:
Checklist must be TRUE:
• 100+ testnet matches
• Entry expiration verified
• Refund verified
• Tie payout verified
• Pause tested
• Signer rotation tested
• Replay verified
• 1,000 sim matches clean
• No unresolved critical bug
Only then deploy to mainnet.

---

🟢 PHASE 13 — Mainnet Launch
2️⃣0️⃣ Deploy Contract
• Verify
• Configure multisig
• Set signer
• Run 1 live internal match
2️⃣1️⃣ Soft Launch
• Invite-only first
• Low volume
• Monitor RPC & payout success
2️⃣2️⃣ Open Public Phase 1a
Bronze only.
2 queues.
Monitor DAU + queue time.

---

🧠 Realistic Timeline (3–5 Engineers)
Phase Duration
Contract + tests 2–3 weeks
Engine + determinism 2–3 weeks
Integration + queue 2 weeks
Replay + stress + polish 2 weeks
Audit + fixes 2–4 weeks
Total realistic MVP: 10–14 weeks.

---

🎯 Final Execution Rule
Do NOT:
• Add ability draft
• Add multiple boards
• Add Silver division
• Add diminishing zone
• Add auto-restrict
• Add fancy UI features
Until MVP stable for 30+ days.

---
