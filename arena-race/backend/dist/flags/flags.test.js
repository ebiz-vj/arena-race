"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Step 13 tests: co-occurrence and win-rate flags; no false positive on small samples.
 */
const coOccurrence_1 = require("./coOccurrence");
const winRate_1 = require("./winRate");
describe("co-occurrence", () => {
    it("flags pair when N_together ≥ 15 and avg(min(place)) ≤ 2.2", () => {
        const matchesA = Array.from({ length: 20 }, (_, i) => ({
            matchId: `m${i}`,
            participants: [
                { userId: "A", place: 1 },
                { userId: "B", place: 2 },
                { userId: "C", place: 3 },
                { userId: "D", place: 4 },
            ],
        }));
        const matchesPerUser = new Map([
            ["A", matchesA],
            ["B", matchesA],
            ["C", []],
            ["D", []],
        ]);
        const flags = (0, coOccurrence_1.detectCoOccurrence)(matchesPerUser);
        expect(flags.length).toBeGreaterThanOrEqual(2);
        expect(flags.filter((f) => f.reason === "co_occurrence")).toHaveLength(flags.length);
    });
    it("no false positive when N_together < 15", () => {
        const matchesA = Array.from({ length: 10 }, (_, i) => ({
            matchId: `m${i}`,
            participants: [
                { userId: "A", place: 1 },
                { userId: "B", place: 2 },
                { userId: "C", place: 3 },
                { userId: "D", place: 4 },
            ],
        }));
        const matchesPerUser = new Map([
            ["A", matchesA],
            ["B", matchesA],
        ]);
        const flags = (0, coOccurrence_1.detectCoOccurrence)(matchesPerUser);
        expect(flags).toHaveLength(0);
    });
});
describe("win-rate", () => {
    it("flags when ≥20 matches and ≥80% 1st over rolling 50", () => {
        const places = [...Array(30).fill(2), ...Array(45).fill(1)];
        const userPlaces = new Map([["u1", places]]);
        const flags = (0, winRate_1.detectWinRateFlags)(userPlaces);
        expect(flags.length).toBe(1);
        expect(flags[0].reason).toBe("win_rate");
    });
    it("no false positive on small sample (<20 matches)", () => {
        const places = Array(19).fill(1);
        const userPlaces = new Map([["u1", places]]);
        const flags = (0, winRate_1.detectWinRateFlags)(userPlaces);
        expect(flags).toHaveLength(0);
    });
});
