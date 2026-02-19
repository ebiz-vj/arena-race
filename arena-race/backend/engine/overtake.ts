/**
 * Overtake detection. TDD §5.5, §6.1.
 * tileIndex = row*7+col. Overtake: previousIndex_A < previousIndex_B and newIndex_A > newIndex_B.
 * Count at most one overtake per (A,B) pair per turn; per player count where that player passed.
 * Cap 8 per player per match. Overtake_points = 4 * N_overtakes.
 */
import type { TokenPositions } from "./types";
import type { OvertakeCounts } from "./types";
import { OVERTAKE_CAP_PER_PLAYER } from "./types";

export function computeOvertakesThisTurn(
  prevPositions: TokenPositions,
  newPositions: TokenPositions,
  currentOvertakeCounts: OvertakeCounts
): { overtakesThisTurn: [number, number, number, number]; newOvertakeCounts: OvertakeCounts } {
  const overtakesThisTurn: [number, number, number, number] = [0, 0, 0, 0];

  for (let p = 0; p < 4; p++) {
    const alreadyAtCap = currentOvertakeCounts[p] >= OVERTAKE_CAP_PER_PLAYER;
    const playersOvertaken = new Set<number>();

    for (let q = 0; q < 4; q++) {
      if (q === p) continue;
      let pairOvertake = false;
      for (let i = 0; i < 3 && !pairOvertake; i++) {
        for (let j = 0; j < 3; j++) {
          const prevP = prevPositions[p][i];
          const prevQ = prevPositions[q][j];
          const newP = newPositions[p][i];
          const newQ = newPositions[q][j];
          if (prevP < 0 || prevQ < 0 || newP < 0 || newQ < 0) continue;
          if (prevP < prevQ && newP > newQ) {
            pairOvertake = true;
            playersOvertaken.add(q);
            break;
          }
        }
      }
    }

    const add = Math.min(playersOvertaken.size, OVERTAKE_CAP_PER_PLAYER - currentOvertakeCounts[p]);
    overtakesThisTurn[p] = Math.max(0, add);
  }

  const newOvertakeCounts: OvertakeCounts = [
    currentOvertakeCounts[0] + overtakesThisTurn[0],
    currentOvertakeCounts[1] + overtakesThisTurn[1],
    currentOvertakeCounts[2] + overtakesThisTurn[2],
    currentOvertakeCounts[3] + overtakesThisTurn[3],
  ];

  return { overtakesThisTurn, newOvertakeCounts };
}
