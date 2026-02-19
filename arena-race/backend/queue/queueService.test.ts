/**
 * Queue service tests. Step 9: FIFO pop 4, merge 180s, timeout 240s.
 */
import { QueueService, InMemoryQueueStore } from "./queueService";
import type { Tier } from "./types";

describe("QueueService", () => {
  let store: InMemoryQueueStore;
  let queue: QueueService;

  beforeEach(() => {
    store = new InMemoryQueueStore();
    queue = new QueueService(store);
  });

  it("tryFormMatch returns null when <4 in queue", () => {
    queue.join("bronze-10", "a", "0xa");
    queue.join("bronze-10", "b", "0xb");
    expect(queue.tryFormMatch("bronze-10")).toBeNull();
  });

  it("FIFO pop 4 → create match", () => {
    queue.join("bronze-10", "a", "0xa");
    queue.join("bronze-10", "b", "0xb");
    queue.join("bronze-10", "c", "0xc");
    queue.join("bronze-10", "d", "0xd");
    const four = queue.tryFormMatch("bronze-10");
    expect(four).toHaveLength(4);
    expect(four!.map((e) => e.playerId)).toEqual(["a", "b", "c", "d"]);
    expect(store.list("bronze-10")).toHaveLength(0);
  });

  it("merge prompt after 180s for bronze-25 only", () => {
    const entry = { playerId: "x", wallet: "0x", joinedAt: 0, tier: "bronze-25" as Tier };
    expect(queue.shouldShowMergePrompt(entry, 179_000)).toBe(false);
    expect(queue.shouldShowMergePrompt(entry, 180_000)).toBe(true);
    const entry10 = { ...entry, tier: "bronze-10" as Tier };
    expect(queue.shouldShowMergePrompt(entry10, 200_000)).toBe(false);
  });

  it("queue timeout at 240s", () => {
    const entry = { playerId: "x", wallet: "0x", joinedAt: 0, tier: "bronze-10" as Tier };
    expect(queue.isQueueTimeout(entry, 239_000)).toBe(false);
    expect(queue.isQueueTimeout(entry, 240_000)).toBe(true);
  });

  it("leave removes player from queue", () => {
    queue.join("bronze-10", "a", "0xa");
    queue.leave("bronze-10", "a");
    expect(store.list("bronze-10")).toHaveLength(0);
  });
});
