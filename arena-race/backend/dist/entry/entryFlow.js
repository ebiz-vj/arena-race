"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkEntryFlow = checkEntryFlow;
exports.entryDeadlineFromCreatedAt = entryDeadlineFromCreatedAt;
const types_1 = require("./types");
const types_2 = require("./types");
/**
 * Returns whether the match should start (turn loop) and whether to trigger refund.
 * Only when contract status === Escrowed should start be true.
 */
async function checkEntryFlow(adapter, matchIdHex, entryDeadline, nowSeconds) {
    const status = await adapter.getMatchStatus(matchIdHex);
    if (status === types_1.EscrowMatchStatus.Escrowed) {
        return { shouldStart: true };
    }
    if (status === types_1.EscrowMatchStatus.Expired || status === types_1.EscrowMatchStatus.Refunded) {
        return { shouldStart: false, reason: status === types_1.EscrowMatchStatus.Expired ? "expired" : "refunded" };
    }
    if (status === types_1.EscrowMatchStatus.PendingEntries) {
        if (nowSeconds > entryDeadline) {
            return { shouldStart: false, reason: "expired", triggerRefund: true };
        }
        return { shouldStart: false, reason: "pending_entries" };
    }
    if (status === types_1.EscrowMatchStatus.Resolved) {
        return { shouldStart: false, reason: "refunded" };
    }
    return { shouldStart: false, reason: "pending_entries" };
}
/**
 * Compute entry deadline from match creation time. TDD §3.5.
 */
function entryDeadlineFromCreatedAt(createdAtSeconds) {
    return createdAtSeconds + types_2.ENTRY_WINDOW_SEC;
}
