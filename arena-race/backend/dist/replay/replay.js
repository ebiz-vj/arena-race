"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayMatch = replayMatch;
exports.replayMatchStrict = replayMatchStrict;
/**
 * Replay tool. TDD §13.2, Step 14.
 * Load match_turns; re-run resolveTurn in sequence; compare final score/placement to stored result.
 */
const resolveTurn_1 = require("../engine/resolveTurn");
const scoring_1 = require("../engine/scoring");
/**
 * Replay from stored turns. Uses stateBefore of first turn as initial state.
 * Returns whether replayed final state/placement matches stored.
 */
function replayMatch(turns, storedPlacement) {
    if (turns.length === 0) {
        return {
            match: false,
            finalState: null,
            storedPlacement,
            replayedPlacement: null,
            message: "No turns",
        };
    }
    let state = turns[0].stateBefore;
    for (const t of turns) {
        state = (0, resolveTurn_1.resolveTurn)(state, t.actions);
    }
    const replayedPlacement = (0, scoring_1.computePlacement)(state.scores, state.overtakeCounts);
    const match = replayedPlacement[0] === storedPlacement[0] &&
        replayedPlacement[1] === storedPlacement[1] &&
        replayedPlacement[2] === storedPlacement[2] &&
        replayedPlacement[3] === storedPlacement[3];
    return {
        match,
        finalState: state,
        storedPlacement,
        replayedPlacement,
    };
}
/**
 * Replay and optionally compare state_after each turn (stricter check).
 */
function replayMatchStrict(turns) {
    for (let i = 0; i < turns.length; i++) {
        const t = turns[i];
        const next = (0, resolveTurn_1.resolveTurn)(t.stateBefore, t.actions);
        if (next.turnIndex !== t.stateAfter.turnIndex)
            return { match: false, firstMismatchTurn: i };
        if (JSON.stringify(next.scores) !== JSON.stringify(t.stateAfter.scores)) {
            return { match: false, firstMismatchTurn: i };
        }
    }
    return { match: true, firstMismatchTurn: null };
}
