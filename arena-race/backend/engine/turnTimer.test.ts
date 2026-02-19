/**
 * Turn timer tests. Step 10: late packet ignored; default applied; simultaneous before deadline accepted.
 */
import { isActionOnTime, resolveAction, TURN_WINDOW_MS } from "./turnTimer";
import type { PlayerAction, TokenPositions } from "./types";

describe("turnTimer", () => {
  const turnStart = 1000;
  const turnDeadline = turnStart + TURN_WINDOW_MS;

  it("accepts action when receivedAt <= turnDeadline", () => {
    expect(isActionOnTime(turnDeadline - 1, turnDeadline)).toBe(true);
    expect(isActionOnTime(turnDeadline, turnDeadline)).toBe(true);
  });

  it("rejects late packet (receivedAt > turnDeadline)", () => {
    expect(isActionOnTime(turnDeadline + 1, turnDeadline)).toBe(false);
  });

  it("resolveAction uses default when late", () => {
    const positions: TokenPositions = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [9, 10, 11],
    ];
    const lateAction: PlayerAction = { moves: [99, 99, 99] };
    const resolved = resolveAction(lateAction, turnDeadline + 100, turnStart, positions, 0);
    expect(resolved.moves).toEqual([0, 1, 2]);
  });

  it("resolveAction uses submitted when on time", () => {
    const positions: TokenPositions = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [9, 10, 11],
    ];
    const onTimeAction: PlayerAction = { moves: [5, 6, 7] };
    const resolved = resolveAction(onTimeAction, turnDeadline - 1, turnStart, positions, 0);
    expect(resolved.moves).toEqual([5, 6, 7]);
  });

  it("simultaneous actions before deadline all accepted", () => {
    const positions: TokenPositions = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [9, 10, 11],
    ];
    const at = turnDeadline - 10;
    for (let p = 0; p < 4; p++) {
      const action: PlayerAction = { moves: [p * 10, p * 10 + 1, p * 10 + 2] };
      const resolved = resolveAction(action, at, turnStart, positions, p);
      expect(resolved).toEqual(action);
    }
  });
});
