/**
 * Co-occurrence detection. TDD §9.1.
 * Rolling 200 matches per player; N_together ≥ 15 and avg(min(place_A, place_B)) ≤ 2.2 → flag both.
 */
import type { ReviewFlag } from "./types";
import {
  CO_OCCURRENCE_ROLLING_MATCHES,
  CO_OCCURRENCE_MIN_TOGETHER,
  CO_OCCURRENCE_MAX_AVG_MIN_PLACE,
} from "./types";

export interface MatchWithParticipants {
  matchId: string;
  participants: { userId: string; place: number }[];
}

/**
 * Returns review flags for pairs that meet co-occurrence trigger.
 * matchesPerUser: last N matches per user (e.g. 200), each with participants and places.
 */
export function detectCoOccurrence(
  matchesPerUser: Map<string, MatchWithParticipants[]>
): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const seenPairs = new Set<string>();

  for (const [userA, matchesA] of matchesPerUser) {
    if (matchesA.length < CO_OCCURRENCE_MIN_TOGETHER) continue;

    for (const [userB, matchesB] of matchesPerUser) {
      if (userA >= userB) continue;
      const pairKey = `${userA}:${userB}`;
      if (seenPairs.has(pairKey)) continue;

      const together = matchesA.filter((m) =>
        m.participants.some((p) => p.userId === userB)
      );
      if (together.length < CO_OCCURRENCE_MIN_TOGETHER) continue;

      let sumMinPlace = 0;
      for (const m of together) {
        const placeA = m.participants.find((p) => p.userId === userA)?.place ?? 4;
        const placeB = m.participants.find((p) => p.userId === userB)?.place ?? 4;
        sumMinPlace += Math.min(placeA, placeB);
      }
      const avgMinPlace = sumMinPlace / together.length;
      if (avgMinPlace > CO_OCCURRENCE_MAX_AVG_MIN_PLACE) continue;

      seenPairs.add(pairKey);
      flags.push({
        userId: userA,
        reason: "co_occurrence",
        payload: { withUser: userB, N_together: together.length, avgMinPlace },
      });
      flags.push({
        userId: userB,
        reason: "co_occurrence",
        payload: { withUser: userA, N_together: together.length, avgMinPlace },
      });
    }
  }
  return flags;
}
