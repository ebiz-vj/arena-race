/**
 * Zone: contested-only. TDD §6.1.
 * Zone = row (0..6). Contested iff ≥2 distinct players have ≥1 token in that row.
 * Each player with ≥1 token in a contested zone gets 2 pts (once per zone per player per turn).
 */
import type { TokenPositions } from "./types";
import { ZONE_POINTS_PER_CONTESTED } from "./types";
import { rowCol } from "./types";

export function computeZonePointsThisTurn(positions: TokenPositions): [number, number, number, number] {
  const playersInRow: Set<number>[] = [];
  for (let r = 0; r < 7; r++) playersInRow[r] = new Set();

  for (let p = 0; p < 4; p++) {
    for (let t = 0; t < 3; t++) {
      const tile = positions[p][t];
      if (tile >= 0) {
        const { row } = rowCol(tile);
        playersInRow[row].add(p);
      }
    }
  }

  const contestedRows = new Set<number>();
  for (let r = 0; r < 7; r++) {
    if (playersInRow[r].size >= 2) contestedRows.add(r);
  }

  const zonePoints: [number, number, number, number] = [0, 0, 0, 0];
  for (let r = 0; r < 7; r++) {
    if (!contestedRows.has(r)) continue;
    for (const p of playersInRow[r]) {
      zonePoints[p] += ZONE_POINTS_PER_CONTESTED;
    }
  }
  return zonePoints;
}
