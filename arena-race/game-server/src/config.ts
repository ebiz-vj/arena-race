/**
 * Game server config from environment.
 * Document in README or ENV_SETUP.
 */
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? "3000", 10),
  chainRpcUrl: process.env.CHAIN_RPC_URL ?? "http://127.0.0.1:8545",
  escrowAddress: process.env.ESCROW_ADDRESS ?? "",
  signerUrl: process.env.SIGNER_URL ?? "http://127.0.0.1:3344",
  dbPath: process.env.DB_PATH ?? path.join(process.cwd(), "data", "arena.db"),
};
