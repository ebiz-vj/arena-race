"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runOneMatch = runOneMatch;
exports.assertMatchResultValid = assertMatchResultValid;
/**
 * Run a single match with random legal actions. Step 15.
 * No RNG inside game logic; actions are chosen randomly for stress only.
 */
const types_1 = require("../engine/types");
const resolveTurn_1 = require("../engine/resolveTurn");
const scoring_1 = require("../engine/scoring");
const types_2 = require("../engine/types");
const DEFAULT_TURNS_PER_MATCH = 15;
/** Generate random legal action: each move in [0, TILES-1]. */
function randomAction(positions, playerIndex, rng) {
    return {
        moves: [
            Math.floor(rng() * types_2.TILES),
            Math.floor(rng() * types_2.TILES),
            Math.floor(rng() * types_2.TILES),
        ],
    };
}
const DEFAULT_START = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [9, 10, 11],
];
const DEFAULT_BOARD = { trapTiles: [12, 24, 36] };
/**
 * Run one match to completion. Returns placement and final state.
 */
function runOneMatch(options = {}) {
    const turnsPerMatch = options.turnsPerMatch ?? DEFAULT_TURNS_PER_MATCH;
    const boardConfig = options.boardConfig ?? DEFAULT_BOARD;
    const startPositions = options.startPositions ?? DEFAULT_START;
    const rng = options.rng ?? Math.random;
    let state = (0, types_1.createInitialState)(boardConfig, startPositions);
    for (let t = 0; t < turnsPerMatch; t++) {
        const actions = [
            randomAction(state.tokenPositions, 0, rng),
            randomAction(state.tokenPositions, 1, rng),
            randomAction(state.tokenPositions, 2, rng),
            randomAction(state.tokenPositions, 3, rng),
        ];
        state = (0, resolveTurn_1.resolveTurn)(state, actions);
    }
    const placement = (0, scoring_1.computePlacement)(state.scores, state.overtakeCounts);
    return {
        placement,
        scores: state.scores,
        overtakeCounts: state.overtakeCounts,
        turnCount: turnsPerMatch,
    };
}
/** Assert result satisfies Step 15 checks: placement 1-4, survival cap 75, overtake cap 8. */
function assertMatchResultValid(result) {
    for (let i = 0; i < 4; i++) {
        if (result.placement[i] < 1 || result.placement[i] > 4) {
            throw new Error(`Invalid placement[${i}]=${result.placement[i]}`);
        }
        const survival = Math.min(result.scores[i].survivalPoints, types_2.SURVIVAL_CAP);
        if (survival > types_2.SURVIVAL_CAP) {
            throw new Error(`Survival over cap: ${survival}`);
        }
        if (result.overtakeCounts[i] > types_2.OVERTAKE_CAP_PER_PLAYER) {
            throw new Error(`Overtake over cap: ${result.overtakeCounts[i]}`);
        }
    }
    const placements = [...result.placement].sort((a, b) => a - b);
    if (placements.join(",") !== "1,2,3,4") {
        throw new Error(`Placement must be 1,2,3,4: ${result.placement.join(",")}`);
    }
}
