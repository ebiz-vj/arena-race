/**
 * Scoring tests. TDD §6.1–6.3.
 */
import {
  computePositionPointsThisTurn,
  applySurvivalCapAndTotal,
  computePlacement,
} from "./scoring";
import type { TokenPositions, PlayerScores, OvertakeCounts } from "./types";

describe("scoring", () => {
  it("position: 0.13 * (6 - row) per token", () => {
    const positions: TokenPositions = [
      [0, 7, 14],
      [3, 4, 5],
      [6, 7, 8],
      [9, 10, 11],
    ];
    const pts = computePositionPointsThisTurn(positions);
    expect(pts[0]).toBeCloseTo(0.13 * (6 - 0) + 0.13 * (6 - 1) + 0.13 * (6 - 2));
  });

  it("survival cap 75 applied at ranking", () => {
    const scores: [PlayerScores, PlayerScores, PlayerScores, PlayerScores] = [
      { positionPoints: 0, zonePoints: 0, overtakePoints: 0, survivalPoints: 100, total: 0 },
      { positionPoints: 0, zonePoints: 0, overtakePoints: 0, survivalPoints: 0, total: 0 },
      { positionPoints: 0, zonePoints: 0, overtakePoints: 0, survivalPoints: 0, total: 0 },
      { positionPoints: 0, zonePoints: 0, overtakePoints: 0, survivalPoints: 0, total: 0 },
    ];
    applySurvivalCapAndTotal(scores);
    expect(scores[0].survivalPoints).toBe(75);
    expect(scores[0].total).toBe(75);
  });

  it("placement tie-break: total then overtake+zone then overtake count", () => {
    const scores: [PlayerScores, PlayerScores, PlayerScores, PlayerScores] = [
      { positionPoints: 10, zonePoints: 0, overtakePoints: 0, survivalPoints: 0, total: 10 },
      { positionPoints: 10, zonePoints: 2, overtakePoints: 4, survivalPoints: 0, total: 16 },
      { positionPoints: 10, zonePoints: 0, overtakePoints: 0, survivalPoints: 0, total: 10 },
      { positionPoints: 5, zonePoints: 0, overtakePoints: 0, survivalPoints: 0, total: 5 },
    ];
    const overtakeCounts: OvertakeCounts = [0, 1, 0, 0];
    const placement = computePlacement(scores, overtakeCounts);
    expect(placement[1]).toBe(1);
    expect(placement[3]).toBe(4);
    expect([placement[0], placement[2]].sort()).toEqual([2, 3]);
    expect([...placement].sort()).toEqual([1, 2, 3, 4]);
  });
});
