/**
 * resolveTurn: pure function. TDD §4.4, §5.1.
 * newState = resolveTurn(previousState, playerActions[]).
 * Order: movement → trap → zone → overtake → survival → score update.
 */
import type { MatchState, PlayerAction } from "./types";
import { applyMovement } from "./movement";
import { resolveTraps } from "./trap";
import { computeZonePointsThisTurn } from "./zone";
import { computeOvertakesThisTurn } from "./overtake";
import { computeSurvivalThisTurn } from "./survival";
import {
  computePositionPointsThisTurn,
  overtakePointsFromCount,
} from "./scoring";

export function resolveTurn(
  previousState: MatchState,
  playerActions: [PlayerAction, PlayerAction, PlayerAction, PlayerAction]
): MatchState {
  const positionsAfterMove = applyMovement(previousState.tokenPositions, playerActions);
  const positionsAfterTrap = resolveTraps(positionsAfterMove, previousState.boardConfig);

  const zonePts = computeZonePointsThisTurn(positionsAfterTrap);
  const { overtakesThisTurn, newOvertakeCounts } = computeOvertakesThisTurn(
    previousState.tokenPositions,
    positionsAfterTrap,
    previousState.overtakeCounts
  );
  const survivalPts = computeSurvivalThisTurn(positionsAfterTrap, previousState.boardConfig);
  const positionPts = computePositionPointsThisTurn(positionsAfterTrap);

  const scores: MatchState["scores"] = [
    { ...previousState.scores[0] },
    { ...previousState.scores[1] },
    { ...previousState.scores[2] },
    { ...previousState.scores[3] },
  ];
  for (let p = 0; p < 4; p++) {
    scores[p].positionPoints += positionPts[p];
    scores[p].zonePoints += zonePts[p];
    scores[p].overtakePoints = overtakePointsFromCount(newOvertakeCounts[p]);
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
