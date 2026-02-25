"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryQueueStore = void 0;
exports.tryFormMatch = tryFormMatch;
const TIERS = ["bronze-10", "bronze-25"];
class InMemoryQueueStore {
    constructor() {
        this.queues = new Map(TIERS.map((t) => [t, []]));
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
        return [...(this.queues.get(tier) ?? [])];
    }
    /** Clear all queues (for Reset everything in local dev). */
    clearAll() {
        this.queues = new Map(TIERS.map((t) => [t, []]));
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
function tryFormMatch(store, tier) {
    const list = store.list(tier);
    if (list.length < 4)
        return null;
    const four = list.slice(0, 4);
    store.removeAll(tier, four.map((e) => e.playerId));
    return four;
}
