"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTurn = resolveTurn;
const movement_1 = require("./movement");
const trap_1 = require("./trap");
const zone_1 = require("./zone");
const overtake_1 = require("./overtake");
const survival_1 = require("./survival");
const scoring_1 = require("./scoring");
function resolveTurn(previousState, playerActions) {
    const positionsAfterMove = (0, movement_1.applyMovement)(previousState.tokenPositions, playerActions);
    const positionsAfterTrap = (0, trap_1.resolveTraps)(positionsAfterMove, previousState.boardConfig);
    const zonePts = (0, zone_1.computeZonePointsThisTurn)(positionsAfterTrap);
    const { overtakesThisTurn, newOvertakeCounts } = (0, overtake_1.computeOvertakesThisTurn)(previousState.tokenPositions, positionsAfterTrap, previousState.overtakeCounts);
    const survivalPts = (0, survival_1.computeSurvivalThisTurn)(positionsAfterTrap, previousState.boardConfig);
    const positionPts = (0, scoring_1.computePositionPointsThisTurn)(positionsAfterTrap);
    const scores = [
        { ...previousState.scores[0] },
        { ...previousState.scores[1] },
        { ...previousState.scores[2] },
        { ...previousState.scores[3] },
    ];
    for (let p = 0; p < 4; p++) {
        scores[p].positionPoints += positionPts[p];
        scores[p].zonePoints += zonePts[p];
        scores[p].overtakePoints = (0, scoring_1.overtakePointsFromCount)(newOvertakeCounts[p]);
        scores[p].survivalPoints += survivalPts[p];
        scores[p].total =
            scores[p].positionPoints +
                scores[p].zonePoints +
                scores[p].overtakePoints +
                scores[p].survivalPoints;
    }
    return {
        turnIndex: previousState.turnIndex + 1,
        tokenPositions: positionsAfterTrap,
        scores,
        overtakeCounts: newOvertakeCounts,
        boardConfig: previousState.boardConfig,
    };
}
