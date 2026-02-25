/**
 * After match formation, assign matchId + entry_deadline to the 4 players
 * so they can poll and see "match found".
 */
export interface MatchAssignment {
  matchId: string;
  entryDeadline: number; // Unix ms
}

const assignmentsByWallet = new Map<string, MatchAssignment>();
const ASSIGNMENT_STALE_GRACE_MS = 30_000;

function isStale(assignment: MatchAssignment, nowMs: number): boolean {
  return nowMs > assignment.entryDeadline + ASSIGNMENT_STALE_GRACE_MS;
}

export function setAssignment(wallet: string, matchId: string, entryDeadline: number): void {
  assignmentsByWallet.set(wallet.toLowerCase(), { matchId, entryDeadline });
}

export function getAssignment(wallet: string): MatchAssignment | null {
  const key = wallet.toLowerCase();
  const assignment = assignmentsByWallet.get(key);
  if (!assignment) return null;
  if (isStale(assignment, Date.now())) {
    assignmentsByWallet.delete(key);
    return null;
  }
  return assignment;
}

export function clearAssignment(wallet: string): void {
  assignmentsByWallet.delete(wallet.toLowerCase());
}

/** Remove expired assignments so stale matches don't leak into new queue sessions. */
export function clearExpiredAssignments(nowMs: number = Date.now()): void {
  for (const [wallet, assignment] of assignmentsByWallet.entries()) {
    if (isStale(assignment, nowMs)) {
      assignmentsByWallet.delete(wallet);
    }
  }
}

/** Clear all match assignments (for Reset everything in local dev). */
export function clearAllAssignments(): void {
  assignmentsByWallet.clear();
}

export function setAssignmentsForMatch(wallets: string[], matchId: string, entryDeadline: number): void {
  for (const w of wallets) {
    setAssignment(w, matchId, entryDeadline);
  }
}
