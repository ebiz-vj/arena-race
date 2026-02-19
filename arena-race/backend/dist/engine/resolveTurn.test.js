"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * resolveTurn integration tests. TDD §5.1.
 */
const resolveTurn_1 = require("./resolveTurn");
const types_1 = require("./types");
const scoring_1 = require("./scoring");
describe("resolveTurn", () => {
    const boardConfig = { trapTiles: [] };
    const startPositions = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [9, 10, 11],
    ];
    it("returns new state with turnIndex+1 and updated positions/scores", () => {
        const state = (0, types_1.createInitialState)(boardConfig, startPositions);
        const actions = [
            (0, types_1.defaultAction)(state.tokenPositions[0]),
            (0, types_1.defaultAction)(state.tokenPositions[1]),
            (0, types_1.defaultAction)(state.tokenPositions[2]),
            (0, types_1.defaultAction)(state.tokenPositions[3]),
        ];
        const next = (0, resolveTurn_1.resolveTurn)(state, actions);
        expect(next.turnIndex).toBe(1);
        expect(next.tokenPositions).toEqual(state.tokenPositions);
        expect(next.scores[0].positionPoints).toBeGreaterThan(0);
    });
    it("same input produces same output (deterministic)", () => {
        const state = (0, types_1.createInitialState)(boardConfig, startPositions);
        const actions = [
            { moves: [0, 1, 2] },
            { moves: [3, 4, 5] },
            { moves: [6, 7, 8] },
            { moves: [9, 10, 11] },
        ];
        const a = (0, resolveTurn_1.resolveTurn)(state, actions);
        const b = (0, resolveTurn_1.resolveTurn)(state, actions);
        expect(a.turnIndex).toBe(b.turnIndex);
        expect(a.tokenPositions).toEqual(b.tokenPositions);
        expect(a.scores[0].total).toBe(b.scores[0].total);
    });
    it("computePlacement produces valid 1..4 for each player", () => {
        const state = (0, types_1.createInitialState)(boardConfig, startPositions);
        const actions = [
            { moves: [0, 1, 2] },
            { moves: [3, 4, 5] },
            { moves: [6, 7, 8] },
            { moves: [9, 10, 11] },
        ];
        let s = state;
        for (let i = 0; i < 5; i++) {
            s = (0, resolveTurn_1.resolveTurn)(s, actions);
        }
        const placement = (0, scoring_1.computePlacement)(s.scores, s.overtakeCounts);
        expect(placement).toHaveLength(4);
        expect(placement.sort()).toEqual([1, 2, 3, 4]);
    });
});
