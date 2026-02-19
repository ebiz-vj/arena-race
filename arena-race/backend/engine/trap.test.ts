/**
 * Trap resolution tests. TDD §4.4.
 */
import { resolveTraps } from "./trap";
import type { TokenPositions } from "./types";
import type { BoardConfig } from "./types";

describe("trap", () => {
  it("eliminates tokens on trap tiles", () => {
    const positions: TokenPositions = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [9, 10, 11],
    ];
    const config: BoardConfig = { trapTiles: [1, 5, 7] };
    const next = resolveTraps(positions, config);
    expect(next[0][1]).toBe(-1);
    expect(next[1][2]).toBe(-1);
    expect(next[2][1]).toBe(-1);
    expect(next[0][0]).toBe(0);
    expect(next[1][0]).toBe(3);
  });
});
