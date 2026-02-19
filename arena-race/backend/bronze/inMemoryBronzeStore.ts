/**
 * In-memory Bronze store for tests.
 */
import type { BronzeToken, IBronzeStore } from "./types";
import { TOKEN_EXPIRY_DAYS, MAX_ACTIVE_TOKENS_PER_USER } from "./types";

const MS_PER_DAY = 86400 * 1000;

export class InMemoryBronzeStore implements IBronzeStore {
  private consecutive4th = new Map<string, number>();
  private tokens: BronzeToken[] = [];

  async getConsecutive4th(userId: string): Promise<number> {
    return this.consecutive4th.get(userId) ?? 0;
  }

  async setConsecutive4th(userId: string, count: number): Promise<void> {
    this.consecutive4th.set(userId, count);
  }

  async getActiveToken(userId: string, nowMs: number): Promise<BronzeToken | null> {
    const active = this.tokens.filter(
      (t) => t.userId === userId && t.consumedAt == null && t.expiresAt > nowMs
    );
    if (active.length > MAX_ACTIVE_TOKENS_PER_USER) return active[0];
    return active[0] ?? null;
  }

  async grantToken(userId: string, nowMs: number): Promise<BronzeToken> {
    const expiresAt = nowMs + TOKEN_EXPIRY_DAYS * MS_PER_DAY;
    const token: BronzeToken = {
      userId,
      grantedAt: nowMs,
      expiresAt,
      consumedAt: null,
      matchId: null,
    };
    this.tokens.push(token);
    return token;
  }

  async consumeToken(userId: string, matchId: string, nowMs: number): Promise<boolean> {
    const t = this.tokens.find((x) => x.userId === userId && x.consumedAt == null && x.expiresAt > nowMs);
    if (!t) return false;
    t.consumedAt = nowMs;
    t.matchId = matchId;
    return true;
  }
}
