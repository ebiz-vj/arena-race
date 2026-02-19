# Arena Race MVP

A deterministic, dispute-proof, escrow-safe Web3 skill league. This repo contains the **smart contract**, **match engine backend**, **entry/queue flow**, and **ops runbooks** for the Arena Race MVP.

**Spec:** TDD v1.1 (locked). **Execution:** [MVP_Execution_Plan.md](docs/MVP_Execution_Plan.md). **Progress:** [PROGRESS_NOTES.md](docs/PROGRESS_NOTES.md).

---

## What's in this repo

| Area | Location | Purpose |
|------|----------|---------|
| **Contracts** | `arena-race/contracts/` | Solidity escrow (USDC entry, 8% fee, 38/30/20/12 payout); tests in `contracts/test/`. |
| **Backend** | `arena-race/backend/` | Pure match engine (resolveTurn), entry flow, queue, bronze retention, flags, replay; all logic testable without DB/blockchain. |
| **Scripts** | `arena-race/contracts/scripts/`, `arena-race/scripts/` | Deploy, run testnet matches, expiration/refund, pre-mainnet verification. |
| **Docs** | `docs/` | Execution plan, technical design, runbooks, checklist, progress notes. |

---

## Prerequisites

- **Node.js** 18+
- **npm** (or yarn)
- For **Sepolia deploy:** Sepolia ETH (faucet), optional RPC key (Alchemy/Infura) and Etherscan API key for verification

---

## Quick start

### 1. Install

```bash
# Contracts + Hardhat
cd arena-race
npm install

# Backend (engine, entry, queue, tests)
cd backend
npm install
```

### 2. Run all tests

**Contracts (Hardhat):**

```bash
cd arena-race
npm run test
```

**Backend (Jest):**

```bash
cd arena-race/backend
npm test
```

**Pre-mainnet checklist (contracts + backend + 100-match sim):**

```bash
cd arena-race
npm run verify:checklist
```

---

## Project structure

```
arena-race/
├── contracts/
│   ├── ArenaRaceEscrow.sol    # Escrow + payout (TDD §3)
│   ├── MockERC20.sol          # Test USDC
│   ├── test/
│   │   └── ArenaRaceEscrow.test.ts
│   └── scripts/
│       ├── deploy.ts                  # Deploy to Sepolia
│       ├── deploy-and-run-local.ts   # 100 matches + expiration on Hardhat
│       ├── run-testnet-matches.ts     # N matches on Sepolia/Hardhat
│       └── expire-and-refund.ts       # Expiration on live testnet
├── backend/
│   ├── engine/     # resolveTurn, movement, trap, zone, overtake, survival, scoring, turnTimer
│   ├── entry/      # Entry flow (start match only when Escrowed)
│   ├── queue/      # Queue service (FIFO, merge 180s, timeout 240s)
│   ├── bronze/     # Consecutive 4th tracker, free-entry token
│   ├── flags/      # Co-occurrence and win-rate flags
│   ├── replay/     # Replay from match_turns; tamper detection
│   ├── simulation/ # 1,000-match run with random legal actions
│   └── stress/     # Concurrency stress (4/8 parallel matches)
├── scripts/
│   └── verify-pre-mainnet.js  # Runs contract tests + backend replay/sim + 100 matches
├── hardhat.config.ts
├── package.json
└── .env.example

docs/
├── MVP_Execution_Plan.md      # Phased steps (spec → contract → engine → entry → launch)
├── PROGRESS_NOTES.md           # What’s done; next steps
├── ARENA_RACE_TECHNICAL_DESIGN.md   # System, components, contract responsibilities
├── ARENA_RACE_ARCHITECTURE_SPEC.md  # Formulas, scoring, thresholds
├── DEPLOY_RUNBOOK.md          # Testnet deploy + verify; 50+ matches; pre-mainnet gate
├── ENV_SETUP.md               # .env variables (wallet, RPC, Etherscan)
├── KEY_MANAGEMENT_RUNBOOK.md  # Result signer, multisig, rotation
├── RED_TEAM_SCENARIOS.md      # Attack scenarios and handling
└── REPLAY_RUNBOOK.md          # Replay and dispute flow
```

---

## What to test (developer checklist)

1. **Contract**
   - `cd arena-race && npm run test` — 24 tests (entry, escrow, refund, tie, pause, signer, replay, reentrancy).
   - `npm run coverage` — coverage report (target ≥95% for escrow).

2. **Backend**
   - `cd arena-race/backend && npm test` — 58 tests (engine, entry, queue, bronze, flags, replay, simulation, stress, determinism).

3. **Local simulation (100 matches + expiration)**
   - `cd arena-race && npm run deploy:local` — deploys on Hardhat, runs 100 full matches and one expiration/refund flow.

4. **Pre-mainnet gate**
   - `cd arena-race && npm run verify:checklist` — runs contract tests, backend replay + 1,000-match sim, and local 100-match run. Before mainnet see [DEPLOY_RUNBOOK.md](docs/DEPLOY_RUNBOOK.md) § Pre-mainnet gate.

---

## Environment (for deploy and testnet)

- Copy `arena-race/.env.example` to `arena-race/.env`.
- **Required for Sepolia:** `DEPLOYER_PRIVATE_KEY`, optionally `SEPOLIA_RPC_URL`.
- **Optional:** `ETHERSCAN_API_KEY` (verify contract), `USDC_ADDRESS` (use existing USDC).
- Details: [docs/ENV_SETUP.md](docs/ENV_SETUP.md).

