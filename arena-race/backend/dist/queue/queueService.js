"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryQueueStore = exports.QueueService = void 0;
const types_1 = require("./types");
const DEFAULT_TIERS = ["bronze-10", "bronze-25"];
class QueueService {
    constructor(store, tiers = DEFAULT_TIERS) {
        this.store = store;
        this.tiers = tiers;
    }
    join(tier, playerId, wallet) {
        this.store.add(tier, {
            playerId,
            wallet,
            joinedAt: Date.now(),
            tier,
        });
    }
    leave(tier, playerId) {
        this.store.remove(tier, playerId);
    }
    /**
     * If ≥4 in same queue, pop 4 (FIFO) and return them for match creation.
     * Otherwise returns null.
     */
    tryFormMatch(tier) {
        const list = this.store.list(tier);
        if (list.length < 4)
            return null;
        const four = list.slice(0, 4);
        this.store.removeAll(tier, four.map((e) => e.playerId));
        return four;
    }
    /** Whether to show merge prompt (in queue ≥180 s for Bronze-25). TDD §7.4 */
    shouldShowMergePrompt(entry, nowMs) {
        if (entry.tier !== "bronze-25")
            return false;
        return nowMs - entry.joinedAt >= types_1.MERGE_PROMPT_AFTER_MS;
    }
    /** Whether queue timeout reached (240 s). TDD §7.5 */
    isQueueTimeout(entry, nowMs) {
        return nowMs - entry.joinedAt >= types_1.QUEUE_TIMEOUT_MS;
    }
}
exports.QueueService = QueueService;
/** In-memory store for tests and single-instance server. */
class InMemoryQueueStore {
    constructor() {
        this.queues = new Map([
            ["bronze-10", []],
            ["bronze-25", []],
        ]);
    }
    add(tier, entry) {
        const list = this.queues.get(tier);
        if (list.some((e) => e.playerId === entry.playerId))
            return;
        list.push(entry);
    }
    remove(tier, playerId) {
        const list = this.queues.get(tier);
        const i = list.findIndex((e) => e.playerId === playerId);
        if (i >= 0)
            list.splice(i, 1);
    }
    list(tier) {
        return [...this.queues.get(tier)];
    }
    removeAll(tier, playerIds) {
        const set = new Set(playerIds);
        const list = this.queues.get(tier);
        for (let i = list.length - 1; i >= 0; i--) {
            if (set.has(list[i].playerId))
                list.splice(i, 1);
        }
    }
}
exports.InMemoryQueueStore = InMemoryQueueStore;
