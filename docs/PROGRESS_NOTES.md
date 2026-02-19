# Arena Race MVP — Progress Notes

**Purpose:** Record of what has been achieved so far, aligned with the Execution Plan v1.0 and TDD v1.1 (LOCKED).  
**Updated:** As of completion of Phase 2 through Step 5 (testnet deploy).

---

## Summary

| Phase | Step | Status | Notes |
|-------|------|--------|--------|
| 1 | 1 — Lock Spec | ✅ Complete (pre-existing) | TDD v1.1 locked. |
| 1 | 2 — Implementation Backlog | ✅ Complete | 4 tracks, dependencies documented. |
| 2 | 3 — Implement Escrow Contract | ✅ Complete | ArenaRaceEscrow.sol per TDD §3. |
| 2 | 4 — Unit Test Contract | ✅ Complete | 23 tests, ≥95% coverage. |
| 2 | 5 — Deploy to Testnet | ✅ Complete | Sepolia deploy + runbook; 50-match sim available. |
| 3+ | 6 onward | ⏳ Not started | Backend engine, entry flow, queue, etc. |

**Critical path:** Spec freeze → Contract → Tests → Testnet deploy ✅ **done.** Next: Backend engine (Step 6) and/or Entry flow (Step 8) after contract stable.

---

## Phase 1 — Specification & Backlog

### Step 1 — Lock Spec Snapshot
- **Status:** Complete (before this run).
- **Rule:** TDD v1.1 is the single source of truth; no gameplay/economic changes without explicit change request.

### Step 2 — Create Implementation Backlog
- **Deliverable:** `docs/Implementation_Backlog.md`
- **Content:**
  - **Track 1 — Smart Contract:** 14 tasks (1.1–1.14), contract → tests → testnet.
  - **Track 2 — Match Engine Backend:** 9 tasks (2.1–2.9), pure engine + determinism.
  - **Track 3 — Queue + Entry Flow:** 9 tasks (3.1–3.9), after contract testnet stable.
  - **Track 4 — Infrastructure & DevOps:** 7 tasks (4.1–4.7).
- **Dependencies:** Contract first; engine can run in parallel after backlog; entry/queue after contract stable.
- **Owner placeholder:** ENGINE_AGENT for all tasks.

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
  - `docs/STEP5_Testnet_Deploy.md` — runbook (env, deploy, verify, 50 matches, expiration).
  - `docs/ENV_SETUP.md` — where each env variable comes from (wallet vs RPC vs Etherscan).
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
  Implementation_Backlog.md
  STEP5_Testnet_Deploy.md
  ENV_SETUP.md
  PROGRESS_NOTES.md   (this file)
  MVP_Execution_Plan.md
  ARENA_RACE_TECHNICAL_DESIGN.md
```

---

## Next Steps (Execution Plan)

- **Step 6 — Implement resolveTurn() (pure engine):** No DB/blockchain; `newState = resolveTurn(previousState, playerActions[])`; movement, trap, zone, overtake, survival, scoring, tie-break per TDD §5–6.
- **Step 7 — Determinism and replay test:** 1,000 identical runs → identical output; replay from action log.
- **Step 8 — Connect backend to contract:** Entry flow; start match only when contract status = Escrowed; handle expiration/refund.
- **Optional before Step 8:** Verify ArenaRaceEscrow on Sepolia Etherscan; run 50+ testnet matches (or rely on `deploy:local` simulation); run one live expiration test on Sepolia.

---

**Document control:** Progress notes v1.0. Aligned with Execution Plan v1.0 and TDD v1.1. Update this file as further steps are completed.
