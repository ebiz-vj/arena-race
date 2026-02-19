/**
 * resolveTurn integration tests. TDD §5.1.
 */
import { resolveTurn } from "./resolveTurn";
import { createInitialState, defaultAction } from "./types";
import type { TokenPositions, PlayerAction, BoardConfig } from "./types";
import { computePlacement } from "./scoring";

describe("resolveTurn", () => {
  const boardConfig: BoardConfig = { trapTiles: [] };
  const startPositions: TokenPositions = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [9, 10, 11],
  ];

  it("returns new state with turnIndex+1 and updated positions/scores", () => {
    const state = createInitialState(boardConfig, startPositions);
    const actions: [PlayerAction, PlayerAction, PlayerAction, PlayerAction] = [
      defaultAction(state.tokenPositions[0]),
      defaultAction(state.tokenPositions[1]),
      defaultAction(state.tokenPositions[2]),
      defaultAction(state.tokenPositions[3]),
    ];
    const next = resolveTurn(state, actions);
    expect(next.turnIndex).toBe(1);
    expect(next.tokenPositions).toEqual(state.tokenPositions);
    expect(next.scores[0].positionPoints).toBeGreaterThan(0);
  });

  it("same input produces same output (deterministic)", () => {
    const state = createInitialState(boardConfig, startPositions);
    const actions: [PlayerAction, PlayerAction, PlayerAction, PlayerAction] = [
      { moves: [0, 1, 2] },
      { moves: [3, 4, 5] },
      { moves: [6, 7, 8] },
      { moves: [9, 10, 11] },
    ];
    const a = resolveTurn(state, actions);
    const b = resolveTurn(state, actions);
    expect(a.turnIndex).toBe(b.turnIndex);
    expect(a.tokenPositions).toEqual(b.tokenPositions);
    expect(a.scores[0].total).toBe(b.scores[0].total);
  });

  it("computePlacement produces valid 1..4 for each player", () => {
    const state = createInitialState(boardConfig, startPositions);
    const actions: [PlayerAction, PlayerAction, PlayerAction, PlayerAction] = [
      { moves: [0, 1, 2] },
      { moves: [3, 4, 5] },
      { moves: [6, 7, 8] },
      { moves: [9, 10, 11] },
    ];
    let s = state;
    for (let i = 0; i < 5; i++) {
      s = resolveTurn(s, actions);
    }
    const placement = computePlacement(s.scores, s.overtakeCounts);
    expect(placement).toHaveLength(4);
    expect(placement.sort()).toEqual([1, 2, 3, 4]);
  });
});
