"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Step 16: Concurrency stress. 4 then 8 simultaneous matches.
 * No wrong payout; no double-spend; no crash. (Pure engine: no shared mutable state.)
 */
const runMatch_1 = require("../simulation/runMatch");
describe("concurrency stress", () => {
    it("4 simultaneous matches complete without crash; all valid", async () => {
        const promises = Array.from({ length: 4 }, () => Promise.resolve((0, runMatch_1.runOneMatch)({ turnsPerMatch: 10 })));
        const results = await Promise.all(promises);
        expect(results).toHaveLength(4);
        for (const result of results) {
            (0, runMatch_1.assertMatchResultValid)(result);
        }
    });
    it("8 simultaneous matches complete without crash; all valid", async () => {
        const promises = Array.from({ length: 8 }, () => Promise.resolve((0, runMatch_1.runOneMatch)({ turnsPerMatch: 12 })));
        const results = await Promise.all(promises);
        expect(results).toHaveLength(8);
        for (const result of results) {
            (0, runMatch_1.assertMatchResultValid)(result);
        }
    });
});
