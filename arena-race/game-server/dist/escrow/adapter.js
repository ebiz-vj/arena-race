"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscrowMatchStatus = void 0;
exports.checkEntryFlow = checkEntryFlow;
exports.getMatchInfoFromChain = getMatchInfoFromChain;
exports.getMatchStatusFromChain = getMatchStatusFromChain;
/**
 * Escrow adapter: read match status from chain. TDD §7.7, Plan G4.
 * Used to decide when to start turn loop (only when Escrowed).
 */
const ethers_1 = require("ethers");
const abi_1 = require("./abi");
var EscrowMatchStatus;
(function (EscrowMatchStatus) {
    EscrowMatchStatus[EscrowMatchStatus["PendingEntries"] = 0] = "PendingEntries";
    EscrowMatchStatus[EscrowMatchStatus["Escrowed"] = 1] = "Escrowed";
    EscrowMatchStatus[EscrowMatchStatus["Expired"] = 2] = "Expired";
    EscrowMatchStatus[EscrowMatchStatus["Refunded"] = 3] = "Refunded";
    EscrowMatchStatus[EscrowMatchStatus["Resolved"] = 4] = "Resolved";
})(EscrowMatchStatus || (exports.EscrowMatchStatus = EscrowMatchStatus = {}));
function pickField(row, keys) {
    for (const key of keys) {
        const value = typeof key === "number" ? row[key] : row[key];
        if (value !== undefined && value !== null)
            return value;
    }
    return undefined;
}
function toNumberSafe(value, fallback = 0) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value === "bigint")
        return Number(value);
    if (typeof value === "string" && value.trim() !== "") {
        const n = Number(value);
        if (Number.isFinite(n))
            return n;
    }
    return fallback;
}
function toBigIntSafe(value, fallback = 0n) {
    if (typeof value === "bigint")
        return value;
    if (typeof value === "number" && Number.isFinite(value)) {
        return BigInt(Math.trunc(value));
    }
    if (typeof value === "string" && value.trim() !== "") {
        try {
            return BigInt(value);
        }
        catch {
            return fallback;
        }
    }
    return fallback;
}
function extractStatus(row) {
    // Current ABI layout (8 outputs): status at index 5.
    // Backward fallbacks cover older local builds that used 9/12-field assumptions.
    return toNumberSafe(pickField(row, ["status", 5, 6, 9]));
}
function extractEntryDeadline(row) {
    // Current ABI layout (8 outputs): entryDeadline at index 7.
    return toNumberSafe(pickField(row, ["entryDeadline", 7, 8, 11]));
}
function extractEntriesReceived(row) {
    // Current ABI layout (8 outputs): entriesReceived at index 4.
    return toNumberSafe(pickField(row, ["entriesReceived", 4, 5, 8]));
}
function extractPoolAmount(row) {
    return toBigIntSafe(pickField(row, ["poolAmount", 3]), 0n);
}
function extractPlayerWallets(row) {
    // Newer ABI does not expose player wallets from the public mapping getter.
    const grouped = pickField(row, ["playerWallets", 4]);
    if (Array.isArray(grouped) && grouped.length === 4) {
        const normalized = grouped.map((w) => String(w));
        if (normalized.every((w) => /^0x[0-9a-fA-F]{40}$/.test(w))) {
            return normalized;
        }
    }
    // Legacy flattened layout fallback (older assumptions).
    const flat = [row[4], row[5], row[6], row[7]]
        .map((w) => (w == null ? "" : String(w)))
        .filter((w) => w.length > 0);
    if (flat.length === 4 && flat.every((w) => /^0x[0-9a-fA-F]{40}$/.test(w))) {
        return flat;
    }
    return [];
}
async function checkEntryFlow(rpcUrl, escrowAddress, matchIdHex, entryDeadlineSec, nowSeconds) {
    if (!escrowAddress || !matchIdHex.startsWith("0x")) {
        return { shouldStart: false, reason: "pending_entries" };
    }
    const provider = new ethers_1.JsonRpcProvider(rpcUrl);
    const contract = new ethers_1.Contract(escrowAddress, abi_1.ESCROW_MATCHES_ABI, provider);
    let status;
    let chainEntryDeadlineSec = 0;
    try {
        const row = (await contract.matches(matchIdHex));
        status = extractStatus(row);
        chainEntryDeadlineSec = extractEntryDeadline(row);
    }
    catch (e) {
        console.warn("[escrow] checkEntryFlow: contract.matches failed", e?.message);
        return { shouldStart: false, reason: "pending_entries" };
    }
    if (status === EscrowMatchStatus.Escrowed) {
        return { shouldStart: true };
    }
    console.warn("[escrow] checkEntryFlow: match not startable — status from chain:", status, "(0=Pending,1=Escrowed,2=Expired,3=Refunded,4=Resolved). If page shows Escrowed but server sees 0, set game-server .env ESCROW_ADDRESS to the escrow on the page.");
    if (status === EscrowMatchStatus.Expired || status === EscrowMatchStatus.Refunded) {
        return {
            shouldStart: false,
            reason: status === EscrowMatchStatus.Expired ? "expired" : "refunded",
        };
    }
    if (status === EscrowMatchStatus.PendingEntries) {
        const effectiveDeadlineSec = chainEntryDeadlineSec > 0 ? chainEntryDeadlineSec : entryDeadlineSec;
        if (nowSeconds > effectiveDeadlineSec) {
            return { shouldStart: false, reason: "expired", triggerRefund: true };
        }
        return { shouldStart: false, reason: "pending_entries" };
    }
    if (status === EscrowMatchStatus.Resolved) {
        return { shouldStart: false, reason: "refunded" };
    }
    return { shouldStart: false, reason: "pending_entries" };
}
/** Get match status and entryDeadline from chain (for legacy-created matches not in DB). */
async function getMatchInfoFromChain(rpcUrl, escrowAddress, matchIdHex) {
    if (!escrowAddress || !matchIdHex.startsWith("0x"))
        return null;
    try {
        const provider = new ethers_1.JsonRpcProvider(rpcUrl);
        const contract = new ethers_1.Contract(escrowAddress, abi_1.ESCROW_MATCHES_ABI, provider);
        const row = (await contract.matches(matchIdHex));
        const status = extractStatus(row);
        const entryDeadline = extractEntryDeadline(row);
        return { status, entryDeadline };
    }
    catch {
        return null;
    }
}
const STATUS_NAMES = {
    0: "PendingEntries",
    1: "Escrowed",
    2: "Expired",
    3: "Refunded",
    4: "Resolved",
};
/** Full match status from chain for UI display (Match status section). */
async function getMatchStatusFromChain(rpcUrl, escrowAddress, matchIdHex) {
    if (!escrowAddress || !matchIdHex.startsWith("0x"))
        return null;
    try {
        const provider = new ethers_1.JsonRpcProvider(rpcUrl);
        const contract = new ethers_1.Contract(escrowAddress, abi_1.ESCROW_MATCHES_ABI, provider);
        const row = (await contract.matches(matchIdHex));
        const entryDeadline = extractEntryDeadline(row);
        if (entryDeadline === 0)
            return null;
        const status = extractStatus(row);
        const entriesReceived = extractEntriesReceived(row);
        const poolAmount = extractPoolAmount(row);
        const playerWallets = extractPlayerWallets(row);
        const { formatUnits } = await Promise.resolve().then(() => __importStar(require("ethers")));
        return {
            status,
            statusName: STATUS_NAMES[status] ?? "?",
            entriesReceived,
            poolAmount: formatUnits(poolAmount, 6),
            entryDeadline,
            playerWallets: playerWallets.length === 4 ? playerWallets : [],
        };
    }
    catch (e) {
        console.warn("[getMatchStatusFromChain] failed:", e?.message, "| escrow:", escrowAddress?.slice(0, 10) + "…", "| rpc:", rpcUrl?.slice(0, 30) + "…");
        return null;
    }
}
