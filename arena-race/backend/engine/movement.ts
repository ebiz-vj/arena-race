/**
 * Movement: apply in fixed player order (0,1,2,3). TDD §4.4.
 * Manual local-testing mode: allow tokens to share destination tiles.
 */
import type { TokenPositions, PlayerAction } from "./types";
import { TILES } from "./types";

export function applyMovement(
  positions: TokenPositions,
  actions: [PlayerAction, PlayerAction, PlayerAction, PlayerAction]
): TokenPositions {
  const next: TokenPositions = [
    [positions[0][0], positions[0][1], positions[0][2]],
    [positions[1][0], positions[1][1], positions[1][2]],
    [positions[2][0], positions[2][1], positions[2][2]],
    [positions[3][0], positions[3][1], positions[3][2]],
  ];

  for (let player = 0; player < 4; player++) {
    for (let token = 0; token < 3; token++) {
      const currentTile = next[player][token];
      if (currentTile < 0) continue; // eliminated, don't move
      const targetTile = actions[player].moves[token];
      if (targetTile < 0 || targetTile >= TILES) continue; // invalid, stay
      next[player][token] = targetTile;
    }
  }

  return next;
}
