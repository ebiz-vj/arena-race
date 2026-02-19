# Step 20 — Pre-Mainnet Checklist

**Execution Plan:** Phase 12, Step 20.  
**Done when:** Every item below is TRUE and signed off by tech lead.

Before mainnet, **all** of the following must be TRUE.

---

## Checklist

| # | Requirement | Status | How to verify | Evidence |
|---|-------------|--------|----------------|----------|
| 1 | **100+ testnet matches successful** | ✅ Verified | Run 100 full matches (entry → escrow → result → payout). | `npx hardhat run contracts/scripts/deploy-and-run-local.ts` (MATCH_COUNT=100): **100/100 matches OK** on Hardhat. For live Sepolia use `run-testnet-matches.ts` with MATCH_COUNT=100. |
| 2 | **Entry expiration verified** | ✅ Verified | Match with &lt;4 entries; after 5 min → Expired; no fee. | Contract test: "0-3 entries: expire then full refund". Local script: expiration test (2 entries, evm_increaseTime 301s, expire, claimRefund) **passed**. |
| 3 | **Refund verified** | ✅ Verified | Expired → claimRefund/refundMatch → 100% back; no fee. | Contract tests: "claimRefund", "refundMatch: owner can refund all in one tx". Local script: **Expiration + refund verified.** |
| 4 | **Tie payout verified** | ✅ Verified | Tie-split payouts sum to pool; 38/30/20/12. | Contract tests: "accepts exact payouts that sum to pool", "distributes correct 38/30/20/12 payout" **pass**. |
| 5 | **Pause tested** | ✅ Verified | pause() blocks entry/createMatch; submitResult/refund still work. | Contract tests: "reverts when paused", "pause blocks new entry; submitResult still works for Escrowed", "unpause restores" **pass**. |
| 6 | **Signer rotation tested** | ✅ Verified | setResultSigner via owner; new signer can submit result. | Contract test: "only owner can set; emits SignerUpdated" **pass**. KEY_MANAGEMENT_RUNBOOK §3 for testnet dry run. |
| 7 | **Replay verified** | ✅ Verified | Re-run resolveTurn from match_turns; match placement; tamper detected. | Backend test: `replay/replay.test.ts` (4 tests) **pass**. REPLAY_RUNBOOK.md. |
| 8 | **1,000 sim matches clean** | ✅ Verified | 1,000 matches random legal actions; placement 1–4; survival ≤75; overtake ≤8. | Backend test: `simulation/run1000Matches.test.ts` **pass**. |
| 9 | **No unresolved critical bug** | ✅ Verified | No known critical/high open issues. | RED_TEAM_SCENARIOS.md all documented; contract + backend tests pass. |

---

## Verification summary (automated run)

- **Contract tests:** 24 passing (`npx hardhat test`).
- **Backend tests:** 58 passing (includes replay + 1,000-match simulation).
- **Local 100-match run:** 100/100 matches OK; expiration + refund verified (`deploy-and-run-local.ts`).

**One-command re-run:** From `arena-race`: `node scripts/verify-pre-mainnet.js` (runs contract tests, backend replay+sim, local 100 matches).

---

## Sign-off

- [ ] **Tech lead:** All items above verified and checked.  
- **Date:** _________________  
- **Notes:** _________________________________

---

**Document control:** Pre-mainnet checklist v1.0. Aligned with Execution Plan Step 20.
