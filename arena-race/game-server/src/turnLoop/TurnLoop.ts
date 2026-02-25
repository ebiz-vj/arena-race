/**
 * Authoritative turn loop. TDD §4.1–4.4, Plan G5.
 * Manual local-testing mode: no timer; resolve when all 4 submitted
 * or when /match/resolve-turn is called.
 */
import type { MatchState, PlayerAction } from "arena-race-backend";
import {
  createInitialState,
  resolveTurn,
  defaultAction,
  computePlacement,
} from "arena-race-backend";
import type Database from "better-sqlite3";
import { DEFAULT_START, DEFAULT_BOARD, DEFAULT_TURNS_PER_MATCH } from "./constants";
import { matches as matchesDb, turns as turnsDb } from "../db";
import { submitResult } from "../resultSubmit";

/** Key: matchId -> running match data */
interface RunningMatch {
  state: MatchState;
  actions: Map<string, { action: PlayerAction; receivedAtMs: number }>; // "turnIndex:playerIndex" -> action envelope
}

const runningMatches = new Map<string, RunningMatch>();

function actionKey(turnIndex: number, playerIndex: number): string {
  return `${turnIndex}:${playerIndex}`;
}

function isLegalStep(currentTile: number, targetTile: number): boolean {
  if (targetTile === currentTile) return true;
  const currentRow = Math.floor(currentTile / 7);
  const currentCol = currentTile % 7;
  const targetRow = Math.floor(targetTile / 7);
  const targetCol = targetTile % 7;
  const rowAdvance = currentRow - targetRow; // toward finish = row decreases
  if (rowAdvance < 0 || rowAdvance > 2) return false; // no backward move; max 2 rows
  if (Math.abs(targetCol - currentCol) > 1) return false; // max 1 column sideways
  return true;
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
): { ok: boolean; error?: string; expectedTurnIndex?: number } {
  const run = runningMatches.get(matchId);
  if (!run) return { ok: false, error: "match not running" };
  const currentTurn = run.state.turnIndex;
  if (turnIndex !== currentTurn) {
    return {
      ok: false,
      error: `wrong turn index (expected ${currentTurn}, got ${turnIndex})`,
      expectedTurnIndex: currentTurn,
    };
  }
  if (playerIndex < 0 || playerIndex > 3) {
    return { ok: false, error: "invalid player index" };
  }
  const currentPositions = run.state.tokenPositions[playerIndex];
  const normalizedMoves: [number, number, number] = [0, 0, 0];
  for (let token = 0; token < 3; token++) {
    const currentTile = currentPositions[token];
    const targetTile = moves[token];
    if (currentTile < 0) {
      // Eliminated tokens stay eliminated regardless of submitted target.
      normalizedMoves[token] = -1;
      continue;
    }
    if (!Number.isInteger(targetTile) || targetTile < 0 || targetTile > 48) {
      return { ok: false, error: `invalid move for token ${token}; expected integer tile 0..48` };
    }
    if (!isLegalStep(currentTile, targetTile)) {
      return {
        ok: false,
        error: `illegal move for token ${token}; from ${currentTile} you may stay or move up 1-2 rows with at most 1 column shift`,
      };
    }
    normalizedMoves[token] = targetTile;
  }
  const key = actionKey(currentTurn, playerIndex);
  run.actions.set(key, { action: { moves: normalizedMoves }, receivedAtMs });
  return { ok: true };
}

export function getMatchState(matchId: string): MatchState | null {
  const run = runningMatches.get(matchId);
  return run ? run.state : null;
}

function submittedPlayersForRun(run: RunningMatch): number[] {
  const turnIndex = run.state.turnIndex;
  const submitted: number[] = [];
  for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
    if (run.actions.has(actionKey(turnIndex, playerIndex))) submitted.push(playerIndex);
  }
  return submitted;
}

function pendingPlayersFromSubmitted(submitted: number[]): number[] {
  return [0, 1, 2, 3].filter((p) => !submitted.includes(p));
}

export function getSubmittedPlayers(matchId: string): number[] {
  const run = runningMatches.get(matchId);
  if (!run) return [];
  return submittedPlayersForRun(run);
}

export function getTurnDeadline(_matchId: string): number | null {
  return null;
}

