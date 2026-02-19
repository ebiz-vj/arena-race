"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRONZE_10_ENTRY_WEI = void 0;
exports.getFreeEntryPlayerIndex = getFreeEntryPlayerIndex;
exports.shouldTreasuryFundEntry = shouldTreasuryFundEntry;
exports.useFreeTokenIfEligible = useFreeTokenIfEligible;
exports.BRONZE_10_ENTRY_WEI = "10000000"; // 10 USDC (6 decimals)
/**
 * Resolve which player (index 0–3) used free token; others pay. Returns index of free-token user or null.
 */
function getFreeEntryPlayerIndex(playerIds, freeTokenUserId) {
    if (freeTokenUserId == null)
        return null;
    const i = playerIds.indexOf(freeTokenUserId);
    return i >= 0 ? i : null;
}
/**
 * Treasury must send entry for this player when they use free token (so contract receives 4×10).
 * Returns true if backend should instruct treasury to fund this player's entry.
 */
function shouldTreasuryFundEntry(playerIndex, freeEntryPlayerIndex) {
    return freeEntryPlayerIndex === playerIndex;
}
/**
 * Consume free token when player enters with it. Returns true if consumed.
 */
async function useFreeTokenIfEligible(store, userId, matchId, nowMs) {
    const token = await store.getActiveToken(userId, nowMs);
    if (token == null)
        return { used: false };
    const consumed = await store.consumeToken(userId, matchId, nowMs);
    return { used: consumed };
}
