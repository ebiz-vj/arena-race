"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Trap resolution tests. TDD §4.4.
 */
const trap_1 = require("./trap");
describe("trap", () => {
    it("eliminates tokens on trap tiles", () => {
        const positions = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [9, 10, 11],
        ];
        const config = { trapTiles: [1, 5, 7] };
        const next = (0, trap_1.resolveTraps)(positions, config);
        expect(next[0][1]).toBe(-1);
        expect(next[1][2]).toBe(-1);
        expect(next[2][1]).toBe(-1);
        expect(next[0][0]).toBe(0);
        expect(next[1][0]).toBe(3);
    });
});
