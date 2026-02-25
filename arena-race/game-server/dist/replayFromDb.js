"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayMatchFromDb = replayMatchFromDb;
/**
 * Replay from DB: load match_turns, run backend replayMatch. TDD §13, Plan G11.
 */
const arena_race_backend_1 = require("arena-race-backend");
const db_1 = require("./db");
const db_2 = require("./db");
const db_3 = require("./db");
function replayMatchFromDb(matchId) {
    const db = (0, db_1.getDbInstance)();
    if (!db)
        return { match: false, message: "db not available" };
    const match = db_2.matches.getMatchByMatchId(db, matchId);
    if (!match)
        return { match: false, message: "match not found" };
    if (!match.final_placement)
        return { match: false, message: "match has no final placement" };
    const turnRows = db_3.turns.getTurnsByMatchId(db, matchId);
    if (turnRows.length === 0)
        return { match: false, message: "no turns stored" };
    const storedPlacement = JSON.parse(match.final_placement);
    const turns = turnRows.map((row) => ({
        turnIndex: row.turn_index,
        stateBefore: JSON.parse(row.state_before),
        actions: JSON.parse(row.actions),
        stateAfter: JSON.parse(row.state_after),
    }));
    const result = (0, arena_race_backend_1.replayMatch)(turns, storedPlacement);
    return {
        match: result.match,
        message: result.message,
        storedPlacement: result.storedPlacement ?? undefined,
        replayedPlacement: result.replayedPlacement ?? undefined,
    };
}
