"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMatch = startMatch;
exports.submitAction = submitAction;
exports.getMatchState = getMatchState;
exports.getSubmittedPlayers = getSubmittedPlayers;
exports.getTurnDeadline = getTurnDeadline;
exports.resolveTurnIfReady = resolveTurnIfReady;
exports.resolveTurnNow = resolveTurnNow;
exports.tick = tick;
const arena_race_backend_1 = require("arena-race-backend");
const constants_1 = require("./constants");
const db_1 = require("../db");
const resultSubmit_1 = require("../resultSubmit");
const runningMatches = new Map();
function actionKey(turnIndex, playerIndex) {
    return `${turnIndex}:${playerIndex}`;
}
function isLegalStep(currentTile, targetTile) {
    if (targetTile === currentTile)
        return true;
    const currentRow = Math.floor(currentTile / 7);
    const currentCol = currentTile % 7;
    const targetRow = Math.floor(targetTile / 7);
    const targetCol = targetTile % 7;
    const rowAdvance = currentRow - targetRow; // toward finish = row decreases
    if (rowAdvance < 0 || rowAdvance > 2)
        return false; // no backward move; max 2 rows
    if (Math.abs(targetCol - currentCol) > 1)
        return false; // max 1 column sideways
    return true;
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
    const currentTurn = run.state.turnIndex;
    if (turnIndex !== currentTurn) {
        return {
            ok: false,
            error: `wrong turn index (expected ${currentTurn}, got ${turnIndex})`,
            expectedTurnIndex: currentTurn,
        };
    }
    if (playerIndex < 0 || playerIndex > 3) {
        return { ok: false, error: "invalid player index" };
    }
    const currentPositions = run.state.tokenPositions[playerIndex];
    const normalizedMoves = [0, 0, 0];
    for (let token = 0; token < 3; token++) {
        const currentTile = currentPositions[token];
        const targetTile = moves[token];
        if (currentTile < 0) {
            // Eliminated tokens stay eliminated regardless of submitted target.
            normalizedMoves[token] = -1;
            continue;
        }
        if (!Number.isInteger(targetTile) || targetTile < 0 || targetTile > 48) {
            return { ok: false, error: `invalid move for token ${token}; expected integer tile 0..48` };
        }
        if (!isLegalStep(currentTile, targetTile)) {
            return {
                ok: false,
                error: `illegal move for token ${token}; from ${currentTile} you may stay or move up 1-2 rows with at most 1 column shift`,
            };
        }
        normalizedMoves[token] = targetTile;
    }
    const key = actionKey(currentTurn, playerIndex);
    run.actions.set(key, { action: { moves: normalizedMoves }, receivedAtMs });
    return { ok: true };
}
function getMatchState(matchId) {
    const run = runningMatches.get(matchId);
    return run ? run.state : null;
}
function submittedPlayersForRun(run) {
    const turnIndex = run.state.turnIndex;
    const submitted = [];
    for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
        if (run.actions.has(actionKey(turnIndex, playerIndex)))
            submitted.push(playerIndex);
    }
    return submitted;
}
function pendingPlayersFromSubmitted(submitted) {
    return [0, 1, 2, 3].filter((p) => !submitted.includes(p));
}
function getSubmittedPlayers(matchId) {
    const run = runningMatches.get(matchId);
    if (!run)
        return [];
    return submittedPlayersForRun(run);
}
function getTurnDeadline(_matchId) {
    return null;
}
function actionsForCurrentTurn(run) {
    const state = run.state;
    const a0 = run.actions.get(actionKey(state.turnIndex, 0));
    const a1 = run.actions.get(actionKey(state.turnIndex, 1));
    const a2 = run.actions.get(actionKey(state.turnIndex, 2));
    const a3 = run.actions.get(actionKey(state.turnIndex, 3));
    return [
        a0?.action ?? (0, arena_race_backend_1.defaultAction)(state.tokenPositions[0]),
        a1?.action ?? (0, arena_race_backend_1.defaultAction)(state.tokenPositions[1]),
        a2?.action ?? (0, arena_race_backend_1.defaultAction)(state.tokenPositions[2]),
        a3?.action ?? (0, arena_race_backend_1.defaultAction)(state.tokenPositions[3]),
    ];
}
function resolveCurrentTurn(db, matchId, run) {
    const state = run.state;
    const submittedPlayers = submittedPlayersForRun(run);
    const actions = actionsForCurrentTurn(run);
    const nextState = (0, arena_race_backend_1.resolveTurn)(state, actions);
    db_1.turns.insertTurn(db, {
        match_id: matchId,
        turn_index: state.turnIndex,
        state_before: JSON.stringify(state),
        actions: JSON.stringify(actions),
        state_after: JSON.stringify(nextState),
        scores_after: JSON.stringify(nextState.scores),
    });
    run.state = nextState;
    run.actions.clear();
    if (nextState.turnIndex >= constants_1.DEFAULT_TURNS_PER_MATCH) {
        endMatch(db, matchId, run);
        runningMatches.delete(matchId);
    }
    return {
        ok: true,
        resolved: true,
        resolvedTurnIndex: state.turnIndex,
        nextTurnIndex: nextState.turnIndex,
        submittedPlayers,
        pendingPlayers: [],
    };
}
function resolveTurnIfReady(db, matchId) {
    const run = runningMatches.get(matchId);
    if (!run) {
        return {
            ok: false,
            error: "match not running",
            resolved: false,
            submittedPlayers: [],
            pendingPlayers: [0, 1, 2, 3],
        };
    }
    const submittedPlayers = submittedPlayersForRun(run);
    if (submittedPlayers.length < 4) {
        return {
            ok: true,
            resolved: false,
            submittedPlayers,
            pendingPlayers: pendingPlayersFromSubmitted(submittedPlayers),
            turnIndex: run.state.turnIndex,
        };
    }
    return resolveCurrentTurn(db, matchId, run);
}
/**
 * Resolve the current turn immediately using submitted actions.
 * Missing players default to no-op for this turn.
 */
function resolveTurnNow(db, matchId) {
    const run = runningMatches.get(matchId);
    if (!run) {
        return {
            ok: false,
            error: "match not running",
            resolved: false,
            submittedPlayers: [],
            pendingPlayers: [0, 1, 2, 3],
        };
    }
    const submittedPlayers = submittedPlayersForRun(run);
    if (submittedPlayers.length === 0) {
        return {
            ok: false,
            error: "no moves submitted for current turn",
            resolved: false,
            submittedPlayers,
            pendingPlayers: pendingPlayersFromSubmitted(submittedPlayers),
            turnIndex: run.state.turnIndex,
        };
    }
    return resolveCurrentTurn(db, matchId, run);
}
/** Timer-based turn resolution is disabled in manual local-testing mode. */
function tick(_db) {
    // Intentionally no-op.
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
