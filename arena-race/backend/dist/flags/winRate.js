"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectWinRateFlags = detectWinRateFlags;
const types_1 = require("./types");
/**
 * places: last N match results (placement 1–4) for a user, most recent last.
 */
function detectWinRateFlags(userPlaces) {
    const flags = [];
    for (const [userId, places] of userPlaces) {
        if (places.length < types_1.WIN_RATE_MIN_MATCHES)
            continue;
        const rolling = places.slice(-types_1.WIN_RATE_ROLLING_MATCHES);
        const firstCount = rolling.filter((p) => p === 1).length;
        const rate = firstCount / rolling.length;
        if (rate < types_1.WIN_RATE_MIN_FIRST_RATE)
            continue;
        flags.push({
            userId,
            reason: "win_rate",
            payload: { firstCount, total: rolling.length, rate },
        });
    }
    return flags;
}
