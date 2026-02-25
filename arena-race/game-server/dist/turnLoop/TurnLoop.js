"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMatch = startMatch;
exports.submitAction = submitAction;
exports.getMatchState = getMatchState;
exports.getTurnDeadline = getTurnDeadline;
exports.tick = tick;
const arena_race_backend_1 = require("arena-race-backend");
const constants_1 = require("./constants");
const db_1 = require("../db");
const resultSubmit_1 = require("../resultSubmit");
const runningMatches = new Map();
function actionKey(turnIndex, playerIndex) {
    return `${turnIndex}:${playerIndex}`;
}
function startMatch(db, matchId) {
    if (runningMatches.has(matchId)) {
        return { ok: false, error: "match already running" };
    }
    const boardConfig = { trapTiles: [...constants_1.DEFAULT_BOARD.trapTiles] };
    const startPositions = [
        [...constants_1.DEFAULT_START[0]],
        [...constants_1.DEFAULT_START[1]],
        [...constants_1.DEFAULT_START[2]],
        [...constants_1.DEFAULT_START[3]],
    ];
    const state = (0, arena_race_backend_1.createInitialState)(boardConfig, startPositions);
    const now = Date.now();
    runningMatches.set(matchId, {
        state,
        turnStartTimeMs: now,
        matchStartTimeMs: now,
        actions: new Map(),
    });
    db_1.matches.updateMatchStatus(db, matchId, "in_progress", { started_at: Math.floor(now / 1000) });
    return { ok: true };
}
/** Idempotent: store action for this turn and player. */
function submitAction(matchId, turnIndex, playerIndex, moves, receivedAtMs) {
    const run = runningMatches.get(matchId);
    if (!run)
        return { ok: false, error: "match not running" };
    if (turnIndex !== run.state.turnIndex) {
        return { ok: false, error: "wrong turn index" };
    }
    const deadline = run.turnStartTimeMs + constants_1.TURN_MS;
    if (receivedAtMs > deadline) {
        return { ok: false, error: "turn deadline passed" };
    }
    const key = actionKey(turnIndex, playerIndex);
    run.actions.set(key, { moves });
    return { ok: true };
}
function getMatchState(matchId) {
    const run = runningMatches.get(matchId);
    return run ? run.state : null;
}
function getTurnDeadline(matchId) {
    const run = runningMatches.get(matchId);
    return run ? run.turnStartTimeMs + constants_1.TURN_MS : null;
}
/** Called periodically; resolve due turns and end match when 5 min or last turn. */
function tick(db) {
    const now = Date.now();
    for (const [matchId, run] of runningMatches.entries()) {
        const elapsed = now - run.matchStartTimeMs;
        if (elapsed >= constants_1.MATCH_MAX_MS) {
            endMatch(db, matchId, run);
            runningMatches.delete(matchId);
            continue;
        }
        const deadline = run.turnStartTimeMs + constants_1.TURN_MS;
        if (now < deadline)
            continue;
        // Resolve this turn
        const state = run.state;
        const actions = [
            (0, arena_race_backend_1.resolveAction)(run.actions.get(actionKey(state.turnIndex, 0)) ?? null, now, run.turnStartTimeMs, state.tokenPositions, 0),
            (0, arena_race_backend_1.resolveAction)(run.actions.get(actionKey(state.turnIndex, 1)) ?? null, now, run.turnStartTimeMs, state.tokenPositions, 1),
            (0, arena_race_backend_1.resolveAction)(run.actions.get(actionKey(state.turnIndex, 2)) ?? null, now, run.turnStartTimeMs, state.tokenPositions, 2),
            (0, arena_race_backend_1.resolveAction)(run.actions.get(actionKey(state.turnIndex, 3)) ?? null, now, run.turnStartTimeMs, state.tokenPositions, 3),
        ];
        const nextState = (0, arena_race_backend_1.resolveTurn)(state, actions);
        // Persist turn
        db_1.turns.insertTurn(db, {
            match_id: matchId,
            turn_index: state.turnIndex,
            state_before: JSON.stringify(state),
            actions: JSON.stringify(actions),
            state_after: JSON.stringify(nextState),
            scores_after: JSON.stringify(nextState.scores),
        });
        run.state = nextState;
        run.turnStartTimeMs = now;
        run.actions.clear();
        // End after 15 turns (or could use DEFAULT_TURNS_PER_MATCH)
        if (nextState.turnIndex >= 15) {
            endMatch(db, matchId, run);
            runningMatches.delete(matchId);
        }
    }
}
function endMatch(db, matchId, run) {
    const placement = (0, arena_race_backend_1.computePlacement)(run.state.scores, run.state.overtakeCounts);
    const now = Date.now();
    db_1.matches.updateMatchStatus(db, matchId, "finalized", {
        ended_at: Math.floor(now / 1000),
        final_placement: JSON.stringify(placement),
    });
    (0, resultSubmit_1.submitResult)(matchId, placement).then((r) => {
        if (!r.ok)
            console.error("submitResult failed:", matchId, r.error);
    }).catch((e) => console.error("submitResult error:", e));
}
