/**
 * Consecutive 4th-place tracker and Bronze free-entry token grant. TDD §8.1–8.4.
 * After 3 consecutive 4th in paid Bronze matches → grant one token (7-day expiry; max 1 active).
 */
import type { IBronzeStore } from "./types";
import { CONSECUTIVE_4TH_FOR_TOKEN } from "./types";

export interface RecordMatchResult {
  userId: string;
  placement: number; // 1–4
  entryUsed: "paid" | "free_token";
}

/**
 * Call after a paid Bronze match ends. Updates consecutive 4th count; grants token when count hits 3 (if no active token).
 */
export async function recordBronzeMatchResult(
  store: IBronzeStore,
  result: RecordMatchResult,
  nowMs: number
): Promise<{ tokenGranted: boolean }> {
  if (result.entryUsed !== "paid") {
    await store.setConsecutive4th(result.userId, 0);
    return { tokenGranted: false };
  }

  const current = await store.getConsecutive4th(result.userId);
  const next = result.placement === 4 ? current + 1 : 0;
  await store.setConsecutive4th(result.userId, next);

  if (next < CONSECUTIVE_4TH_FOR_TOKEN) {
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
export async function canUseFreeToken(store: IBronzeStore, userId: string, nowMs: number): Promise<boolean> {
  const token = await store.getActiveToken(userId, nowMs);
  return token != null;
}
