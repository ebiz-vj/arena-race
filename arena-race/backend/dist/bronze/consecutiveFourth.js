"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordBronzeMatchResult = recordBronzeMatchResult;
exports.canUseFreeToken = canUseFreeToken;
const types_1 = require("./types");
/**
 * Call after a paid Bronze match ends. Updates consecutive 4th count; grants token when count hits 3 (if no active token).
 */
async function recordBronzeMatchResult(store, result, nowMs) {
    if (result.entryUsed !== "paid") {
        await store.setConsecutive4th(result.userId, 0);
        return { tokenGranted: false };
    }
    const current = await store.getConsecutive4th(result.userId);
    const next = result.placement === 4 ? current + 1 : 0;
    await store.setConsecutive4th(result.userId, next);
    if (next < types_1.CONSECUTIVE_4TH_FOR_TOKEN) {
        return { tokenGranted: false };
    }
    const active = await store.getActiveToken(result.userId, nowMs);
    if (active != null) {
        return { tokenGranted: false }; // no stacking; leave count at 3
    }
    await store.grantToken(result.userId, nowMs);
    await store.setConsecutive4th(result.userId, 0); // reset after grant
    return { tokenGranted: true };
}
/**
 * Returns whether user can use a free token for Bronze-10 (has active, non-expired token).
 */
async function canUseFreeToken(store, userId, nowMs) {
    const token = await store.getActiveToken(userId, nowMs);
    return token != null;
}
