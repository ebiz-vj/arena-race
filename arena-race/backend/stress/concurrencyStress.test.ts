/**
 * Step 16: Concurrency stress. 4 then 8 simultaneous matches.
 * No wrong payout; no double-spend; no crash. (Pure engine: no shared mutable state.)
 */
import { runOneMatch, assertMatchResultValid } from "../simulation/runMatch";

describe("concurrency stress", () => {
  it("4 simultaneous matches complete without crash; all valid", async () => {
    const promises = Array.from({ length: 4 }, () =>
      Promise.resolve(runOneMatch({ turnsPerMatch: 10 }))
    );
    const results = await Promise.all(promises);
    expect(results).toHaveLength(4);
    for (const result of results) {
      assertMatchResultValid(result);
    }
  });

  it("8 simultaneous matches complete without crash; all valid", async () => {
    const promises = Array.from({ length: 8 }, () =>
      Promise.resolve(runOneMatch({ turnsPerMatch: 12 }))
    );
    const results = await Promise.all(promises);
    expect(results).toHaveLength(8);
    for (const result of results) {
      assertMatchResultValid(result);
    }
  });
});
