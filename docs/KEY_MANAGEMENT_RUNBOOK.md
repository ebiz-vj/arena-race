# Key Management Runbook — Step 17

**Purpose:** Secure result signer and multisig; document rotation. TDD §3.11–3.12, §14.5–14.6.

---

## 1. Result Signer Key

- **Storage:** Result signer private key MUST be in an HSM or secret manager (e.g. AWS Secrets Manager, HashiCorp Vault). Not in application code or `.env` plaintext.
- **Access:** Backend reads the key at startup or per-request from the secret manager; no copy in repo or config files.
- **Rotation:** See §3 below.

---

## 2. Multisig Configuration

- **Roles:** Multisig (e.g. 2-of-3) is the contract **owner**.
- **Privileges:** Only the multisig can call:
  - `pause()` / `unpause()`
  - `setResultSigner(address)`
  - `createMatch(bytes32, uint256)` (if match creation is restricted to multisig)
  - `refundMatch(bytes32)` (optional; or authorized signer)
- **Keys:** Multisig signer keys are held by ops; not in the application or in the same store as the result signer.
- **Testnet:** Configure a 2-of-3 multisig on Sepolia and set it as owner before mainnet; run pause/unpause and setResultSigner once.

---

## 3. Signer Rotation (Dry Run on Testnet)

1. **Pre-rotation:** Ensure no Escrowed match is still pending result (or re-sign with new key if server supports it).
2. **Generate:** New EOA key pair; derive address.
3. **Update contract:** Multisig calls `setResultSigner(newAddress)` on testnet.
4. **Verify:** Run one test match: create match → 4 entries → Escrowed → finalize → sign result with **new** key → submitResult. Confirm payout succeeds.
5. **Rotate server:** Point backend to new key in secret manager; restart.
6. **Mainnet:** Repeat steps 2–5 on mainnet when rotating in production.

**Done when:** Keys secured in HSM/secret manager; multisig configured and tested; signer rotation dry run on testnet successful.
