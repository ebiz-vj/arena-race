# Step 5 — Deploy to Testnet (Runbook)

**Execution Plan:** Phase 2, Step 5.  
**Done when:** 50+ testnet matches successful; expiration + refund verified; no critical bugs.

---

## Prerequisites

- Node 18+ and `npm install` in `arena-race/`.
- Sepolia ETH on deployer account (for gas).
- Optional: [Etherscan API key](https://etherscan.io/apis) for contract verification.

---

## 1. Configure environment

Create `arena-race/.env` from the template and set the variables. **Only `ETHERSCAN_API_KEY` comes from Etherscan;** the rest come from your wallet or RPC provider.

- **Full guide:** see [arena-race/docs/ENV_SETUP.md](arena-race/docs/ENV_SETUP.md).
- **Quick:** copy `arena-race/.env.example` to `arena-race/.env`, then set:
  - **DEPLOYER_PRIVATE_KEY** — from your wallet (e.g. MetaMask export), **not** from Etherscan.
  - **SEPOLIA_RPC_URL** — e.g. `https://rpc.sepolia.org` (public) or from Alchemy/Infura (sign up, create Sepolia app, copy URL).
  - **ETHERSCAN_API_KEY** — (optional) only for automated verification; from [Etherscan API dashboard](https://etherscan.io/apidashboard).

Do not commit `.env`. Load it (e.g. `dotenv` in Node or `source .env` in shell) before running deploy.

---

## 2. Deploy

From repo root:

```bash
cd arena-race
npx hardhat run contracts/scripts/deploy.ts --network sepolia
```

- **Without USDC_ADDRESS:** deploys MockERC20 (test USDC) + ArenaRaceEscrow. Use for self-contained testing and the 50–100 match script.
- **With USDC_ADDRESS:** deploys only ArenaRaceEscrow (e.g. Circle Sepolia USDC: `0xE1262c4856656d67c9c9cf0c6Acf12df5EfAB4AA`).

Save the printed **ArenaRaceEscrow** and **USDC** addresses.

---

## 3. Verify on block explorer

Use [Sepolia Etherscan](https://sepolia.etherscan.io) → Contract → “Verify and Publish”:

- Compiler: Solidity 0.8.20
- Optimization: Yes, 200 runs
- **Via IR:** Yes (required; contract uses `viaIR: true`)
- Constructor arguments: ABI-encode `(usdcAddress, treasuryAddress, resultSignerAddress)` (e.g. use “Solidity (Single file)” and paste constructor args).

Or use a Hardhat verify plugin compatible with your Hardhat version (e.g. `@nomicfoundation/hardhat-verify` for Hardhat 3.x). For Hardhat 2.x, manual verification as above is recommended.

Confirm the contract appears as verified on [sepolia.etherscan.io](https://sepolia.etherscan.io).

---

## 4. Run 50–100 simulated matches (entry → escrow → result → payout)

**Recommended:** Use mock USDC deployment so the script can mint and use multiple signers.

Set addresses from deploy:

```bash
export ESCROW_ADDRESS=0x...
export USDC_ADDRESS=0x...   # MockERC20 address from deploy
```

On **Hardhat local/fork** (no real wait, expiration test automated):

```bash
# Use a fork or local node with multiple accounts; then:
MATCH_COUNT=50 npx hardhat run contracts/scripts/run-testnet-matches.ts --network sepolia
```

On **live Sepolia** with mock USDC you need 4 accounts funded with test USDC. The deploy script mints to deployer only; transfer test USDC from deployer to 3 other accounts (or run a local Hardhat node with 4 signers and mock USDC, then run the script against that network).

Alternative: run the simulation on **Hardhat network** (in-process) to avoid Sepolia RPC cost and time:

```bash
# Add to hardhat.config.ts a second sepolia entry or use defaultNetwork
npx hardhat run contracts/scripts/run-testnet-matches.ts --network hardhat
```

Note: By default the script expects 4 signers (accounts 0–3). On Hardhat, 20 accounts exist; ensure MockERC20 is deployed and those 4 accounts have balance (mint to them in a one-off script or deploy script).

**Simplest for “50+ matches OK”:** Run the **local simulation** (no Sepolia needed for count):

```bash
cd arena-race
npm run deploy:local
```

This deploys MockERC20 + Escrow on Hardhat, runs **50 full matches** (entry → escrow → result → payout), then runs the **expiration test** (2 entries, time travel 5 min, expire, claimRefund). If this passes, you have 50+ matches and expiration + refund verified in a single run. Then do **one** live Sepolia deploy → verify on explorer → optionally one live match and one live expiration test for production confidence.

---

## 5. Test entry expiration and refund (live Sepolia)

1. Create a match (e.g. via script or cast): `createMatch(matchId, entryAmount)`.
2. Submit **2 or 3** entries (not 4).
3. Wait **5+ minutes**.
4. Call `expireMatch(matchId)` (anyone).
5. Each player who entered calls `claimRefund(matchId)`.
6. Confirm status becomes Refunded and balances are refunded 100%; no fee.

Or use the helper script after creating the expiration match:

```bash
# After 5 min:
export ESCROW_ADDRESS=0x...
export EXPIRATION_MATCH_ID=0x...   # bytes32 matchId from step 1
npx hardhat run contracts/scripts/expire-and-refund.ts --network sepolia
```

Then have each player who entered call `claimRefund(matchId)` from their wallet.

---

## 6. Checklist (Done when)

- [ ] Contract deployed to Sepolia.
- [ ] Contract verified on block explorer.
- [ ] 50+ matches run successfully (entry → escrow → result → payout).
- [ ] At least one expiration test: &lt;4 entries, wait 5 min, expire, full refund; no fee.
- [ ] No critical bugs observed.

Do **not** proceed to backend integration (Step 8) until the contract is stable on testnet per the plan.

---

## Optional: Sepolia USDC

- Circle Sepolia USDC: `0xE1262c4856656d67c9c9cf0c6Acf12df5EfAB4AA`  
- Get test USDC from a faucet or bridge per Circle/explorer docs.

Document control: Step 5 runbook v1.0. Aligned with MVP Execution Plan and TDD §3.
