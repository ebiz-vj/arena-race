"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TURN_WINDOW_MS = void 0;
exports.isActionOnTime = isActionOnTime;
exports.resolveAction = resolveAction;
const types_1 = require("./types");
exports.TURN_WINDOW_MS = 6000;
/**
 * Returns whether the action was received before the turn deadline.
 */
function isActionOnTime(receivedAtMs, turnDeadlineMs) {
    return receivedAtMs <= turnDeadlineMs;
}
/**
 * Resolve effective action: use submitted if on time, else default (no-op).
 */
function resolveAction(submitted, receivedAtMs, turnStartTimeMs, currentPositions, playerIndex) {
    const turnDeadlineMs = turnStartTimeMs + exports.TURN_WINDOW_MS;
    if (submitted != null && isActionOnTime(receivedAtMs, turnDeadlineMs)) {
        return submitted;
    }
    return (0, types_1.defaultAction)(currentPositions[playerIndex]);
}
