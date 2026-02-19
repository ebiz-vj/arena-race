/**
 * Match turns persistence. TDD §11.3.
 * state_before, actions, state_after, scores_after stored as JSON.
 */
import type Database from "better-sqlite3";

export interface TurnRow {
  id: number;
  match_id: string;
  turn_index: number;
  state_before: string;
  actions: string;
  state_after: string;
  scores_after: string;
  created_at: number;
}

export function insertTurn(
  db: Database.Database,
  params: {
    match_id: string;
    turn_index: number;
    state_before: string;
    actions: string;
    state_after: string;
    scores_after: string;
  }
): number {
  const now = Date.now();
  const stmt = db.prepare(
    `INSERT INTO match_turns (match_id, turn_index, state_before, actions, state_after, scores_after, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    params.match_id,
    params.turn_index,
    params.state_before,
    params.actions,
    params.state_after,
    params.scores_after,
    now
  );
  return result.lastInsertRowid as number;
}

export function getTurnsByMatchId(db: Database.Database, matchId: string): TurnRow[] {
  const stmt = db.prepare(
    "SELECT * FROM match_turns WHERE match_id = ? ORDER BY turn_index ASC"
  );
  return stmt.all(matchId) as TurnRow[];
}
