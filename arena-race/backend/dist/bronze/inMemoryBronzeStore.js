"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryBronzeStore = void 0;
const types_1 = require("./types");
const MS_PER_DAY = 86400 * 1000;
class InMemoryBronzeStore {
    constructor() {
        this.consecutive4th = new Map();
        this.tokens = [];
    }
    async getConsecutive4th(userId) {
        return this.consecutive4th.get(userId) ?? 0;
    }
    async setConsecutive4th(userId, count) {
        this.consecutive4th.set(userId, count);
    }
    async getActiveToken(userId, nowMs) {
        const active = this.tokens.filter((t) => t.userId === userId && t.consumedAt == null && t.expiresAt > nowMs);
        if (active.length > types_1.MAX_ACTIVE_TOKENS_PER_USER)
            return active[0];
        return active[0] ?? null;
    }
    async grantToken(userId, nowMs) {
        const expiresAt = nowMs + types_1.TOKEN_EXPIRY_DAYS * MS_PER_DAY;
        const token = {
            userId,
            grantedAt: nowMs,
            expiresAt,
            consumedAt: null,
            matchId: null,
        };
        this.tokens.push(token);
        return token;
    }
    async consumeToken(userId, matchId, nowMs) {
        const t = this.tokens.find((x) => x.userId === userId && x.consumedAt == null && x.expiresAt > nowMs);
        if (!t)
            return false;
        t.consumedAt = nowMs;
        t.matchId = matchId;
        return true;
    }
}
exports.InMemoryBronzeStore = InMemoryBronzeStore;
