/**
 * Win-rate flag. TDD §9.2.
 * ≥20 ranked matches, then ≥80% 1st over rolling 50 → insert review_flags.
 */
import type { ReviewFlag } from "./types";
import {
  WIN_RATE_MIN_MATCHES,
  WIN_RATE_ROLLING_MATCHES,
  WIN_RATE_MIN_FIRST_RATE,
} from "./types";

/**
 * places: last N match results (placement 1–4) for a user, most recent last.
 */
export function detectWinRateFlags(userPlaces: Map<string, number[]>): ReviewFlag[] {
  const flags: ReviewFlag[] = [];

  for (const [userId, places] of userPlaces) {
    if (places.length < WIN_RATE_MIN_MATCHES) continue;

    const rolling = places.slice(-WIN_RATE_ROLLING_MATCHES);
    const firstCount = rolling.filter((p) => p === 1).length;
    const rate = firstCount / rolling.length;
    if (rate < WIN_RATE_MIN_FIRST_RATE) continue;

    flags.push({
      userId,
      reason: "win_rate",
      payload: { firstCount, total: rolling.length, rate },
    });
  }
  return flags;
}
