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
  try {
    const row = await contract.matches(matchIdHex);
    status = Number(row.status ?? row[5]);
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
    if (nowSeconds > entryDeadlineSec) {
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
    const row = await contract.matches(matchIdHex);
    const status = Number(row.status ?? row[5]);
    const entryDeadline = Number(row.entryDeadline ?? row[7] ?? 0);
    return { status, entryDeadline };
  } catch {
    return null;
  }
}
