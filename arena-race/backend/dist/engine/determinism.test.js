"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Determinism and replay test. TDD §5.3; Execution Plan Step 7.
 * 1,000 identical (state + actions) → identical output.
 * Replay full match from action log → same final score and placement.
 */
const resolveTurn_1 = require("./resolveTurn");
const types_1 = require("./types");
const scoring_1 = require("./scoring");
const BOARD_CONFIG = { trapTiles: [12, 24, 36] };
const START = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [9, 10, 11],
];
function runMatch(initialState, actionLog) {
    let state = initialState;
    for (const actions of actionLog) {
        state = (0, resolveTurn_1.resolveTurn)(state, actions);
    }
    const placement = (0, scoring_1.computePlacement)(state.scores, state.overtakeCounts);
    return { finalState: state, placement };
}
describe("determinism", () => {
    it("1,000 identical (state + actions) runs produce identical output", () => {
        const tokenPositions = START;
        const state = (0, types_1.createInitialState)(BOARD_CONFIG, tokenPositions);
        const actions = [
            { moves: [1, 2, 3] },
            { moves: [4, 5, 6] },
            { moves: [7, 8, 9] },
            { moves: [10, 11, 13] },
        ];
        const first = (0, resolveTurn_1.resolveTurn)(state, actions);
        for (let i = 0; i < 999; i++) {
            const next = (0, resolveTurn_1.resolveTurn)(state, actions);
            expect(next.turnIndex).toBe(first.turnIndex);
            expect(next.tokenPositions).toEqual(first.tokenPositions);
            expect(next.scores[0].total).toBe(first.scores[0].total);
            expect(next.scores[1].total).toBe(first.scores[1].total);
            expect(next.scores[2].total).toBe(first.scores[2].total);
            expect(next.scores[3].total).toBe(first.scores[3].total);
            expect(next.overtakeCounts).toEqual(first.overtakeCounts);
        }
    });
    it("replay full match from stored action log reproduces final score and placement", () => {
        const tokenPositions = START;
        const initialState = (0, types_1.createInitialState)(BOARD_CONFIG, tokenPositions);
        const actionLog = [];
        for (let t = 0; t < 10; t++) {
            actionLog.push([
                { moves: [(0 + t) % 49, (1 + t) % 49, (2 + t) % 49] },
                { moves: [(3 + t) % 49, (4 + t) % 49, (5 + t) % 49] },
                { moves: [(6 + t) % 49, (7 + t) % 49, (8 + t) % 49] },
                { moves: [(9 + t) % 49, (10 + t) % 49, (11 + t) % 49] },
            ]);
        }
        const { finalState: A, placement: placeA } = runMatch(initialState, actionLog);
        const { finalState: B, placement: placeB } = runMatch(initialState, actionLog);
        expect(A.turnIndex).toBe(B.turnIndex);
        expect(A.scores[0].total).toBe(B.scores[0].total);
        expect(A.scores[1].total).toBe(B.scores[1].total);
        expect(A.scores[2].total).toBe(B.scores[2].total);
        expect(A.scores[3].total).toBe(B.scores[3].total);
        expect(placeA).toEqual(placeB);
    });
});
