"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCoOccurrence = detectCoOccurrence;
const types_1 = require("./types");
/**
 * Returns review flags for pairs that meet co-occurrence trigger.
 * matchesPerUser: last N matches per user (e.g. 200), each with participants and places.
 */
function detectCoOccurrence(matchesPerUser) {
    const flags = [];
    const seenPairs = new Set();
    for (const [userA, matchesA] of matchesPerUser) {
        if (matchesA.length < types_1.CO_OCCURRENCE_MIN_TOGETHER)
            continue;
        for (const [userB, matchesB] of matchesPerUser) {
            if (userA >= userB)
                continue;
            const pairKey = `${userA}:${userB}`;
            if (seenPairs.has(pairKey))
                continue;
            const together = matchesA.filter((m) => m.participants.some((p) => p.userId === userB));
            if (together.length < types_1.CO_OCCURRENCE_MIN_TOGETHER)
                continue;
            let sumMinPlace = 0;
            for (const m of together) {
                const placeA = m.participants.find((p) => p.userId === userA)?.place ?? 4;
                const placeB = m.participants.find((p) => p.userId === userB)?.place ?? 4;
                sumMinPlace += Math.min(placeA, placeB);
            }
            const avgMinPlace = sumMinPlace / together.length;
            if (avgMinPlace > types_1.CO_OCCURRENCE_MAX_AVG_MIN_PLACE)
                continue;
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
