"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Step 11 tests: consecutive 4th tracker; token grant; no stacking; expiry.
 */
const consecutiveFourth_1 = require("./consecutiveFourth");
const inMemoryBronzeStore_1 = require("./inMemoryBronzeStore");
describe("consecutiveFourth", () => {
    let store;
    beforeEach(() => {
        store = new inMemoryBronzeStore_1.InMemoryBronzeStore();
    });
    it("resets consecutive 4th on non-4th placement", async () => {
        await store.setConsecutive4th("u1", 2);
        await (0, consecutiveFourth_1.recordBronzeMatchResult)(store, { userId: "u1", placement: 1, entryUsed: "paid" }, 1000);
        expect(await store.getConsecutive4th("u1")).toBe(0);
    });
    it("increments consecutive 4th on 4th place (paid)", async () => {
        await (0, consecutiveFourth_1.recordBronzeMatchResult)(store, { userId: "u1", placement: 4, entryUsed: "paid" }, 1000);
        expect(await store.getConsecutive4th("u1")).toBe(1);
        await (0, consecutiveFourth_1.recordBronzeMatchResult)(store, { userId: "u1", placement: 4, entryUsed: "paid" }, 2000);
        expect(await store.getConsecutive4th("u1")).toBe(2);
    });
    it("after 3 consecutive 4th grants token", async () => {
        await (0, consecutiveFourth_1.recordBronzeMatchResult)(store, { userId: "u1", placement: 4, entryUsed: "paid" }, 1000);
        await (0, consecutiveFourth_1.recordBronzeMatchResult)(store, { userId: "u1", placement: 4, entryUsed: "paid" }, 2000);
        const { tokenGranted } = await (0, consecutiveFourth_1.recordBronzeMatchResult)(store, { userId: "u1", placement: 4, entryUsed: "paid" }, 3000);
        expect(tokenGranted).toBe(true);
        expect(await store.getActiveToken("u1", 3001)).not.toBeNull();
        expect(await store.getConsecutive4th("u1")).toBe(0);
    });
    it("no stacking: already have active token then 3 more 4th does not grant second", async () => {
        await store.grantToken("u1", 0);
        await store.setConsecutive4th("u1", 3);
        const { tokenGranted } = await (0, consecutiveFourth_1.recordBronzeMatchResult)(store, { userId: "u1", placement: 4, entryUsed: "paid" }, 1000);
        expect(tokenGranted).toBe(false);
    });
    it("free_token entry does not increment consecutive 4th", async () => {
        await store.setConsecutive4th("u1", 1);
        await (0, consecutiveFourth_1.recordBronzeMatchResult)(store, { userId: "u1", placement: 4, entryUsed: "free_token" }, 1000);
        expect(await store.getConsecutive4th("u1")).toBe(0);
    });
    it("canUseFreeToken true when active token exists", async () => {
        await store.grantToken("u1", 1000);
        expect(await (0, consecutiveFourth_1.canUseFreeToken)(store, "u1", 1001)).toBe(true);
    });
    it("canUseFreeToken false when token expired", async () => {
        await store.grantToken("u1", 0);
        const expiry = 8 * 86400 * 1000;
        expect(await (0, consecutiveFourth_1.canUseFreeToken)(store, "u1", expiry)).toBe(false);
    });
    it("consumeToken consumes and prevents reuse", async () => {
        await store.grantToken("u1", 1000);
        const ok = await store.consumeToken("u1", "match-1", 2000);
        expect(ok).toBe(true);
        expect(await (0, consecutiveFourth_1.canUseFreeToken)(store, "u1", 2001)).toBe(false);
    });
});
