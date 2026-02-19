"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscrowMatchStatus = exports.ENTRY_WINDOW_SEC = void 0;
/**
 * Entry flow types. TDD §7.7, §3.4.
 * Match status aligned with contract enum (PendingEntries=0, Escrowed=1, Expired=2, Refunded=3, Resolved=4).
 */
exports.ENTRY_WINDOW_SEC = 300;
var EscrowMatchStatus;
(function (EscrowMatchStatus) {
    EscrowMatchStatus[EscrowMatchStatus["PendingEntries"] = 0] = "PendingEntries";
    EscrowMatchStatus[EscrowMatchStatus["Escrowed"] = 1] = "Escrowed";
    EscrowMatchStatus[EscrowMatchStatus["Expired"] = 2] = "Expired";
    EscrowMatchStatus[EscrowMatchStatus["Refunded"] = 3] = "Refunded";
    EscrowMatchStatus[EscrowMatchStatus["Resolved"] = 4] = "Resolved";
})(EscrowMatchStatus || (exports.EscrowMatchStatus = EscrowMatchStatus = {}));
