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
├── ARENA_RACE_TECHNICAL_DESIGN.md
├── Implementation_Backlog.md
├── PROGRESS_NOTES.md
├── PRE_MAINNET_CHECKLIST.md   # Gate before mainnet; run verify:checklist
├── STEP5_Testnet_Deploy.md    # Deploy + verify on Sepolia
├── ENV_SETUP.md               # (in arena-race/docs or docs) Env vars
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
   - `cd arena-race && npm run verify:checklist` — runs contract tests, backend replay + 1,000-match sim, and local 100-match run. Use before mainnet; see [PRE_MAINNET_CHECKLIST.md](docs/PRE_MAINNET_CHECKLIST.md).

---

## Environment (for deploy and testnet)

- Copy `arena-race/.env.example` to `arena-race/.env`.
- **Required for Sepolia:** `DEPLOYER_PRIVATE_KEY`, optionally `SEPOLIA_RPC_URL`.
- **Optional:** `ETHERSCAN_API_KEY` (verify contract), `USDC_ADDRESS` (use existing USDC).
- Details: [arena-race/docs/ENV_SETUP.md](arena-race/docs/ENV_SETUP.md) or project docs.

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

**Backend (from `arena-race/backend/`):**

| Command | Description |
|---------|-------------|
| `npm test` | All backend tests. |
| `npm test -- --testPathPattern=replay` | Replay tests only. |
| `npm test -- --testPathPattern=run1000Matches` | 1,000-match simulation only. |

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
