"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computePositionPointsThisTurn = computePositionPointsThisTurn;
exports.applySurvivalCapAndTotal = applySurvivalCapAndTotal;
exports.computePlacement = computePlacement;
exports.overtakePointsFromCount = overtakePointsFromCount;
const types_1 = require("./types");
const types_2 = require("./types");
const types_3 = require("./types");
function computePositionPointsThisTurn(positions) {
    const pts = [0, 0, 0, 0];
    for (let p = 0; p < 4; p++) {
        for (let t = 0; t < 3; t++) {
            const tile = positions[p][t];
            if (tile >= 0) {
                const { row } = (0, types_1.rowCol)(tile);
                pts[p] += types_2.POSITION_COEFF * (6 - row);
            }
        }
    }
    return pts;
}
/** Apply survival cap and set total. TDD §6.2 */
function applySurvivalCapAndTotal(scores) {
    for (let p = 0; p < 4; p++) {
        scores[p].survivalPoints = Math.min(scores[p].survivalPoints, types_2.SURVIVAL_CAP);
        scores[p].total =
            scores[p].positionPoints +
                scores[p].zonePoints +
                scores[p].overtakePoints +
                scores[p].survivalPoints;
    }
}
/** Final placement 1..4 and tie-break. TDD §6.3. Returns placement[playerIndex] = 1..4. */
function computePlacement(scores, overtakeCounts) {
    const capped = [
        { ...scores[0] },
        { ...scores[1] },
        { ...scores[2] },
        { ...scores[3] },
    ];
    applySurvivalCapAndTotal(capped);
    const indices = [0, 1, 2, 3];
    indices.sort((a, b) => {
        if (capped[b].total !== capped[a].total)
            return capped[b].total - capped[a].total;
        const ozA = capped[a].overtakePoints + capped[a].zonePoints;
        const ozB = capped[b].overtakePoints + capped[b].zonePoints;
        if (ozB !== ozA)
            return ozB - ozA;
        return overtakeCounts[b] - overtakeCounts[a];
    });
    const placement = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        placement[indices[i]] = i + 1;
    }
    return placement;
}
function overtakePointsFromCount(count) {
    return count * types_3.OVERTAKE_POINTS;
}
