"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMatch = createMatch;
exports.getMatchByMatchId = getMatchByMatchId;
exports.updateMatchStatus = updateMatchStatus;
function createMatch(db, params) {
    const now = Date.now();
    const stmt = db.prepare(`INSERT INTO matches (match_id, tier, status, entry_deadline, created_at)
     VALUES (?, ?, 'pending_entries', ?, ?)`);
    const result = stmt.run(params.match_id, params.tier, params.entry_deadline, now);
    return result.lastInsertRowid;
}
function getMatchByMatchId(db, matchId) {
    const stmt = db.prepare("SELECT * FROM matches WHERE match_id = ?");
    const row = stmt.get(matchId);
    return row ?? null;
}
function updateMatchStatus(db, matchId, status, extra) {
    const updates = ["status = ?"];
    const values = [status];
    if (extra?.started_at !== undefined) {
        updates.push("started_at = ?");
        values.push(extra.started_at);
    }
    if (extra?.ended_at !== undefined) {
        updates.push("ended_at = ?");
        values.push(extra.ended_at);
    }
    if (extra?.final_placement !== undefined) {
        updates.push("final_placement = ?");
        values.push(extra.final_placement);
    }
    if (extra?.contract_tx_hash !== undefined) {
        updates.push("contract_tx_hash = ?");
        values.push(extra.contract_tx_hash);
    }
    values.push(matchId);
    const stmt = db.prepare(`UPDATE matches SET ${updates.join(", ")} WHERE match_id = ?`);
    stmt.run(...values);
}
