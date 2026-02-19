"use strict";
/**
 * Arena Race Match Engine — Types
 * TDD §5.1, §6.2. Pure state and actions; no DB, no blockchain.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZONE_POINTS_PER_CONTESTED = exports.POSITION_COEFF = exports.SURVIVAL_POINTS_PER_SAFE = exports.SURVIVAL_CAP = exports.OVERTAKE_POINTS = exports.OVERTAKE_CAP_PER_PLAYER = exports.TOKENS_PER_PLAYER = exports.PLAYERS = exports.TILES = exports.BOARD_COLS = exports.BOARD_ROWS = void 0;
exports.tileIndex = tileIndex;
exports.rowCol = rowCol;
exports.defaultAction = defaultAction;
exports.createInitialState = createInitialState;
exports.BOARD_ROWS = 7;
exports.BOARD_COLS = 7;
exports.TILES = exports.BOARD_ROWS * exports.BOARD_COLS; // 49
exports.PLAYERS = 4;
exports.TOKENS_PER_PLAYER = 3;
exports.OVERTAKE_CAP_PER_PLAYER = 8;
exports.OVERTAKE_POINTS = 4;
exports.SURVIVAL_CAP = 75;
exports.SURVIVAL_POINTS_PER_SAFE = 0.5;
exports.POSITION_COEFF = 0.13;
exports.ZONE_POINTS_PER_CONTESTED = 2;
/** Tile index = row * 7 + col (0-based, row-major). TDD §5.5 */
function tileIndex(row, col) {
    return row * exports.BOARD_COLS + col;
}
function rowCol(tile) {
    return { row: Math.floor(tile / exports.BOARD_COLS), col: tile % exports.BOARD_COLS };
}
/** Default no-op action: all tokens stay in place. TDD §4.3 */
function defaultAction(currentPositions) {
    return { moves: [...currentPositions] };
}
/** Create initial state: tokens at starting positions, zero scores. */
function createInitialState(boardConfig, startPositions) {
    const zero = {
        positionPoints: 0,
        zonePoints: 0,
        overtakePoints: 0,
        survivalPoints: 0,
        total: 0,
    };
    const tokenPositions = [
        [startPositions[0][0], startPositions[0][1], startPositions[0][2]],
        [startPositions[1][0], startPositions[1][1], startPositions[1][2]],
        [startPositions[2][0], startPositions[2][1], startPositions[2][2]],
        [startPositions[3][0], startPositions[3][1], startPositions[3][2]],
    ];
    return {
        turnIndex: 0,
        tokenPositions,
        scores: [{ ...zero }, { ...zero }, { ...zero }, { ...zero }],
        overtakeCounts: [0, 0, 0, 0],
        boardConfig,
    };
}
