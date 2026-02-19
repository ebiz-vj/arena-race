/**
 * Arena Race Match Engine — Types
 * TDD §5.1, §6.2. Pure state and actions; no DB, no blockchain.
 */

export const BOARD_ROWS = 7;
export const BOARD_COLS = 7;
export const TILES = BOARD_ROWS * BOARD_COLS; // 49
export const PLAYERS = 4;
export const TOKENS_PER_PLAYER = 3;
export const OVERTAKE_CAP_PER_PLAYER = 8;
export const OVERTAKE_POINTS = 4;
export const SURVIVAL_CAP = 75;
export const SURVIVAL_POINTS_PER_SAFE = 0.5;
export const POSITION_COEFF = 0.13;
export const ZONE_POINTS_PER_CONTESTED = 2;

/** Tile index = row * 7 + col (0-based, row-major). TDD §5.5 */
export function tileIndex(row: number, col: number): number {
  return row * BOARD_COLS + col;
}

export function rowCol(tile: number): { row: number; col: number } {
  return { row: Math.floor(tile / BOARD_COLS), col: tile % BOARD_COLS };
}

/** Per-player running scores. TDD §6.2 */
export interface PlayerScores {
  positionPoints: number;
  zonePoints: number;
  overtakePoints: number;
  survivalPoints: number; // before match cap; cap applied at ranking
  total: number;
}

/** Overtake count per player (match total, cap 8). TDD §5.5 */
export type OvertakeCounts = [number, number, number, number];

/** Token positions: tokenPositions[playerIndex][tokenIndex] = tileIndex (0..48), or -1 if eliminated */
export type TokenPositions = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number]
];

/** Board config: which tile indices are traps (Board A). */
export interface BoardConfig {
  trapTiles: number[];
}

/** Match state at a point in time. Immutable inputs for resolveTurn. */
export interface MatchState {
  turnIndex: number;
  tokenPositions: TokenPositions;
  scores: [PlayerScores, PlayerScores, PlayerScores, PlayerScores];
  overtakeCounts: OvertakeCounts;
  boardConfig: BoardConfig;
}

/** One player's action for the turn: target tile index for each of 3 tokens. No-op = same tile. */
export interface PlayerAction {
  moves: [number, number, number]; // target tileIndex for token 0, 1, 2
}

/** Default no-op action: all tokens stay in place. TDD §4.3 */
export function defaultAction(currentPositions: [number, number, number]): PlayerAction {
  return { moves: [...currentPositions] };
}

/** Create initial state: tokens at starting positions, zero scores. */
export function createInitialState(boardConfig: BoardConfig, startPositions: TokenPositions): MatchState {
  const zero: PlayerScores = {
    positionPoints: 0,
    zonePoints: 0,
    overtakePoints: 0,
    survivalPoints: 0,
    total: 0,
  };
  const tokenPositions: TokenPositions = [
    [startPositions[0][0], startPositions[0][1], startPositions[0][2]],
    [startPositions[1][0], startPositions[1][1], startPositions[1][2]],
    [startPositions[2][0], startPositions[2][1], startPositions[2][2]],
    [startPositions[3][0], startPositions[3][1], startPositions[3][2]],
  ];
  return {
    turnIndex: 0,
    tokenPositions,
    scores: [ { ...zero }, { ...zero }, { ...zero }, { ...zero } ],
    overtakeCounts: [0, 0, 0, 0],
    boardConfig,
  };
}
