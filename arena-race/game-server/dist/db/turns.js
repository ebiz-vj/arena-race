"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertTurn = insertTurn;
exports.getTurnsByMatchId = getTurnsByMatchId;
function insertTurn(db, params) {
    const now = Date.now();
    const stmt = db.prepare(`INSERT INTO match_turns (match_id, turn_index, state_before, actions, state_after, scores_after, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const result = stmt.run(params.match_id, params.turn_index, params.state_before, params.actions, params.state_after, params.scores_after, now);
    return result.lastInsertRowid;
}
function getTurnsByMatchId(db, matchId) {
    const stmt = db.prepare("SELECT * FROM match_turns WHERE match_id = ? ORDER BY turn_index ASC");
    return stmt.all(matchId);
}
