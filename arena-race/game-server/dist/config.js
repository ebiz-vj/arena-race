"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.getEscrowAddress = getEscrowAddress;
/**
 * Game server config from environment.
 * If ESCROW_ADDRESS is not set, try to read from webapp's deployed-local.json (dev:all).
 */
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function loadEscrowFromDeployedFile() {
    const candidates = [
        path_1.default.join(process.cwd(), "webapp", "public", "deployed-local.json"),
        path_1.default.join(process.cwd(), "..", "webapp", "public", "deployed-local.json"),
        path_1.default.join(__dirname, "..", "..", "webapp", "public", "deployed-local.json"),
        path_1.default.join(__dirname, "..", "..", "..", "webapp", "public", "deployed-local.json"),
    ];
    for (const p of candidates) {
        try {
            if (fs_1.default.existsSync(p)) {
                const raw = fs_1.default.readFileSync(p, "utf8");
                const data = JSON.parse(raw);
                if (data.escrow && typeof data.escrow === "string") {
                    return data.escrow;
                }
            }
        }
        catch {
            // ignore
        }
    }
    return "";
}
/** Escrow address: from env, or re-read from webapp deployed-local.json on every use so deploy:localhost is always picked up. */
function getEscrowAddress() {
    const envEscrow = process.env.ESCROW_ADDRESS ?? "";
    if (envEscrow)
        return envEscrow;
    return loadEscrowFromDeployedFile();
}
exports.config = {
    port: parseInt(process.env.PORT ?? "3000", 10),
    chainRpcUrl: process.env.CHAIN_RPC_URL ?? "http://127.0.0.1:8545",
    get escrowAddress() {
        return getEscrowAddress();
    },
    signerUrl: process.env.SIGNER_URL ?? "http://127.0.0.1:3344",
    dbPath: process.env.DB_PATH ?? path_1.default.join(process.cwd(), "data", "arena.db"),
};
