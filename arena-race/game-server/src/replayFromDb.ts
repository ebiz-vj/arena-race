/**
 * Replay from DB: load match_turns, run backend replayMatch. TDD §13, Plan G11.
 */
import { replayMatch, type StoredTurn } from "arena-race-backend";
import { getDbInstance } from "./db";
import { matches as matchesDb } from "./db";
import { turns as turnsDb } from "./db";

export interface ReplayFromDbResult {
  match: boolean;
  message?: string;
  storedPlacement?: [number, number, number, number];
  replayedPlacement?: [number, number, number, number];
}

export function replayMatchFromDb(matchId: string): ReplayFromDbResult {
  const db = getDbInstance();
  if (!db) return { match: false, message: "db not available" };

  const match = matchesDb.getMatchByMatchId(db, matchId);
  if (!match) return { match: false, message: "match not found" };
  if (!match.final_placement) return { match: false, message: "match has no final placement" };

  const turnRows = turnsDb.getTurnsByMatchId(db, matchId);
  if (turnRows.length === 0) return { match: false, message: "no turns stored" };

  const storedPlacement = JSON.parse(match.final_placement) as [number, number, number, number];
  const turns: StoredTurn[] = turnRows.map((row) => ({
    turnIndex: row.turn_index,
    stateBefore: JSON.parse(row.state_before),
    actions: JSON.parse(row.actions),
    stateAfter: JSON.parse(row.state_after),
  }));

  const result = replayMatch(turns, storedPlacement);
  return {
    match: result.match,
    message: result.message,
    storedPlacement: result.storedPlacement ?? undefined,
    replayedPlacement: result.replayedPlacement ?? undefined,
  };
}
