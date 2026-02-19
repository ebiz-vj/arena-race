/**
 * Free entry funding flow. TDD §8.2, Step 12.
 * When player uses free token: treasury sends that player's 10 USDC to contract so contract still receives 4×10.
 * Contract logic unchanged (always 4 entries, 38/30/20/12).
 */
import type { IBronzeStore } from "./types";

export const BRONZE_10_ENTRY_WEI = "10000000"; // 10 USDC (6 decimals)

/**
 * Resolve which player (index 0–3) used free token; others pay. Returns index of free-token user or null.
 */
export function getFreeEntryPlayerIndex(
  playerIds: [string, string, string, string],
  freeTokenUserId: string | null
): number | null {
  if (freeTokenUserId == null) return null;
  const i = playerIds.indexOf(freeTokenUserId);
  return i >= 0 ? i : null;
}

/**
 * Treasury must send entry for this player when they use free token (so contract receives 4×10).
 * Returns true if backend should instruct treasury to fund this player's entry.
 */
export function shouldTreasuryFundEntry(
  playerIndex: number,
  freeEntryPlayerIndex: number | null
): boolean {
  return freeEntryPlayerIndex === playerIndex;
}

/**
 * Consume free token when player enters with it. Returns true if consumed.
 */
export async function useFreeTokenIfEligible(
  store: IBronzeStore,
  userId: string,
  matchId: string,
  nowMs: number
): Promise<{ used: boolean }> {
  const token = await store.getActiveToken(userId, nowMs);
  if (token == null) return { used: false };
  const consumed = await store.consumeToken(userId, matchId, nowMs);
  return { used: consumed };
}
