/**
 * Turn timer. TDD §4.3: turnDeadline = turnStartTime + 6000 ms.
 * Accept action only if receivedAt <= turnDeadline; late actions ignored; no grace.
 * Default action: no move, no ability (deterministic no-op).
 */
import type { PlayerAction } from "./types";
import { defaultAction } from "./types";
import type { TokenPositions } from "./types";

export const TURN_WINDOW_MS = 6000;

/**
 * Returns whether the action was received before the turn deadline.
 */
export function isActionOnTime(receivedAtMs: number, turnDeadlineMs: number): boolean {
  return receivedAtMs <= turnDeadlineMs;
}

/**
 * Resolve effective action: use submitted if on time, else default (no-op).
 */
export function resolveAction(
  submitted: PlayerAction | null,
  receivedAtMs: number,
  turnStartTimeMs: number,
  currentPositions: TokenPositions,
  playerIndex: number
): PlayerAction {
  const turnDeadlineMs = turnStartTimeMs + TURN_WINDOW_MS;
  if (submitted != null && isActionOnTime(receivedAtMs, turnDeadlineMs)) {
    return submitted;
  }
  return defaultAction(currentPositions[playerIndex]);
}
