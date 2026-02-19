/**
 * Entry flow: start match only when contract status = Escrowed. TDD §7.7, Step 8.
 * Server must never start turn loop for PendingEntries, Expired, or Refunded.
 */
import type { IEscrowAdapter } from "./types";
import { EscrowMatchStatus } from "./types";
import { ENTRY_WINDOW_SEC } from "./types";

export type EntryFlowOutcome =
  | { shouldStart: true }
  | { shouldStart: false; reason: "pending_entries" | "expired" | "refunded" | "past_deadline" }
  | { shouldStart: false; reason: "expired"; triggerRefund: true };

/**
 * Returns whether the match should start (turn loop) and whether to trigger refund.
 * Only when contract status === Escrowed should start be true.
 */
export async function checkEntryFlow(
  adapter: IEscrowAdapter,
  matchIdHex: string,
  entryDeadline: number,
  nowSeconds: number
): Promise<EntryFlowOutcome> {
  const status = await adapter.getMatchStatus(matchIdHex);

  if (status === EscrowMatchStatus.Escrowed) {
    return { shouldStart: true };
  }
  if (status === EscrowMatchStatus.Expired || status === EscrowMatchStatus.Refunded) {
    return { shouldStart: false, reason: status === EscrowMatchStatus.Expired ? "expired" : "refunded" };
  }
  if (status === EscrowMatchStatus.PendingEntries) {
    if (nowSeconds > entryDeadline) {
      return { shouldStart: false, reason: "expired", triggerRefund: true };
    }
    return { shouldStart: false, reason: "pending_entries" };
  }
  if (status === EscrowMatchStatus.Resolved) {
    return { shouldStart: false, reason: "refunded" };
  }
  return { shouldStart: false, reason: "pending_entries" };
}

/**
 * Compute entry deadline from match creation time. TDD §3.5.
 */
export function entryDeadlineFromCreatedAt(createdAtSeconds: number): number {
  return createdAtSeconds + ENTRY_WINDOW_SEC;
}
