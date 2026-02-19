"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Zone (contested-only) tests. TDD §6.1.
 */
const zone_1 = require("./zone");
describe("zone", () => {
    it("awards 2 pts per contested zone per player in that zone", () => {
        const positions = [
            [0, 1, 2],
            [3, 1, 5],
            [14, 15, 16],
            [21, 22, 23],
        ];
        const pts = (0, zone_1.computeZonePointsThisTurn)(positions);
        expect(pts[0]).toBe(2);
        expect(pts[1]).toBe(2);
        expect(pts[2]).toBe(0);
        expect(pts[3]).toBe(0);
    });
    it("no zone points when only one player in a row", () => {
        const positions = [
            [0, 1, 2],
            [7, 8, 9],
            [14, 15, 16],
            [21, 22, 23],
        ];
        const pts = (0, zone_1.computeZonePointsThisTurn)(positions);
        expect(pts).toEqual([0, 0, 0, 0]);
    });
});
