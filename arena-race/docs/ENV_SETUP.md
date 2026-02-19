# How to create `arena-race/.env`

The `.env` file holds **secrets and config** for deploying to Sepolia. Only **one** variable comes from Etherscan; the rest come from your wallet or from RPC providers.

---

## Quick setup

1. Copy the example file:
   ```bash
   cd arena-race
   copy .env.example .env
   ```
   (On macOS/Linux: `cp .env.example .env`)

2. Edit `.env` and set at least:
   - `DEPLOYER_PRIVATE_KEY`
   - `SEPOLIA_RPC_URL`

3. **Do not commit `.env`** — it is listed in `.gitignore`.  
   Hardhat loads `.env` automatically (via `dotenv`) when you run `npx hardhat` or `npm run deploy:sepolia`.

---

## Where each variable comes from

| Variable | Required? | Source | Notes |
|----------|-----------|--------|--------|
| **DEPLOYER_PRIVATE_KEY** | Yes (for deploy) | **Your wallet** | Not from Etherscan. The private key of the wallet that will deploy and pay gas. |
| **SEPOLIA_RPC_URL** | Yes (for deploy) | **RPC provider or public endpoint** | Not from Etherscan. See below. |
| **ETHERSCAN_API_KEY** | No (optional) | **Etherscan** | Only for automated contract verification. Get it from [Etherscan API dashboard](https://etherscan.io/apidashboard). |

---

### 1. `DEPLOYER_PRIVATE_KEY` — from your wallet

- **Do not** get this from Etherscan or any website.
- It is the **private key** of the Ethereum account that will deploy the contract and spend Sepolia ETH for gas.
- **Ways to get it:**
  - **MetaMask:** Account menu (three dots) → “Account details” → “Show private key” (or “Export Private Key”). Use a **test** account, not a mainnet account with real funds.
  - **New wallet:** Use Hardhat’s `npx hardhat console` and run `ethers.Wallet.createRandom()` to get a new address and private key; then send that address Sepolia ETH from a faucet.

Use a **test-only** wallet and only put Sepolia ETH on it.

---

### 2. `SEPOLIA_RPC_URL` — from an RPC provider (or public URL)

- **Not** from Etherscan. It is the HTTP URL of a node that talks to Sepolia.
- **Free options:**
  - **Public (no signup):**  
    `https://rpc.sepolia.org`
  - **Alchemy:** [alchemy.com](https://www.alchemy.com/) → Create app → choose “Sepolia” → copy “HTTPS” URL.
  - **Infura:** [infura.io](https://infura.io/) → Create project → choose “Sepolia” → copy endpoint URL.
  - **QuickNode:** [quicknode.com](https://www.quicknode.com/) → Create endpoint → Sepolia → copy HTTP URL.

For most use cases, `https://rpc.sepolia.org` is enough.

---

### 3. `ETHERSCAN_API_KEY` — from Etherscan (only for verification)

- **Only this one** comes from Etherscan.
- **When you need it:** If you use a **script** or **plugin** that verifies the contract on Etherscan automatically. For **manual** “Verify and Publish” on [Sepolia Etherscan](https://sepolia.etherscan.io), you do **not** need this key.
- **How to get it:**
  1. Go to [Etherscan](https://etherscan.io) and sign in (or create an account).
  2. Open the [API dashboard](https://etherscan.io/apidashboard).
  3. Create an API key (free tier is enough).
  4. Copy the key and set in `.env`:  
     `ETHERSCAN_API_KEY=YourApiKeyToken`

---

## Example `.env` (minimal for deploy)

```env
DEPLOYER_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
SEPOLIA_RPC_URL=https://rpc.sepolia.org
```

That is enough to run `npm run deploy:sepolia`. Add `ETHERSCAN_API_KEY` only if you use automated verification; add the optional variables (e.g. `USDC_ADDRESS`, `TREASURY_ADDRESS`) only if you need them.

---

## Security

- Never commit `.env` or share your private key.
- Use a **dedicated test wallet** for Sepolia with no mainnet funds.
- Keep `.env` in `.gitignore`.
