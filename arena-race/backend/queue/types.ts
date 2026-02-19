/**
 * Queue types. TDD §7.1–7.7.
 */
export type Tier = "bronze-10" | "bronze-25";

export interface QueueEntry {
  playerId: string;
  wallet: string;
  joinedAt: number; // Unix ms
  tier: Tier;
}

export const MERGE_PROMPT_AFTER_MS = 180_000; // 180 s
export const QUEUE_TIMEOUT_MS = 240_000; // 240 s
export const ENTRY_DEADLINE_SEC = 300; // 5 min, aligned with contract
