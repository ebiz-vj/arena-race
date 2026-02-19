/**
 * Scoring. TDD §6.1–6.3.
 * Position: 0.13 * (6 - row) per token per turn.
 * Before final ranking: survivalPoints = min(survivalPoints, 75); total = position + zone + overtake + survivalPoints.
 * Tie-break: total desc → (overtake+zone) desc → overtake count desc → split payout.
 */
import type { TokenPositions, PlayerScores, OvertakeCounts } from "./types";
import { rowCol } from "./types";
import { POSITION_COEFF, SURVIVAL_CAP } from "./types";
import { OVERTAKE_POINTS } from "./types";

export function computePositionPointsThisTurn(positions: TokenPositions): [number, number, number, number] {
  const pts: [number, number, number, number] = [0, 0, 0, 0];
  for (let p = 0; p < 4; p++) {
    for (let t = 0; t < 3; t++) {
      const tile = positions[p][t];
      if (tile >= 0) {
        const { row } = rowCol(tile);
        pts[p] += POSITION_COEFF * (6 - row);
      }
    }
  }
  return pts;
}

/** Apply survival cap and set total. TDD §6.2 */
export function applySurvivalCapAndTotal(scores: [PlayerScores, PlayerScores, PlayerScores, PlayerScores]): void {
  for (let p = 0; p < 4; p++) {
    scores[p].survivalPoints = Math.min(scores[p].survivalPoints, SURVIVAL_CAP);
    scores[p].total =
      scores[p].positionPoints +
      scores[p].zonePoints +
      scores[p].overtakePoints +
      scores[p].survivalPoints;
  }
}

/** Final placement 1..4 and tie-break. TDD §6.3. Returns placement[playerIndex] = 1..4. */
export function computePlacement(
  scores: [PlayerScores, PlayerScores, PlayerScores, PlayerScores],
  overtakeCounts: OvertakeCounts
): [number, number, number, number] {
  const capped: [PlayerScores, PlayerScores, PlayerScores, PlayerScores] = [
    { ...scores[0] },
    { ...scores[1] },
    { ...scores[2] },
    { ...scores[3] },
  ];
  applySurvivalCapAndTotal(capped);

  const indices = [0, 1, 2, 3];
  indices.sort((a, b) => {
    if (capped[b].total !== capped[a].total) return capped[b].total - capped[a].total;
    const ozA = capped[a].overtakePoints + capped[a].zonePoints;
    const ozB = capped[b].overtakePoints + capped[b].zonePoints;
    if (ozB !== ozA) return ozB - ozA;
    return overtakeCounts[b] - overtakeCounts[a];
  });

  const placement: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    placement[indices[i]] = i + 1;
  }
  return placement;
}

export function overtakePointsFromCount(count: number): number {
  return count * OVERTAKE_POINTS;
}