function actionsForCurrentTurn(run: RunningMatch): [PlayerAction, PlayerAction, PlayerAction, PlayerAction] {
  const state = run.state;
  const a0 = run.actions.get(actionKey(state.turnIndex, 0));
  const a1 = run.actions.get(actionKey(state.turnIndex, 1));
  const a2 = run.actions.get(actionKey(state.turnIndex, 2));
  const a3 = run.actions.get(actionKey(state.turnIndex, 3));
  return [
    a0?.action ?? defaultAction(state.tokenPositions[0]),
    a1?.action ?? defaultAction(state.tokenPositions[1]),
    a2?.action ?? defaultAction(state.tokenPositions[2]),
    a3?.action ?? defaultAction(state.tokenPositions[3]),
  ];
}

function resolveCurrentTurn(
  db: Database.Database,
  matchId: string,
  run: RunningMatch
): {
  ok: true;
  resolved: true;
  resolvedTurnIndex: number;
  nextTurnIndex: number;
  submittedPlayers: number[];
  pendingPlayers: number[];
} {
  const state = run.state;
  const submittedPlayers = submittedPlayersForRun(run);
  const actions = actionsForCurrentTurn(run);
  const nextState = resolveTurn(state, actions);

  turnsDb.insertTurn(db, {
    match_id: matchId,
    turn_index: state.turnIndex,
    state_before: JSON.stringify(state),
    actions: JSON.stringify(actions),
    state_after: JSON.stringify(nextState),
    scores_after: JSON.stringify(nextState.scores),
  });

  run.state = nextState;
  run.actions.clear();

  if (nextState.turnIndex >= DEFAULT_TURNS_PER_MATCH) {
    endMatch(db, matchId, run);
    runningMatches.delete(matchId);
  }

  return {
    ok: true,
    resolved: true,
    resolvedTurnIndex: state.turnIndex,
    nextTurnIndex: nextState.turnIndex,
    submittedPlayers,
    pendingPlayers: [],
  };
}

export function resolveTurnIfReady(
  db: Database.Database,
  matchId: string
): {
  ok: boolean;
  error?: string;
  resolved: boolean;
  resolvedTurnIndex?: number;
  nextTurnIndex?: number;
  submittedPlayers: number[];
  pendingPlayers: number[];
  turnIndex?: number;
} {
  const run = runningMatches.get(matchId);
  if (!run) {
    return {
      ok: false,
      error: "match not running",
      resolved: false,
      submittedPlayers: [],
      pendingPlayers: [0, 1, 2, 3],
    };
  }
  const submittedPlayers = submittedPlayersForRun(run);
  if (submittedPlayers.length < 4) {
    return {
      ok: true,
      resolved: false,
      submittedPlayers,
      pendingPlayers: pendingPlayersFromSubmitted(submittedPlayers),
      turnIndex: run.state.turnIndex,
    };
  }
  return resolveCurrentTurn(db, matchId, run);
}

/**
 * Resolve the current turn immediately using submitted actions.
 * Missing players default to no-op for this turn.
 */
export function resolveTurnNow(
  db: Database.Database,
  matchId: string
): {
  ok: boolean;
  error?: string;
  resolved: boolean;
  resolvedTurnIndex?: number;
  nextTurnIndex?: number;
  submittedPlayers: number[];
  pendingPlayers: number[];
  turnIndex?: number;
} {
  const run = runningMatches.get(matchId);
  if (!run) {
    return {
      ok: false,
      error: "match not running",
      resolved: false,
      submittedPlayers: [],
      pendingPlayers: [0, 1, 2, 3],
    };
  }
  const submittedPlayers = submittedPlayersForRun(run);
  if (submittedPlayers.length === 0) {
    return {
      ok: false,
      error: "no moves submitted for current turn",
      resolved: false,
      submittedPlayers,
      pendingPlayers: pendingPlayersFromSubmitted(submittedPlayers),
      turnIndex: run.state.turnIndex,
    };
  }
  return resolveCurrentTurn(db, matchId, run);
}

/** Timer-based turn resolution is disabled in manual local-testing mode. */
export function tick(_db: Database.Database): void {
  // Intentionally no-op.
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
