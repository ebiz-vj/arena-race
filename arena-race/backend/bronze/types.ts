/**
 * Bronze retention types. TDD §8.
 */
export const CONSECUTIVE_4TH_FOR_TOKEN = 3;
export const TOKEN_EXPIRY_DAYS = 7;
export const MAX_ACTIVE_TOKENS_PER_USER = 1;

export interface BronzeToken {
  userId: string;
  grantedAt: number; // Unix ms
  expiresAt: number; // Unix ms
  consumedAt: number | null;
  matchId: string | null;
}

export interface IBronzeStore {
  getConsecutive4th(userId: string): Promise<number>;
  setConsecutive4th(userId: string, count: number): Promise<void>;
  getActiveToken(userId: string, nowMs: number): Promise<BronzeToken | null>;
  grantToken(userId: string, nowMs: number): Promise<BronzeToken>;
  consumeToken(userId: string, matchId: string, nowMs: number): Promise<boolean>;
}