**Do not commit `.env`.**

---

## Key commands (from `arena-race/`)

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile Solidity (via Hardhat, via-IR). |
| `npm run test` | Run contract unit tests. |
| `npm run coverage` | Contract coverage. |
| `npm run deploy:sepolia` | Deploy to Sepolia (needs .env). |
| `npm run deploy:local` | Deploy on Hardhat + run 100 matches + expiration. |
| `npm run verify:checklist` | Full pre-mainnet verification (contract + backend + 100 matches). |
| `npm run deploy:localhost` | Deploy to a running Hardhat node (localhost:8545); writes addresses for the webapp. |
| `npx hardhat run contracts/scripts/e2e-localhost-flow.ts` | E2E: create match, 4 entries, submit result, verify status and payouts (no UI). |

**Backend (from `arena-race/backend/`):**

| Command | Description |
|---------|-------------|
| `npm test` | All backend tests. |
| `npm test -- --testPathPattern=replay` | Replay tests only. |
| `npm test -- --testPathPattern=run1000Matches` | 1,000-match simulation only. |

---

## Test on localhost (game platform UI)

Run the chain, deploy contracts, and open the web UI to create matches, enter, and resolve.

**1. Start the local chain (leave this terminal open):**

```bash
cd arena-race
npm run node:localhost
```

Wait until you see **"Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/"** before running deploy.

**2. In a second terminal — deploy contracts and write addresses for the webapp:**

```bash
cd arena-race
npm run deploy:localhost
```

**Important:** Run `deploy:localhost` only once per node session. If you run it again, the webapp gets new contract addresses; any match you created lives on the *old* escrow, so "Fetch match" will show "No match" and balances will look unchanged (you're reading the new USDC). To avoid this, keep the same deployment for the whole test, or restart the node and run deploy once, then create/enter/resolve again.

**3. In a third terminal — start the result signer (needed to submit match results):**

```bash
cd arena-race
npm run signer
```

**4. In a fourth terminal — start the webapp:**

```bash
cd arena-race/webapp
npm run dev
```

**5. In your browser:** Open **http://localhost:5173**

**6. Connect your wallet:** In MetaMask (or another wallet), add the network **Localhost 8545** (URL `http://127.0.0.1:8545`, chain id **31337**). Import one of the Hardhat node accounts (private keys are printed when you run `npm run node:localhost`).

**Note:** Opening `http://127.0.0.1:8545/` in a browser returns a JSON-RPC "Parse error" — that is normal. The endpoint expects POST requests with JSON (used by MetaMask and the app). Use the webapp at **http://localhost:5173** to interact.

**Flow to test:** Use **Create match** (owner = first Hardhat account), then **Enter match** with 4 different accounts (switch in MetaMask), then **Submit result** with placement e.g. `0,1,2,3` (1st = player 0, 2nd = player 1, …). The signer uses the same key as the deployer so results can be submitted from the UI.

**Terminal (node) logs:** The Hardhat node often prints `Contract call: ...#<unrecognized-selector>` and `Transaction reverted without a reason`. These are from internal or ABI-unknown calls and do not mean your tx failed. Look for `eth_sendRawTransaction` with `submitEntry` or `submitResultWithPlacement` and `Gas used:` to confirm success.

**MetaMask vs app balance:** On Localhost, MetaMask may not refresh custom token (USDC) balances. The balance shown on **http://localhost:5173** is read directly from the chain and is correct; switch accounts there to see each account’s USDC after payouts.

---

## Architecture (short)

- **Contract:** Accepts USDC entry; 8% fee to treasury; 92% pool; pays 38/30/20/12 (or tie-split) on signed result. No game logic. States: PendingEntries → Escrowed | Expired → Refunded | Resolved.
- **Engine:** Pure `resolveTurn(previousState, playerActions)` — movement, trap, zone, overtake, survival, scoring; deterministic; no DB/RPC.
- **Entry flow:** Match starts only when contract status = Escrowed; never for PendingEntries/Expired/Refunded. Entry window 5 min; expiration triggers refund.
- **Queue:** In-memory (or Redis) FIFO; Bronze-10 / Bronze-25; pop 4 → create match; 180 s merge prompt, 240 s timeout.

See [ARENA_RACE_TECHNICAL_DESIGN.md](docs/ARENA_RACE_TECHNICAL_DESIGN.md) for full design.

---

## Security and ops

- **Keys:** Result signer in HSM/secret manager; multisig for pause and setResultSigner. [KEY_MANAGEMENT_RUNBOOK.md](docs/KEY_MANAGEMENT_RUNBOOK.md).
- **Red-team:** Double entry, reentrancy, signature replay, expired resolution, entry race, late submit — all documented and tested. [RED_TEAM_SCENARIOS.md](docs/RED_TEAM_SCENARIOS.md).
- **Replay:** Re-run match from stored turns; tamper detection. [REPLAY_RUNBOOK.md](docs/REPLAY_RUNBOOK.md).

---

## License and spec

- Implementation follows **TDD v1.1 (locked)** and **MVP Execution Plan v1.0**. No gameplay or economic changes without an explicit change request.
- Contract: OpenZeppelin (ReentrancyGuard, SafeERC20, Ownable); Solidity 0.8.20; via-IR for compilation.
