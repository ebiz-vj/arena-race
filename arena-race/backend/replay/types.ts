/**
 * Replay types. TDD §13.
 */
import type { MatchState, PlayerAction } from "../engine/types";

export interface StoredTurn {
  turnIndex: number;
  stateBefore: MatchState;
  actions: [PlayerAction, PlayerAction, PlayerAction, PlayerAction];
  stateAfter: MatchState;
}

export interface ReplayResult {
  match: boolean;
  finalState: MatchState | null;
  storedPlacement: [number, number, number, number] | null;
  replayedPlacement: [number, number, number, number] | null;
  message?: string;
}
