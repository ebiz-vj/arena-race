/**
 * In-memory queue store. TDD §7.1–7.2. Mirrors backend/queue for game-server use.
 */
export type Tier = "bronze-10" | "bronze-25";

export interface QueueEntry {
  playerId: string;
  wallet: string;
  joinedAt: number;
  tier: Tier;
}

const TIERS: Tier[] = ["bronze-10", "bronze-25"];

export class InMemoryQueueStore {
  private queues: Map<Tier, QueueEntry[]> = new Map(
    TIERS.map((t) => [t, []])
  );

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
    return [...(this.queues.get(tier) ?? [])];
  }

  /** Clear all queues (for Reset everything in local dev). */
  clearAll(): void {
    this.queues = new Map(TIERS.map((t) => [t, []]));
  }

  removeAll(tier: Tier, playerIds: string[]): void {
    const set = new Set(playerIds);
    const list = this.queues.get(tier)!;
    for (let i = list.length - 1; i >= 0; i--) {
      if (set.has(list[i].playerId)) list.splice(i, 1);
    }
  }
}

export function tryFormMatch(
  store: InMemoryQueueStore,
  tier: Tier
): QueueEntry[] | null {
  const list = store.list(tier);
  if (list.length < 4) return null;
  const four = list.slice(0, 4);
  store.removeAll(tier, four.map((e) => e.playerId));
  return four;
}
