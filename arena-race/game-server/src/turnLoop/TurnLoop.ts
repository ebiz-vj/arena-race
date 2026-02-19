/**
 * Authoritative turn loop. TDD §4.1–4.4, Plan G5.
 * Every 6s resolve turn; persist; 5 min max.
 */
import type { MatchState, PlayerAction } from "arena-race-backend";
import {
  createInitialState,
  resolveTurn,
  resolveAction,
  computePlacement,
} from "arena-race-backend";
import type Database from "better-sqlite3";
import { DEFAULT_START, DEFAULT_BOARD, TURN_MS, MATCH_MAX_MS } from "./constants";
import { matches as matchesDb, turns as turnsDb } from "../db";
import { submitResult } from "../resultSubmit";

/** Key: matchId -> running match data */
interface RunningMatch {
  state: MatchState;
  turnStartTimeMs: number;
  matchStartTimeMs: number;
  actions: Map<string, PlayerAction>; // "turnIndex:playerIndex" -> action
}

const runningMatches = new Map<string, RunningMatch>();

function actionKey(turnIndex: number, playerIndex: number): string {
  return `${turnIndex}:${playerIndex}`;
}

export function startMatch(
  db: Database.Database,
  matchId: string
): { ok: boolean; error?: string } {
  if (runningMatches.has(matchId)) {
    return { ok: false, error: "match already running" };
  }
  const boardConfig = { trapTiles: [...DEFAULT_BOARD.trapTiles] };
  const startPositions = [
    [...DEFAULT_START[0]],
    [...DEFAULT_START[1]],
    [...DEFAULT_START[2]],
    [...DEFAULT_START[3]],
  ] as MatchState["tokenPositions"];
  const state = createInitialState(boardConfig, startPositions);
  const now = Date.now();
  runningMatches.set(matchId, {
    state,
    turnStartTimeMs: now,
    matchStartTimeMs: now,
    actions: new Map(),
  });
  matchesDb.updateMatchStatus(db, matchId, "in_progress", { started_at: Math.floor(now / 1000) });
  return { ok: true };
}

/** Idempotent: store action for this turn and player. */
export function submitAction(
  matchId: string,
  turnIndex: number,
  playerIndex: number,
  moves: [number, number, number],
  receivedAtMs: number
): { ok: boolean; error?: string } {
  const run = runningMatches.get(matchId);
  if (!run) return { ok: false, error: "match not running" };
  if (turnIndex !== run.state.turnIndex) {
    return { ok: false, error: "wrong turn index" };
  }
  const deadline = run.turnStartTimeMs + TURN_MS;
  if (receivedAtMs > deadline) {
    return { ok: false, error: "turn deadline passed" };
  }
  const key = actionKey(turnIndex, playerIndex);
  run.actions.set(key, { moves });
  return { ok: true };
}

export function getMatchState(matchId: string): MatchState | null {
  const run = runningMatches.get(matchId);
  return run ? run.state : null;
}

export function getTurnDeadline(matchId: string): number | null {
  const run = runningMatches.get(matchId);
  return run ? run.turnStartTimeMs + TURN_MS : null;
}

/** Called periodically; resolve due turns and end match when 5 min or last turn. */
export function tick(db: Database.Database): void {
  const now = Date.now();
  for (const [matchId, run] of runningMatches.entries()) {
    const elapsed = now - run.matchStartTimeMs;
    if (elapsed >= MATCH_MAX_MS) {
      endMatch(db, matchId, run);
      runningMatches.delete(matchId);
      continue;
    }
    const deadline = run.turnStartTimeMs + TURN_MS;
    if (now < deadline) continue;

    // Resolve this turn
    const state = run.state;
    const actions: [PlayerAction, PlayerAction, PlayerAction, PlayerAction] = [
      resolveAction(
        run.actions.get(actionKey(state.turnIndex, 0)) ?? null,
        now,
        run.turnStartTimeMs,
        state.tokenPositions,
        0
      ),
      resolveAction(
        run.actions.get(actionKey(state.turnIndex, 1)) ?? null,
        now,
        run.turnStartTimeMs,
        state.tokenPositions,
        1
      ),
      resolveAction(
        run.actions.get(actionKey(state.turnIndex, 2)) ?? null,
        now,
        run.turnStartTimeMs,
        state.tokenPositions,
        2
      ),
      resolveAction(
        run.actions.get(actionKey(state.turnIndex, 3)) ?? null,
        now,
        run.turnStartTimeMs,
        state.tokenPositions,
        3
      ),
    ];
    const nextState = resolveTurn(state, actions);

    // Persist turn
    turnsDb.insertTurn(db, {
      match_id: matchId,
      turn_index: state.turnIndex,
      state_before: JSON.stringify(state),
      actions: JSON.stringify(actions),
      state_after: JSON.stringify(nextState),
      scores_after: JSON.stringify(nextState.scores),
    });

    run.state = nextState;
    run.turnStartTimeMs = now;
    run.actions.clear();

    // End after 15 turns (or could use DEFAULT_TURNS_PER_MATCH)
    if (nextState.turnIndex >= 15) {
      endMatch(db, matchId, run);
      runningMatches.delete(matchId);
    }
  }
}

function endMatch(
  db: Database.Database,
  matchId: string,
  run: RunningMatch
): void {
  const placement = computePlacement(run.state.scores, run.state.overtakeCounts);
  const now = Date.now();
  matchesDb.updateMatchStatus(db, matchId, "finalized", {
    ended_at: Math.floor(now / 1000),
    final_placement: JSON.stringify(placement),
  });
  submitResult(matchId, placement).then((r) => {
    if (!r.ok) console.error("submitResult failed:", matchId, r.error);
  }).catch((e) => console.error("submitResult error:", e));
}
