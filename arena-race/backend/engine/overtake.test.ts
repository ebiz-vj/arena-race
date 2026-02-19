/**
 * Overtake tests. TDD §5.5.
 */
import { computeOvertakesThisTurn } from "./overtake";
import type { TokenPositions, OvertakeCounts } from "./types";

describe("overtake", () => {
  it("counts overtake when A was behind and is now ahead", () => {
    const prev: TokenPositions = [
      [0, 1, 2],
      [10, 11, 12],
      [6, 7, 8],
      [9, 10, 11],
    ];
    const next: TokenPositions = [
      [15, 1, 2],
      [10, 11, 12],
      [6, 7, 8],
      [9, 10, 11],
    ];
    const counts: OvertakeCounts = [0, 0, 0, 0];
    const { overtakesThisTurn } = computeOvertakesThisTurn(prev, next, counts);
    expect(overtakesThisTurn[0]).toBeGreaterThanOrEqual(1);
  });

  it("respects cap 8 per player", () => {
    const prev: TokenPositions = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [9, 10, 11],
    ];
    const next: TokenPositions = [
      [20, 21, 22],
      [3, 4, 5],
      [6, 7, 8],
      [9, 10, 11],
    ];
    const counts: OvertakeCounts = [8, 0, 0, 0];
    const { overtakesThisTurn, newOvertakeCounts } = computeOvertakesThisTurn(prev, next, counts);
    expect(overtakesThisTurn[0]).toBe(0);
    expect(newOvertakeCounts[0]).toBe(8);
  });
});
