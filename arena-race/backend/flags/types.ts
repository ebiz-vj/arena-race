/**
 * Anti-collusion flag types. TDD §9.
 */
export type FlagReason = "co_occurrence" | "win_rate";

export interface MatchParticipant {
  userId: string;
  place: number; // 1–4
}

export interface ReviewFlag {
  userId: string;
  reason: FlagReason;
  payload: Record<string, unknown>;
}

export const CO_OCCURRENCE_ROLLING_MATCHES = 200;
export const CO_OCCURRENCE_MIN_TOGETHER = 15;
export const CO_OCCURRENCE_MAX_AVG_MIN_PLACE = 2.2;

export const WIN_RATE_MIN_MATCHES = 20;
export const WIN_RATE_ROLLING_MATCHES = 50;
export const WIN_RATE_MIN_FIRST_RATE = 0.8;
