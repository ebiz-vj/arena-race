/**
 * Replay tool. TDD §13.2, Step 14.
 * Load match_turns; re-run resolveTurn in sequence; compare final score/placement to stored result.
 */
import { resolveTurn } from "../engine/resolveTurn";
import { computePlacement } from "../engine/scoring";
import type { MatchState } from "../engine/types";
import type { StoredTurn, ReplayResult } from "./types";

/**
 * Replay from stored turns. Uses stateBefore of first turn as initial state.
 * Returns whether replayed final state/placement matches stored.
 */
export function replayMatch(
  turns: StoredTurn[],
  storedPlacement: [number, number, number, number]
): ReplayResult {
  if (turns.length === 0) {
    return {
      match: false,
      finalState: null,
      storedPlacement,
      replayedPlacement: null,
      message: "No turns",
    };
  }

  let state: MatchState = turns[0].stateBefore;
  for (const t of turns) {
    state = resolveTurn(state, t.actions);
  }

  const replayedPlacement = computePlacement(state.scores, state.overtakeCounts);

  const match =
    replayedPlacement[0] === storedPlacement[0] &&
    replayedPlacement[1] === storedPlacement[1] &&
    replayedPlacement[2] === storedPlacement[2] &&
    replayedPlacement[3] === storedPlacement[3];

  return {
    match,
    finalState: state,
    storedPlacement,
    replayedPlacement,
  };
}

/**
 * Replay and optionally compare state_after each turn (stricter check).
 */
export function replayMatchStrict(turns: StoredTurn[]): { match: boolean; firstMismatchTurn: number | null } {
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    const next = resolveTurn(t.stateBefore, t.actions);
    if (next.turnIndex !== t.stateAfter.turnIndex) return { match: false, firstMismatchTurn: i };
    if (JSON.stringify(next.scores) !== JSON.stringify(t.stateAfter.scores)) {
      return { match: false, firstMismatchTurn: i };
    }
  }
  return { match: true, firstMismatchTurn: null };
}
