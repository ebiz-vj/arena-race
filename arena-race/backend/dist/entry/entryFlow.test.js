"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Entry flow tests. Step 8: no match start without Escrowed; expire → refund.
 */
const entryFlow_1 = require("./entryFlow");
const types_1 = require("./types");
function mockAdapter(status) {
    return {
        getMatchStatus: async () => status,
        createMatch: async () => { },
        expireMatch: async () => { },
    };
}
describe("entryFlow", () => {
    it("4 players pay → Escrowed → shouldStart true", async () => {
        const adapter = mockAdapter(types_1.EscrowMatchStatus.Escrowed);
        const outcome = await (0, entryFlow_1.checkEntryFlow)(adapter, "0x01", (0, entryFlow_1.entryDeadlineFromCreatedAt)(0) + 300, 100);
        expect(outcome).toEqual({ shouldStart: true });
    });
    it("1 player never pays → status stays PendingEntries → shouldStart false", async () => {
        const adapter = mockAdapter(types_1.EscrowMatchStatus.PendingEntries);
        const deadline = (0, entryFlow_1.entryDeadlineFromCreatedAt)(0);
        const outcome = await (0, entryFlow_1.checkEntryFlow)(adapter, "0x01", deadline, deadline - 60);
        expect(outcome.shouldStart).toBe(false);
        expect(outcome.reason).toBe("pending_entries");
    });
    it("entry expires (5 min) → past deadline → triggerRefund", async () => {
        const adapter = mockAdapter(types_1.EscrowMatchStatus.PendingEntries);
        const createdAt = 1000;
        const deadline = (0, entryFlow_1.entryDeadlineFromCreatedAt)(createdAt);
        const outcome = await (0, entryFlow_1.checkEntryFlow)(adapter, "0x01", deadline, deadline + 1);
        expect(outcome).toEqual({ shouldStart: false, reason: "expired", triggerRefund: true });
    });
    it("server never starts for Expired status", async () => {
        const adapter = mockAdapter(types_1.EscrowMatchStatus.Expired);
        const outcome = await (0, entryFlow_1.checkEntryFlow)(adapter, "0x01", 0, 9999);
        expect(outcome.shouldStart).toBe(false);
        expect(outcome.reason).toBe("expired");
    });
    it("server never starts for Refunded status", async () => {
        const adapter = mockAdapter(types_1.EscrowMatchStatus.Refunded);
        const outcome = await (0, entryFlow_1.checkEntryFlow)(adapter, "0x01", 0, 9999);
        expect(outcome.shouldStart).toBe(false);
        expect(outcome.reason).toBe("refunded");
    });
});
describe("entryDeadlineFromCreatedAt", () => {
    it("returns createdAt + 300", () => {
        expect((0, entryFlow_1.entryDeadlineFromCreatedAt)(100)).toBe(400);
    });
});
