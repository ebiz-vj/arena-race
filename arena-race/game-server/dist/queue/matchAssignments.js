"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAssignment = setAssignment;
exports.getAssignment = getAssignment;
exports.clearAssignment = clearAssignment;
exports.clearExpiredAssignments = clearExpiredAssignments;
exports.clearAllAssignments = clearAllAssignments;
exports.setAssignmentsForMatch = setAssignmentsForMatch;
const assignmentsByWallet = new Map();
const ASSIGNMENT_STALE_GRACE_MS = 30000;
function isStale(assignment, nowMs) {
    return nowMs > assignment.entryDeadline + ASSIGNMENT_STALE_GRACE_MS;
}
function setAssignment(wallet, matchId, entryDeadline) {
    assignmentsByWallet.set(wallet.toLowerCase(), { matchId, entryDeadline });
}
function getAssignment(wallet) {
    const key = wallet.toLowerCase();
    const assignment = assignmentsByWallet.get(key);
    if (!assignment)
        return null;
    if (isStale(assignment, Date.now())) {
        assignmentsByWallet.delete(key);
        return null;
    }
    return assignment;
}
function clearAssignment(wallet) {
    assignmentsByWallet.delete(wallet.toLowerCase());
}
/** Remove expired assignments so stale matches don't leak into new queue sessions. */
function clearExpiredAssignments(nowMs = Date.now()) {
    for (const [wallet, assignment] of assignmentsByWallet.entries()) {
        if (isStale(assignment, nowMs)) {
            assignmentsByWallet.delete(wallet);
        }
    }
}
/** Clear all match assignments (for Reset everything in local dev). */
function clearAllAssignments() {
    assignmentsByWallet.clear();
}
function setAssignmentsForMatch(wallets, matchId, entryDeadline) {
    for (const w of wallets) {
        setAssignment(w, matchId, entryDeadline);
    }
}
