"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeSurvivalThisTurn = computeSurvivalThisTurn;
const types_1 = require("./types");
function computeSurvivalThisTurn(positions, boardConfig) {
    const trapSet = new Set(boardConfig.trapTiles);
    const tokenCountPerTile = new Map();
    for (let p = 0; p < 4; p++) {
        for (let t = 0; t < 3; t++) {
            const tile = positions[p][t];
            if (tile >= 0) {
                tokenCountPerTile.set(tile, (tokenCountPerTile.get(tile) ?? 0) + 1);
            }
        }
    }
    const survival = [0, 0, 0, 0];
    for (let p = 0; p < 4; p++) {
        let safe = 0;
        for (let t = 0; t < 3; t++) {
            const tile = positions[p][t];
            if (tile < 0)
                continue;
            if (trapSet.has(tile))
                continue;
            if ((tokenCountPerTile.get(tile) ?? 0) >= 2)
                continue;
            safe++;
        }
        survival[p] = safe * types_1.SURVIVAL_POINTS_PER_SAFE;
    }
    return survival;
}
