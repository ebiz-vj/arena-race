/**
 * Match persistence. TDD §11.2.
 */
import type Database from "better-sqlite3";

export type MatchStatus =
  | "pending_entries"
  | "escrowed"
  | "expired"
  | "refunded"
  | "in_progress"
  | "finalized"
  | "result_submitted";

export interface MatchRow {
  id: number;
  match_id: string;
  tier: string;
  status: MatchStatus;
  entry_deadline: number;
  started_at: number | null;
  ended_at: number | null;
  final_placement: string | null;
  result_signature: string | null;
  contract_tx_hash: string | null;
  created_at: number;
}

export function createMatch(
  db: Database.Database,
  params: {
    match_id: string;
    tier: string;
    entry_deadline: number;
  }
): number {
  const now = Date.now();
  const stmt = db.prepare(
    `INSERT INTO matches (match_id, tier, status, entry_deadline, created_at)
     VALUES (?, ?, 'pending_entries', ?, ?)`
  );
  const result = stmt.run(params.match_id, params.tier, params.entry_deadline, now);
  return result.lastInsertRowid as number;
}

export function getMatchByMatchId(db: Database.Database, matchId: string): MatchRow | null {
  const stmt = db.prepare("SELECT * FROM matches WHERE match_id = ?");
  const row = stmt.get(matchId) as MatchRow | undefined;
  return row ?? null;
}

export function updateMatchStatus(
  db: Database.Database,
  matchId: string,
  status: MatchStatus,
  extra?: { started_at?: number; ended_at?: number; final_placement?: string; contract_tx_hash?: string }
): void {
  const updates: string[] = ["status = ?"];
  const values: (string | number | null)[] = [status];
  if (extra?.started_at !== undefined) {
    updates.push("started_at = ?");
    values.push(extra.started_at);
  }
  if (extra?.ended_at !== undefined) {
    updates.push("ended_at = ?");
    values.push(extra.ended_at);
  }
  if (extra?.final_placement !== undefined) {
    updates.push("final_placement = ?");
    values.push(extra.final_placement);
  }
  if (extra?.contract_tx_hash !== undefined) {
    updates.push("contract_tx_hash = ?");
    values.push(extra.contract_tx_hash);
  }
  values.push(matchId);
  const stmt = db.prepare(`UPDATE matches SET ${updates.join(", ")} WHERE match_id = ?`);
  stmt.run(...values);
}
