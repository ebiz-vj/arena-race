"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Survival tests. TDD §6.1.
 */
const survival_1 = require("./survival");
describe("survival", () => {
    it("0.5 per safe token; not on trap, not on crowded tile", () => {
        const positions = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [9, 10, 11],
        ];
        const config = { trapTiles: [] };
        const pts = (0, survival_1.computeSurvivalThisTurn)(positions, config);
        expect(pts[0]).toBe(1.5);
        expect(pts[1]).toBe(1.5);
    });
    it("no survival for token on trap", () => {
        const positions = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [9, 10, 11],
        ];
        const config = { trapTiles: [1] };
        const pts = (0, survival_1.computeSurvivalThisTurn)(positions, config);
        expect(pts[0]).toBe(1);
    });
    it("no survival for token on tile with ≥2 tokens", () => {
        const positions = [
            [0, 0, 2],
            [0, 4, 5],
            [6, 7, 8],
            [9, 10, 11],
        ];
        const config = { trapTiles: [] };
        const pts = (0, survival_1.computeSurvivalThisTurn)(positions, config);
        expect(pts[0]).toBe(0.5);
        expect(pts[1]).toBe(1);
    });
});
