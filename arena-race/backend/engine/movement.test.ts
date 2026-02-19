/**
 * Movement unit tests. TDD §4.4: fixed player order.
 */
import { applyMovement } from "./movement";
import type { TokenPositions, PlayerAction } from "./types";

describe("movement", () => {
  it("applies moves in player order; first mover wins tile", () => {
    const positions: TokenPositions = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [9, 10, 11],
    ];
    const actions: [PlayerAction, PlayerAction, PlayerAction, PlayerAction] = [
      { moves: [20, 1, 2] },
      { moves: [20, 4, 5] },
      { moves: [6, 7, 8] },
      { moves: [9, 10, 11] },
    ];
    const next = applyMovement(positions, actions);
    expect(next[0][0]).toBe(20);
    expect(next[1][0]).toBe(3);
    expect(next[2][0]).toBe(6);
    expect(next[3][0]).toBe(9);
  });

  it("no-op leaves positions unchanged", () => {
    const positions: TokenPositions = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [9, 10, 11],
    ];
    const actions: [PlayerAction, PlayerAction, PlayerAction, PlayerAction] = [
      { moves: [0, 1, 2] },
      { moves: [3, 4, 5] },
      { moves: [6, 7, 8] },
      { moves: [9, 10, 11] },
    ];
    const next = applyMovement(positions, actions);
    expect(next).toEqual(positions);
  });
});
