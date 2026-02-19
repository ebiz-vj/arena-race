"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeZonePointsThisTurn = computeZonePointsThisTurn;
const types_1 = require("./types");
const types_2 = require("./types");
function computeZonePointsThisTurn(positions) {
    const playersInRow = [];
    for (let r = 0; r < 7; r++)
        playersInRow[r] = new Set();
    for (let p = 0; p < 4; p++) {
        for (let t = 0; t < 3; t++) {
            const tile = positions[p][t];
            if (tile >= 0) {
                const { row } = (0, types_2.rowCol)(tile);
                playersInRow[row].add(p);
            }
        }
    }
    const contestedRows = new Set();
    for (let r = 0; r < 7; r++) {
        if (playersInRow[r].size >= 2)
            contestedRows.add(r);
    }
    const zonePoints = [0, 0, 0, 0];
    for (let r = 0; r < 7; r++) {
        if (!contestedRows.has(r))
            continue;
        for (const p of playersInRow[r]) {
            zonePoints[p] += types_1.ZONE_POINTS_PER_CONTESTED;
        }
    }
    return zonePoints;
}
