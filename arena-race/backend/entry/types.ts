/**
 * Entry flow types. TDD §7.7, §3.4.
 * Match status aligned with contract enum (PendingEntries=0, Escrowed=1, Expired=2, Refunded=3, Resolved=4).
 */
export const ENTRY_WINDOW_SEC = 300;

export enum EscrowMatchStatus {
  PendingEntries = 0,
  Escrowed = 1,
  Expired = 2,
  Refunded = 3,
  Resolved = 4,
}

export interface MatchRecord {
  matchId: string;
  tier: "bronze-10" | "bronze-25";
  entryDeadline: number; // Unix timestamp
  status: "pending_entries" | "escrowed" | "expired" | "refunded" | "in_progress" | "finalized" | "result_submitted";
  playerWallets: [string, string, string, string];
  createdAt: number;
}

/** Adapter to read/write escrow contract. Allows mock for tests. */
export interface IEscrowAdapter {
  getMatchStatus(matchIdHex: string): Promise<EscrowMatchStatus>;
  createMatch(matchIdHex: string, entryAmountWei: string): Promise<void>;
  expireMatch(matchIdHex: string): Promise<void>;
}
