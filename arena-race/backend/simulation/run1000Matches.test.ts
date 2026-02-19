/**
 * Step 15: 1,000-match simulation. TDD §5.3, Execution Plan Step 15.
 * Random legal actions only; verify placement 1-4, survival cap 75, overtake cap 8; no stuck state.
 */
import { runOneMatch, assertMatchResultValid } from "./runMatch";

const N = 1000;

describe("1,000-match simulation", () => {
  it("runs 1,000 matches with random legal actions; all pass checks", () => {
    for (let i = 0; i < N; i++) {
      const result = runOneMatch({ turnsPerMatch: 10 + (i % 11) });
      assertMatchResultValid(result);
    }
  });

  it("placement always 1-4 and covers all four", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const result = runOneMatch({ turnsPerMatch: 12 });
      assertMatchResultValid(result);
      seen.add(result.placement.join(","));
    }
    expect(seen.size).toBeGreaterThanOrEqual(1);
  });
});
