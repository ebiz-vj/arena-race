/**
 * Zone (contested-only) tests. TDD §6.1.
 */
import { computeZonePointsThisTurn } from "./zone";
import type { TokenPositions } from "./types";

describe("zone", () => {
  it("awards 2 pts per contested zone per player in that zone", () => {
    const positions: TokenPositions = [
      [0, 1, 2],
      [3, 1, 5],
      [14, 15, 16],
      [21, 22, 23],
    ];
    const pts = computeZonePointsThisTurn(positions);
    expect(pts[0]).toBe(2);
    expect(pts[1]).toBe(2);
    expect(pts[2]).toBe(0);
    expect(pts[3]).toBe(0);
  });

  it("no zone points when only one player in a row", () => {
    const positions: TokenPositions = [
      [0, 1, 2],
      [7, 8, 9],
      [14, 15, 16],
      [21, 22, 23],
    ];
    const pts = computeZonePointsThisTurn(positions);
    expect(pts).toEqual([0, 0, 0, 0]);
  });
});
