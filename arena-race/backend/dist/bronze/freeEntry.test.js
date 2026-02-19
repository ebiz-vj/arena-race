"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Step 12 tests: free entry flow; token consumed on use; expiry.
 */
const freeEntry_1 = require("./freeEntry");
const inMemoryBronzeStore_1 = require("./inMemoryBronzeStore");
describe("freeEntry", () => {
    it("getFreeEntryPlayerIndex returns index of free-token user", () => {
        const players = ["a", "b", "c", "d"];
        expect((0, freeEntry_1.getFreeEntryPlayerIndex)(players, "b")).toBe(1);
        expect((0, freeEntry_1.getFreeEntryPlayerIndex)(players, "x")).toBe(null);
        expect((0, freeEntry_1.getFreeEntryPlayerIndex)(players, null)).toBe(null);
    });
    it("shouldTreasuryFundEntry true only for free-entry player index", () => {
        expect((0, freeEntry_1.shouldTreasuryFundEntry)(0, 0)).toBe(true);
        expect((0, freeEntry_1.shouldTreasuryFundEntry)(1, 0)).toBe(false);
        expect((0, freeEntry_1.shouldTreasuryFundEntry)(1, 1)).toBe(true);
        expect((0, freeEntry_1.shouldTreasuryFundEntry)(0, null)).toBe(false);
    });
    it("useFreeTokenIfEligible consumes token on use", async () => {
        const store = new inMemoryBronzeStore_1.InMemoryBronzeStore();
        await store.grantToken("u1", 1000);
        const { used } = await (0, freeEntry_1.useFreeTokenIfEligible)(store, "u1", "match-1", 2000);
        expect(used).toBe(true);
        const again = await (0, freeEntry_1.useFreeTokenIfEligible)(store, "u1", "match-2", 3000);
        expect(again.used).toBe(false);
    });
    it("token expiry: cannot use expired token", async () => {
        const store = new inMemoryBronzeStore_1.InMemoryBronzeStore();
        await store.grantToken("u1", 0);
        const expiry = 8 * 86400 * 1000;
        const { used } = await (0, freeEntry_1.useFreeTokenIfEligible)(store, "u1", "match-1", expiry);
        expect(used).toBe(false);
    });
});
