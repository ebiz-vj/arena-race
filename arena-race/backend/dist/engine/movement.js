"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyMovement = applyMovement;
const types_1 = require("./types");
function applyMovement(positions, actions) {
    const next = [
        [positions[0][0], positions[0][1], positions[0][2]],
        [positions[1][0], positions[1][1], positions[1][2]],
        [positions[2][0], positions[2][1], positions[2][2]],
        [positions[3][0], positions[3][1], positions[3][2]],
    ];
    for (let player = 0; player < 4; player++) {
        for (let token = 0; token < 3; token++) {
            const currentTile = next[player][token];
            if (currentTile < 0)
                continue; // eliminated, don't move
            const targetTile = actions[player].moves[token];
            if (targetTile < 0 || targetTile >= types_1.TILES)
                continue; // invalid, stay
            next[player][token] = targetTile;
        }
    }
    return next;
}
