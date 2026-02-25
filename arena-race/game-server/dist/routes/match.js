"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchRouter = matchRouter;
/**
 * Match: entry-status (G4), start turn loop, action, state. TDD §10.1, Plan G5.
 */
const express_1 = require("express");
const config_1 = require("../config");
const escrow_1 = require("../escrow");
const escrow_2 = require("../escrow");
const db_1 = require("../db");
const db_2 = require("../db");
const TurnLoop = __importStar(require("../turnLoop/TurnLoop"));
const replayFromDb_1 = require("../replayFromDb");
const MATCH_ID_HEX_32 = /^0x[0-9a-fA-F]{64}$/;
function matchRouter() {
    const router = (0, express_1.Router)();
    /** GET /match/status?matchId=0x...&escrowAddress=0x... — match status from chain. Use escrowAddress from request so frontend and server always use same contract. */
    router.get("/status", async (req, res) => {
        const matchId = req.query.matchId;
        const escrowFromQuery = typeof req.query.escrowAddress === "string" && req.query.escrowAddress.startsWith("0x")
            ? req.query.escrowAddress
            : "";
        if (!matchId || typeof matchId !== "string" || !matchId.startsWith("0x")) {
            res.status(400).json({ error: "matchId required (0x...)" });
            return;
        }
        const escrowAddress = escrowFromQuery || config_1.config.escrowAddress;
        if (!escrowAddress) {
            res.status(503).json({ error: "escrow not configured; send escrowAddress in query or set ESCROW_ADDRESS / deployed-local.json" });
            return;
        }
        try {
            const info = await (0, escrow_1.getMatchStatusFromChain)(config_1.config.chainRpcUrl, escrowAddress, matchId);
            if (!info) {
                console.warn("[match/status] 404: match not found on chain", "| matchId:", matchId.slice(0, 18) + "…", "| escrow:", escrowAddress.slice(0, 10) + "…", "| rpc:", config_1.config.chainRpcUrl?.slice(0, 40) + "…");
                res.status(404).json({ error: "match not found or no contract" });
                return;
            }
            res.status(200).json(info);
        }
        catch (e) {
            console.error("[match/status] error:", e);
            res.status(500).json({ error: "failed to read match from chain" });
        }
    });
    /** GET /match/entry-status?matchId=0x...&entry_deadline=123 */
    router.get("/entry-status", async (req, res) => {
        const matchId = req.query.matchId;
        const entryDeadlineStr = req.query.entry_deadline;
        if (!matchId || !entryDeadlineStr) {
            res.status(400).json({ error: "matchId and entry_deadline required" });
            return;
        }
        const entryDeadlineSec = parseInt(entryDeadlineStr, 10);
        if (isNaN(entryDeadlineSec)) {
            res.status(400).json({ error: "entry_deadline must be Unix seconds" });
            return;
        }
        const nowSec = Math.floor(Date.now() / 1000);
        try {
            const outcome = await (0, escrow_1.checkEntryFlow)(config_1.config.chainRpcUrl, config_1.config.escrowAddress, matchId, entryDeadlineSec, nowSec);
            if (outcome.triggerRefund) {
                const db = (0, db_1.getDbInstance)();
                if (db) {
                    db_2.matches.updateMatchStatus(db, matchId, "expired");
                }
            }
            res.status(200).json(outcome);
        }
        catch (e) {
            console.error("entry-status error:", e);
            res.status(500).json({ shouldStart: false, reason: "pending_entries" });
        }
    });
    /**
     * POST /match/start — body: { matchId, escrowAddress? }.
     * Server checks entry-status; only starts turn loop when shouldStart (Escrowed). Use escrowAddress from body when provided so frontend and server use same contract.
     */
    router.post("/start", async (req, res) => {
        const matchId = req.body?.matchId;
        const escrowFromBody = typeof req.body?.escrowAddress === "string" && req.body.escrowAddress.startsWith("0x")
            ? req.body.escrowAddress
            : "";
        if (!matchId || typeof matchId !== "string") {
            res.status(400).json({ error: "matchId required" });
            return;
        }
        const escrowAddress = escrowFromBody || config_1.config.escrowAddress;
        if (!escrowAddress) {
            res.status(503).json({ error: "escrow not configured; send escrowAddress in body or set ESCROW_ADDRESS / deployed-local.json" });
            return;
        }
        const db = (0, db_1.getDbInstance)();
        if (!db) {
            res.status(500).json({ error: "db not available" });
            return;
        }
        let row = db_2.matches.getMatchByMatchId(db, matchId);
        if (!row) {
            const chainInfo = await (0, escrow_1.getMatchInfoFromChain)(config_1.config.chainRpcUrl, escrowAddress, matchId);
            if (!chainInfo || chainInfo.status !== escrow_2.EscrowMatchStatus.Escrowed) {
                res.status(404).json({ error: "match not found or not escrowed; create match via queue or legacy, then enter with 4 players" });
                return;
            }
            db_2.matches.createMatch(db, {
                match_id: matchId,
                tier: "bronze-10",
                entry_deadline: chainInfo.entryDeadline,
            });
            row = db_2.matches.getMatchByMatchId(db, matchId);
        }
        const outcome = await (0, escrow_1.checkEntryFlow)(config_1.config.chainRpcUrl, escrowAddress, matchId, row.entry_deadline, Math.floor(Date.now() / 1000));
        if (!outcome.shouldStart) {
            const reason = outcome.reason ?? "pending_entries";
            console.warn("[match/start] cannot start:", reason, "| matchId:", matchId.slice(0, 18) + "…", "| escrow:", escrowAddress ? escrowAddress.slice(0, 10) + "…" : "(not set)");
            res.status(400).json({ error: "cannot start", reason });
            return;
        }
        const result = TurnLoop.startMatch(db, matchId);
        if (!result.ok) {
            res.status(400).json({ error: result.error });
            return;
        }
        res.status(200).json({ status: "started" });
    });
    /** POST /match/action — body: { matchId, turnIndex, playerIndex, moves: [n,n,n] }. Manual mode: submit action; resolve when all 4 submitted. */
    router.post("/action", (req, res) => {
        const { matchId, turnIndex, playerIndex, moves } = req.body ?? {};
        if (!MATCH_ID_HEX_32.test(String(matchId ?? ""))) {
            res.status(400).json({ error: "matchId must be 0x + 64 hex chars (bytes32)" });
            return;
        }
        if (typeof turnIndex !== "number" ||
            !Number.isInteger(turnIndex) ||
            typeof playerIndex !== "number" ||
            !Number.isInteger(playerIndex) ||
            !Array.isArray(moves) ||
            moves.length !== 3) {
            res.status(400).json({ error: "matchId, turnIndex, playerIndex, moves[3] required" });
            return;
        }
        const move0 = Number(moves[0]);
        const move1 = Number(moves[1]);
        const move2 = Number(moves[2]);
        const db = (0, db_1.getDbInstance)();
        if (!db) {
            res.status(500).json({ error: "db not available" });
            return;
        }
        const result = TurnLoop.submitAction(matchId, turnIndex, playerIndex, [move0, move1, move2], Date.now());
        if (!result.ok) {
            const statusCode = typeof result.expectedTurnIndex === "number" ? 409 : 400;
            res.status(statusCode).json({
                error: result.error,
                expectedTurnIndex: result.expectedTurnIndex,
            });
            return;
        }
        const outcome = TurnLoop.resolveTurnIfReady(db, matchId);
        if (!outcome.ok) {
            res.status(400).json({ error: outcome.error ?? "failed to process action" });
            return;
        }
        res.status(200).json({
            status: "accepted",
            resolved: outcome.resolved,
            resolvedTurnIndex: outcome.resolvedTurnIndex,
            nextTurnIndex: outcome.nextTurnIndex,
            turnIndex: outcome.turnIndex,
            submittedPlayers: outcome.submittedPlayers,
            pendingPlayers: outcome.pendingPlayers,
        });
    });
    /** POST /match/resolve-turn — body: { matchId }. Manual mode fallback: resolve current turn with submitted actions + defaults for missing players. */
    router.post("/resolve-turn", (req, res) => {
        const matchId = req.body?.matchId;
        if (!MATCH_ID_HEX_32.test(String(matchId ?? ""))) {
            res.status(400).json({ error: "matchId must be 0x + 64 hex chars (bytes32)" });
            return;
        }
        const db = (0, db_1.getDbInstance)();
        if (!db) {
            res.status(500).json({ error: "db not available" });
            return;
        }
        const outcome = TurnLoop.resolveTurnNow(db, matchId);
        if (!outcome.ok) {
            res.status(400).json({
                error: outcome.error ?? "failed to resolve turn",
                turnIndex: outcome.turnIndex,
                submittedPlayers: outcome.submittedPlayers,
                pendingPlayers: outcome.pendingPlayers,
            });
            return;
        }
        res.status(200).json({
            status: "resolved",
            resolved: outcome.resolved,
            resolvedTurnIndex: outcome.resolvedTurnIndex,
            nextTurnIndex: outcome.nextTurnIndex,
            submittedPlayers: outcome.submittedPlayers,
            pendingPlayers: outcome.pendingPlayers,
        });
    });
    /**
     * GET /match/replay?matchId=0x...
     * Load match_turns from DB, run replayMatch; return { match, message?, ... }. G11.
     */
    router.get("/replay", (req, res) => {
        const matchId = req.query.matchId;
        if (!matchId) {
            res.status(400).json({ error: "matchId required" });
            return;
        }
        try {
            const result = (0, replayFromDb_1.replayMatchFromDb)(matchId);
            res.status(200).json(result);
        }
        catch (e) {
            console.error("replay error:", e);
            res.status(500).json({ match: false, message: String(e.message) });
        }
    });
    /** GET /match/state?matchId=0x... — current board, scores, turn, pending submissions */
    router.get("/state", (req, res) => {
        const matchId = req.query.matchId;
        if (!matchId) {
            res.status(400).json({ error: "matchId required" });
            return;
        }
        const state = TurnLoop.getMatchState(matchId);
        const deadline = TurnLoop.getTurnDeadline(matchId);
        const submittedPlayers = TurnLoop.getSubmittedPlayers(matchId);
        const pendingPlayers = [0, 1, 2, 3].filter((p) => !submittedPlayers.includes(p));
        if (!state) {
            res.status(404).json({ error: "match not running or not found" });
            return;
        }
        res.status(200).json({
            turnIndex: state.turnIndex,
            tokenPositions: state.tokenPositions,
            scores: state.scores,
            overtakeCounts: state.overtakeCounts,
            turnDeadlineMs: deadline ?? undefined,
            submittedPlayers,
            pendingPlayers,
        });
    });
    return router;
}
