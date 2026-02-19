/**
 * After match formation, assign matchId + entry_deadline to the 4 players
 * so they can poll and see "match found".
 */
export interface MatchAssignment {
  matchId: string;
  entryDeadline: number; // Unix ms
}

const assignmentsByWallet = new Map<string, MatchAssignment>();

export function setAssignment(wallet: string, matchId: string, entryDeadline: number): void {
  assignmentsByWallet.set(wallet.toLowerCase(), { matchId, entryDeadline });
}

export function getAssignment(wallet: string): MatchAssignment | null {
  return assignmentsByWallet.get(wallet.toLowerCase()) ?? null;
}

export function clearAssignment(wallet: string): void {
  assignmentsByWallet.delete(wallet.toLowerCase());
}

export function setAssignmentsForMatch(wallets: string[], matchId: string, entryDeadline: number): void {
  for (const w of wallets) {
    setAssignment(w, matchId, entryDeadline);
  }
}
