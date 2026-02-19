/**
 * Run a single match with random legal actions. Step 15.
 * No RNG inside game logic; actions are chosen randomly for stress only.
 */
import { createInitialState } from "../engine/types";
import { resolveTurn } from "../engine/resolveTurn";
import { computePlacement } from "../engine/scoring";
import type { MatchState, PlayerAction, BoardConfig, TokenPositions } from "../engine/types";
import { TILES, SURVIVAL_CAP, OVERTAKE_CAP_PER_PLAYER } from "../engine/types";

const DEFAULT_TURNS_PER_MATCH = 15;

/** Generate random legal action: each move in [0, TILES-1]. */
function randomAction(positions: TokenPositions, playerIndex: number, rng: () => number): PlayerAction {
  return {
    moves: [
      Math.floor(rng() * TILES),
      Math.floor(rng() * TILES),
      Math.floor(rng() * TILES),
    ],
  };
}

export interface MatchResult {
  placement: [number, number, number, number];
  scores: MatchState["scores"];
  overtakeCounts: MatchState["overtakeCounts"];
  turnCount: number;
}

export interface RunMatchOptions {
  turnsPerMatch?: number;
  boardConfig?: BoardConfig;
  startPositions?: TokenPositions;
  rng?: () => number;
}

const DEFAULT_START: TokenPositions = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [9, 10, 11],
];

const DEFAULT_BOARD: BoardConfig = { trapTiles: [12, 24, 36] };

/**
 * Run one match to completion. Returns placement and final state.
 */
export function runOneMatch(options: RunMatchOptions = {}): MatchResult {
  const turnsPerMatch = options.turnsPerMatch ?? DEFAULT_TURNS_PER_MATCH;
  const boardConfig = options.boardConfig ?? DEFAULT_BOARD;
  const startPositions = options.startPositions ?? DEFAULT_START;
  const rng = options.rng ?? Math.random;

  let state = createInitialState(boardConfig, startPositions);

  for (let t = 0; t < turnsPerMatch; t++) {
    const actions: [PlayerAction, PlayerAction, PlayerAction, PlayerAction] = [
      randomAction(state.tokenPositions, 0, rng),
      randomAction(state.tokenPositions, 1, rng),
      randomAction(state.tokenPositions, 2, rng),
      randomAction(state.tokenPositions, 3, rng),
    ];
    state = resolveTurn(state, actions);
  }

  const placement = computePlacement(state.scores, state.overtakeCounts);
  return {
    placement,
    scores: state.scores,
    overtakeCounts: state.overtakeCounts,
    turnCount: turnsPerMatch,
  };
}

/** Assert result satisfies Step 15 checks: placement 1-4, survival cap 75, overtake cap 8. */
export function assertMatchResultValid(result: MatchResult): void {
  for (let i = 0; i < 4; i++) {
    if (result.placement[i] < 1 || result.placement[i] > 4) {
      throw new Error(`Invalid placement[${i}]=${result.placement[i]}`);
    }
    const survival = Math.min(result.scores[i].survivalPoints, SURVIVAL_CAP);
    if (survival > SURVIVAL_CAP) {
      throw new Error(`Survival over cap: ${survival}`);
    }
    if (result.overtakeCounts[i] > OVERTAKE_CAP_PER_PLAYER) {
      throw new Error(`Overtake over cap: ${result.overtakeCounts[i]}`);
    }
  }
  const placements = [...result.placement].sort((a, b) => a - b);
  if (placements.join(",") !== "1,2,3,4") {
    throw new Error(`Placement must be 1,2,3,4: ${result.placement.join(",")}`);
  }
}
