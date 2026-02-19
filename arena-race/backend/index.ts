/**
 * Backend entry for game-server: engine, scoring, turn timer, replay.
 */
export {
  createInitialState,
  defaultAction,
  type MatchState,
  type PlayerAction,
  type BoardConfig,
  type TokenPositions,
  type PlayerScores,
  type OvertakeCounts,
} from "./engine/types";
export { resolveTurn } from "./engine/resolveTurn";
export { computePlacement } from "./engine/scoring";
export {
  resolveAction,
  isActionOnTime,
  TURN_WINDOW_MS,
} from "./engine/turnTimer";
export { replayMatch, replayMatchStrict } from "./replay/replay";
export type { StoredTurn, ReplayResult } from "./replay/types";
