"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeOvertakesThisTurn = computeOvertakesThisTurn;
const types_1 = require("./types");
function computeOvertakesThisTurn(prevPositions, newPositions, currentOvertakeCounts) {
    const overtakesThisTurn = [0, 0, 0, 0];
    for (let p = 0; p < 4; p++) {
        const alreadyAtCap = currentOvertakeCounts[p] >= types_1.OVERTAKE_CAP_PER_PLAYER;
        const playersOvertaken = new Set();
        for (let q = 0; q < 4; q++) {
            if (q === p)
                continue;
            let pairOvertake = false;
            for (let i = 0; i < 3 && !pairOvertake; i++) {
                for (let j = 0; j < 3; j++) {
                    const prevP = prevPositions[p][i];
                    const prevQ = prevPositions[q][j];
                    const newP = newPositions[p][i];
                    const newQ = newPositions[q][j];
                    if (prevP < 0 || prevQ < 0 || newP < 0 || newQ < 0)
                        continue;
                    if (prevP < prevQ && newP > newQ) {
                        pairOvertake = true;
                        playersOvertaken.add(q);
                        break;
                    }
                }
            }
        }
        const add = Math.min(playersOvertaken.size, types_1.OVERTAKE_CAP_PER_PLAYER - currentOvertakeCounts[p]);
        overtakesThisTurn[p] = Math.max(0, add);
    }
    const newOvertakeCounts = [
        currentOvertakeCounts[0] + overtakesThisTurn[0],
        currentOvertakeCounts[1] + overtakesThisTurn[1],
        currentOvertakeCounts[2] + overtakesThisTurn[2],
        currentOvertakeCounts[3] + overtakesThisTurn[3],
    ];
    return { overtakesThisTurn, newOvertakeCounts };
}
