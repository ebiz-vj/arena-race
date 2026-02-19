# Deploy Runbook

**Covers:** Testnet (Sepolia) deploy and verify, 50+ match simulation, expiration/refund.  
**Localhost:** See [README.md](../README.md) section "Test on localhost (game platform UI)".

**Execution Plan:** Phase 2, Step 5. Done when: 50+ testnet matches successful; expiration + refund verified; no critical bugs.

---

## Prerequisites

- Node 18+ and `npm install` in `arena-race/`.
- Sepolia ETH on deployer account (for gas).
- Optional: [Etherscan API key](https://etherscan.io/apis) for contract verification.

---

## 1. Configure environment

Create `arena-race/.env` from the template. **Only `ETHERSCAN_API_KEY` comes from Etherscan;** the rest from your wallet or RPC provider.

- **Full guide:** [docs/ENV_SETUP.md](ENV_SETUP.md).
- **Quick:** copy `arena-race/.env.example` to `arena-race/.env`, set:
  - **DEPLOYER_PRIVATE_KEY** — from your wallet (e.g. MetaMask), **not** from Etherscan.
  - **SEPOLIA_RPC_URL** — e.g. public RPC or Alchemy/Infura Sepolia URL.
  - **ETHERSCAN_API_KEY** — (optional) for automated verification.

Do not commit `.env`.

---

## 2. Deploy to Sepolia

```bash
cd arena-race
npx hardhat run contracts/scripts/deploy.ts --network sepolia
```

- **Without USDC_ADDRESS:** deploys MockERC20 + ArenaRaceEscrow (self-contained testing).
- **With USDC_ADDRESS:** deploys only ArenaRaceEscrow (e.g. Circle Sepolia USDC).

Save the printed **ArenaRaceEscrow** and **USDC** addresses.

---

## 3. Verify on block explorer

[Sepolia Etherscan](https://sepolia.etherscan.io) → Contract → “Verify and Publish”:

- Compiler: Solidity 0.8.20, Optimization: Yes, 200 runs, **Via IR:** Yes.
- Constructor arguments: ABI-encode `(usdcAddress, treasuryAddress, resultSignerAddress)`.

---

## 4. Run 50+ matches (simulation)

**Simplest (no Sepolia needed for count):**

```bash
cd arena-race
npm run deploy:local
```

Deploys on Hardhat, runs 100 full matches + expiration test. Satisfies “50+ matches” and “expiration + refund verified.”

**On live Sepolia:** set `ESCROW_ADDRESS` and `USDC_ADDRESS`, then run `contracts/scripts/run-testnet-matches.ts` with 4 funded accounts (see script comments).

---

## 5. Test expiration and refund (live Sepolia)

1. Create a match; submit 2 or 3 entries (not 4).
2. Wait 5+ minutes.
3. Call `expireMatch(matchId)` (anyone).
4. Each player who entered calls `claimRefund(matchId)`.
5. Confirm status Refunded and full refund; no fee.

Helper script (after 5 min):

```bash
export ESCROW_ADDRESS=0x...
export EXPIRATION_MATCH_ID=0x...   # bytes32 from step 1
npx hardhat run contracts/scripts/expire-and-refund.ts --network sepolia
```

Then each player calls `claimRefund(matchId)` from their wallet.

---

## 6. Checklist (done when)

- [ ] Contract deployed to Sepolia.
- [ ] Contract verified on block explorer.
- [ ] 50+ matches run successfully (entry → escrow → result → payout).
- [ ] At least one expiration test: <4 entries, wait 5 min, expire, full refund.
- [ ] No critical bugs observed.

**Optional:** Circle Sepolia USDC: `0xE1262c4856656d67c9c9cf0c6Acf12df5EfAB4AA`.

---

## 7. Pre-mainnet gate (Step 20)

Before mainnet, **all** items below must be TRUE and signed off. Execution Plan: Phase 12, Step 20.

| # | Requirement | How to verify |
|---|-------------|----------------|
| 1 | 100+ testnet matches successful | `deploy-and-run-local.ts` (MATCH_COUNT=100) or `run-testnet-matches.ts` on Sepolia. |
| 2 | Entry expiration verified | Match with &lt;4 entries; after 5 min → Expired; no fee. Contract test + local script. |
| 3 | Refund verified | Expired → claimRefund/refundMatch → 100% back; no fee. |
| 4 | Tie payout verified | Tie-split payouts sum to pool; 38/30/20/12. Contract tests. |
| 5 | Pause tested | pause() blocks entry/createMatch; submitResult/refund still work. |
| 6 | Signer rotation tested | setResultSigner via owner; new signer can submit result. KEY_MANAGEMENT_RUNBOOK §3. |
| 7 | Replay verified | Re-run from match_turns; tamper detected. Backend `replay/replay.test.ts`. REPLAY_RUNBOOK. |
| 8 | 1,000 sim matches clean | Backend `simulation/run1000Matches.test.ts`. |
| 9 | No unresolved critical bug | RED_TEAM_SCENARIOS documented; tests pass. |

**One-command run:** From `arena-race`: `npm run verify:checklist` (contract tests + backend replay/sim + 100 matches).

**Sign-off:** Tech lead verifies all items; date and notes recorded.
