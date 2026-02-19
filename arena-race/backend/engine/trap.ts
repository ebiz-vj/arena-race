/**
 * Trap resolution: tokens on trap tiles are eliminated. TDD §4.4 step 2.
 * Eliminated = position set to -1 (not counted for position/zone/survival).
 */
import type { TokenPositions } from "./types";
import type { BoardConfig } from "./types";

export function resolveTraps(positions: TokenPositions, boardConfig: BoardConfig): TokenPositions {
  const trapSet = new Set(boardConfig.trapTiles);
  const next: TokenPositions = [
    [positions[0][0], positions[0][1], positions[0][2]],
    [positions[1][0], positions[1][1], positions[1][2]],
    [positions[2][0], positions[2][1], positions[2][2]],
    [positions[3][0], positions[3][1], positions[3][2]],
  ];
  for (let p = 0; p < 4; p++) {
    for (let t = 0; t < 3; t++) {
      if (next[p][t] >= 0 && trapSet.has(next[p][t])) {
        next[p][t] = -1;
      }
    }
  }
  return next;
}
