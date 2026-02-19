/**
 * Survival: safe tokens × 0.5; match cap min(., 75) applied at ranking. TDD §6.1.
 * Safe = NOT on trap tile AND NOT on a tile with ≥2 tokens.
 */
import type { TokenPositions } from "./types";
import type { BoardConfig } from "./types";
import { SURVIVAL_POINTS_PER_SAFE } from "./types";

export function computeSurvivalThisTurn(positions: TokenPositions, boardConfig: BoardConfig): [number, number, number, number] {
  const trapSet = new Set(boardConfig.trapTiles);
  const tokenCountPerTile = new Map<number, number>();
  for (let p = 0; p < 4; p++) {
    for (let t = 0; t < 3; t++) {
      const tile = positions[p][t];
      if (tile >= 0) {
        tokenCountPerTile.set(tile, (tokenCountPerTile.get(tile) ?? 0) + 1);
      }
    }
  }

  const survival: [number, number, number, number] = [0, 0, 0, 0];
  for (let p = 0; p < 4; p++) {
    let safe = 0;
    for (let t = 0; t < 3; t++) {
      const tile = positions[p][t];
      if (tile < 0) continue;
      if (trapSet.has(tile)) continue;
      if ((tokenCountPerTile.get(tile) ?? 0) >= 2) continue;
      safe++;
    }
    survival[p] = safe * SURVIVAL_POINTS_PER_SAFE;
  }
  return survival;
}
