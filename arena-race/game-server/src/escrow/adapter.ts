/**
 * Escrow adapter: read match status from chain. TDD §7.7, Plan G4.
 * Used to decide when to start turn loop (only when Escrowed).
 */
import { Contract, JsonRpcProvider } from "ethers";
import { ESCROW_MATCHES_ABI } from "./abi";

export enum EscrowMatchStatus {
  PendingEntries = 0,
  Escrowed = 1,
  Expired = 2,
  Refunded = 3,
  Resolved = 4,
}

export interface EntryFlowOutcome {
  shouldStart: boolean;
  reason?: "pending_entries" | "expired" | "refunded" | "past_deadline";
  triggerRefund?: boolean;
}

type MatchRow = {
  status?: unknown;
  entryDeadline?: unknown;
  entriesReceived?: unknown;
  poolAmount?: unknown;
  playerWallets?: unknown;
  [k: number]: unknown;
};

function pickField(row: MatchRow, keys: Array<string | number>): unknown {
  for (const key of keys) {
    const value =
      typeof key === "number" ? row[key] : row[key as keyof MatchRow];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function toNumberSafe(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function toBigIntSafe(value: unknown, fallback: bigint = 0n): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && value.trim() !== "") {
    try {
      return BigInt(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function extractStatus(row: MatchRow): number {
  // Current ABI layout (8 outputs): status at index 5.
  // Backward fallbacks cover older local builds that used 9/12-field assumptions.
  return toNumberSafe(pickField(row, ["status", 5, 6, 9]));
}

function extractEntryDeadline(row: MatchRow): number {
  // Current ABI layout (8 outputs): entryDeadline at index 7.
  return toNumberSafe(pickField(row, ["entryDeadline", 7, 8, 11]));
}

function extractEntriesReceived(row: MatchRow): number {
  // Current ABI layout (8 outputs): entriesReceived at index 4.
  return toNumberSafe(pickField(row, ["entriesReceived", 4, 5, 8]));
}

function extractPoolAmount(row: MatchRow): bigint {
  return toBigIntSafe(pickField(row, ["poolAmount", 3]), 0n);
}

function extractPlayerWallets(row: MatchRow): string[] {
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

export async function checkEntryFlow(
  rpcUrl: string,
  escrowAddress: string,
  matchIdHex: string,
  entryDeadlineSec: number,
  nowSeconds: number
): Promise<EntryFlowOutcome> {
  if (!escrowAddress || !matchIdHex.startsWith("0x")) {
    return { shouldStart: false, reason: "pending_entries" };
  }
  const provider = new JsonRpcProvider(rpcUrl);
  const contract = new Contract(escrowAddress, ESCROW_MATCHES_ABI, provider);
  let status: number;
  let chainEntryDeadlineSec = 0;
  try {
    const row = (await contract.matches(matchIdHex)) as MatchRow;
    status = extractStatus(row);
    chainEntryDeadlineSec = extractEntryDeadline(row);
  } catch (e) {
    console.warn("[escrow] checkEntryFlow: contract.matches failed", (e as Error)?.message);
    return { shouldStart: false, reason: "pending_entries" };
  }

  if (status === EscrowMatchStatus.Escrowed) {
    return { shouldStart: true };
  }
  console.warn(
    "[escrow] checkEntryFlow: match not startable — status from chain:",
    status,
    "(0=Pending,1=Escrowed,2=Expired,3=Refunded,4=Resolved). If page shows Escrowed but server sees 0, set game-server .env ESCROW_ADDRESS to the escrow on the page."
  );
  if (status === EscrowMatchStatus.Expired || status === EscrowMatchStatus.Refunded) {
    return {
      shouldStart: false,
      reason: status === EscrowMatchStatus.Expired ? "expired" : "refunded",
    };
  }
  if (status === EscrowMatchStatus.PendingEntries) {
    const effectiveDeadlineSec =
      chainEntryDeadlineSec > 0 ? chainEntryDeadlineSec : entryDeadlineSec;
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
export async function getMatchInfoFromChain(
  rpcUrl: string,
  escrowAddress: string,
  matchIdHex: string
): Promise<{ status: number; entryDeadline: number } | null> {
  if (!escrowAddress || !matchIdHex.startsWith("0x")) return null;
  try {
    const provider = new JsonRpcProvider(rpcUrl);
    const contract = new Contract(escrowAddress, ESCROW_MATCHES_ABI, provider);
    const row = (await contract.matches(matchIdHex)) as MatchRow;
    const status = extractStatus(row);
    const entryDeadline = extractEntryDeadline(row);
    return { status, entryDeadline };
  } catch {
    return null;
  }
}

const STATUS_NAMES: Record<number, string> = {
  0: "PendingEntries",
  1: "Escrowed",
  2: "Expired",
  3: "Refunded",
  4: "Resolved",
};

/** Full match status from chain for UI display (Match status section). */
export async function getMatchStatusFromChain(
  rpcUrl: string,
  escrowAddress: string,
  matchIdHex: string
): Promise<{
  status: number;
  statusName: string;
  entriesReceived: number;
  poolAmount: string;
  entryDeadline: number;
  playerWallets: string[];
} | null> {
  if (!escrowAddress || !matchIdHex.startsWith("0x")) return null;
  try {
    const provider = new JsonRpcProvider(rpcUrl);
    const contract = new Contract(escrowAddress, ESCROW_MATCHES_ABI, provider);
    const row = (await contract.matches(matchIdHex)) as MatchRow;
    const entryDeadline = extractEntryDeadline(row);
    if (entryDeadline === 0) return null;
    const status = extractStatus(row);
    const entriesReceived = extractEntriesReceived(row);
    const poolAmount = extractPoolAmount(row);
    const playerWallets = extractPlayerWallets(row);
    const { formatUnits } = await import("ethers");
    return {
      status,
      statusName: STATUS_NAMES[status] ?? "?",
      entriesReceived,
      poolAmount: formatUnits(poolAmount, 6),
      entryDeadline,
      playerWallets: playerWallets.length === 4 ? playerWallets : [],
    };
  } catch (e) {
    console.warn("[getMatchStatusFromChain] failed:", (e as Error)?.message, "| escrow:", escrowAddress?.slice(0, 10) + "…", "| rpc:", rpcUrl?.slice(0, 30) + "…");
    return null;
  }
}
