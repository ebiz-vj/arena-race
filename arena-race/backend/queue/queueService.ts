/**
 * Queue service: FIFO pop 4 → create match. TDD §7.2–7.5.
 * In-memory implementation; Redis can replace with same interface (keys: queue:bronze:10, queue:bronze:25).
 */
import type { QueueEntry, Tier } from "./types";
import { MERGE_PROMPT_AFTER_MS, QUEUE_TIMEOUT_MS } from "./types";

export interface IQueueStore {
  add(tier: Tier, entry: QueueEntry): void;
  remove(tier: Tier, playerId: string): void;
  list(tier: Tier): QueueEntry[];
  removeAll(tier: Tier, playerIds: string[]): void;
}

const DEFAULT_TIERS: Tier[] = ["bronze-10", "bronze-25"];

export class QueueService {
  constructor(
    private store: IQueueStore,
    private tiers: Tier[] = DEFAULT_TIERS
  ) {}

  join(tier: Tier, playerId: string, wallet: string): void {
    this.store.add(tier, {
      playerId,
      wallet,
      joinedAt: Date.now(),
      tier,
    });
  }

  leave(tier: Tier, playerId: string): void {
    this.store.remove(tier, playerId);
  }

  /**
   * If ≥4 in same queue, pop 4 (FIFO) and return them for match creation.
   * Otherwise returns null.
   */
  tryFormMatch(tier: Tier): QueueEntry[] | null {
    const list = this.store.list(tier);
    if (list.length < 4) return null;
    const four = list.slice(0, 4);
    this.store.removeAll(tier, four.map((e) => e.playerId));
    return four;
  }

  /** Whether to show merge prompt (in queue ≥180 s for Bronze-25). TDD §7.4 */
  shouldShowMergePrompt(entry: QueueEntry, nowMs: number): boolean {
    if (entry.tier !== "bronze-25") return false;
    return nowMs - entry.joinedAt >= MERGE_PROMPT_AFTER_MS;
  }

  /** Whether queue timeout reached (240 s). TDD §7.5 */
  isQueueTimeout(entry: QueueEntry, nowMs: number): boolean {
    return nowMs - entry.joinedAt >= QUEUE_TIMEOUT_MS;
  }
}

/** In-memory store for tests and single-instance server. */
export class InMemoryQueueStore implements IQueueStore {
  private queues: Map<Tier, QueueEntry[]> = new Map([
    ["bronze-10", []],
    ["bronze-25", []],
  ]);

  add(tier: Tier, entry: QueueEntry): void {
    const list = this.queues.get(tier)!;
    if (list.some((e) => e.playerId === entry.playerId)) return;
    list.push(entry);
  }

  remove(tier: Tier, playerId: string): void {
    const list = this.queues.get(tier)!;
    const i = list.findIndex((e) => e.playerId === playerId);
    if (i >= 0) list.splice(i, 1);
  }

  list(tier: Tier): QueueEntry[] {
    return [...this.queues.get(tier)!];
  }

  removeAll(tier: Tier, playerIds: string[]): void {
    const set = new Set(playerIds);
    const list = this.queues.get(tier)!;
    for (let i = list.length - 1; i >= 0; i--) {
      if (set.has(list[i].playerId)) list.splice(i, 1);
    }
  }
}
