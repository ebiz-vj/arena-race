"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Overtake tests. TDD §5.5.
 */
const overtake_1 = require("./overtake");
describe("overtake", () => {
    it("counts overtake when A was behind and is now ahead", () => {
        const prev = [
            [0, 1, 2],
            [10, 11, 12],
            [6, 7, 8],
            [9, 10, 11],
        ];
        const next = [
            [15, 1, 2],
            [10, 11, 12],
            [6, 7, 8],
            [9, 10, 11],
        ];
        const counts = [0, 0, 0, 0];
        const { overtakesThisTurn } = (0, overtake_1.computeOvertakesThisTurn)(prev, next, counts);
        expect(overtakesThisTurn[0]).toBeGreaterThanOrEqual(1);
    });
    it("respects cap 8 per player", () => {
        const prev = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [9, 10, 11],
        ];
        const next = [
            [20, 21, 22],
            [3, 4, 5],
            [6, 7, 8],
            [9, 10, 11],
        ];
        const counts = [8, 0, 0, 0];
        const { overtakesThisTurn, newOvertakeCounts } = (0, overtake_1.computeOvertakesThisTurn)(prev, next, counts);
        expect(overtakesThisTurn[0]).toBe(0);
        expect(newOvertakeCounts[0]).toBe(8);
    });
});
