/**
 * Game server config from environment.
 * If ESCROW_ADDRESS is not set, try to read from webapp's deployed-local.json (dev:all).
 */
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

function loadEscrowFromDeployedFile(): string {
  const candidates = [
    path.join(process.cwd(), "webapp", "public", "deployed-local.json"),
    path.join(process.cwd(), "..", "webapp", "public", "deployed-local.json"),
    path.join(__dirname, "..", "..", "webapp", "public", "deployed-local.json"),
    path.join(__dirname, "..", "..", "..", "webapp", "public", "deployed-local.json"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf8");
        const data = JSON.parse(raw) as { escrow?: string };
        if (data.escrow && typeof data.escrow === "string") {
          return data.escrow;
        }
      }
    } catch {
      // ignore
    }
  }
  return "";
}

/** Escrow address: from env, or re-read from webapp deployed-local.json on every use so deploy:localhost is always picked up. */
export function getEscrowAddress(): string {
  const envEscrow = process.env.ESCROW_ADDRESS ?? "";
  if (envEscrow) return envEscrow;
  return loadEscrowFromDeployedFile();
}

export const config = {
  port: parseInt(process.env.PORT ?? "3000", 10),
  chainRpcUrl: process.env.CHAIN_RPC_URL ?? "http://127.0.0.1:8545",
  get escrowAddress(): string {
    return getEscrowAddress();
  },
  signerUrl: process.env.SIGNER_URL ?? "http://127.0.0.1:3344",
  dbPath: process.env.DB_PATH ?? path.join(process.cwd(), "data", "arena.db"),
};
