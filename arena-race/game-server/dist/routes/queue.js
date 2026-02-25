"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueRouter = queueRouter;
/**
 * Queue API: join, leave, status (match found). TDD §10.1, Plan G3.
 */
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../db");
const db_2 = require("../db");
const queue_1 = require("../queue");
const ENTRY_WINDOW_SEC = 300; // 5 min, aligned with contract
const queueStore = new queue_1.InMemoryQueueStore();
const VALID_TIERS = ["bronze-10", "bronze-25"];
function isValidTier(tier) {
    return VALID_TIERS.includes(tier);
}
function isWalletAddress(wallet) {
    return /^0x[0-9a-fA-F]{40}$/.test(wallet);
}
function generateMatchId() {
    return "0x" + crypto_1.default.randomBytes(32).toString("hex");
}
function queueRouter() {
    const router = (0, express_1.Router)();
    /** POST /queue/join — body: { tier, wallet }. Identity = wallet for MVP. */
    router.post("/join", (req, res) => {
        const { tier, wallet } = req.body ?? {};
        if (!tier || !wallet || typeof wallet !== "string") {
            res.status(400).json({ error: "tier and wallet required" });
            return;
        }
        if (!isValidTier(tier)) {
            res.status(400).json({ error: "tier must be bronze-10 or bronze-25" });
            return;
        }
        if (!isWalletAddress(wallet)) {
            res.status(400).json({ error: "wallet must be a valid 0x address" });
            return;
        }
        (0, queue_1.clearExpiredAssignments)();
        // Always start a fresh queue attempt for this wallet.
        (0, queue_1.clearAssignment)(wallet);
        const normalizedWallet = wallet.toLowerCase();
        const playerId = normalizedWallet;
        queueStore.add(tier, {
            playerId,
            wallet: normalizedWallet,
            joinedAt: Date.now(),
            tier: tier,
        });
        const four = (0, queue_1.tryFormMatch)(queueStore, tier);
        if (four) {
            const matchId = generateMatchId();
            const entryDeadlineSec = Math.floor(Date.now() / 1000) + ENTRY_WINDOW_SEC;
            const entryDeadlineMs = entryDeadlineSec * 1000;
            const db = (0, db_1.getDbInstance)();
            if (db) {
                db_2.matches.createMatch(db, {
                    match_id: matchId,
                    tier: tier,
                    entry_deadline: entryDeadlineSec,
                });
            }
            (0, queue_1.setAssignmentsForMatch)(four.map((e) => e.wallet), matchId, entryDeadlineMs);
            res.status(200).json({
                status: "match_found",
                matchId,
                entry_deadline: entryDeadlineSec,
            });
            return;
        }
        res.status(200).json({ status: "queued" });
    });
    /** POST /queue/leave — body: { tier, wallet } */
    router.post("/leave", (req, res) => {
        const { tier, wallet } = req.body ?? {};
        if (!tier || !wallet || typeof wallet !== "string") {
            res.status(400).json({ error: "tier and wallet required" });
            return;
        }
        if (!isValidTier(tier)) {
            res.status(400).json({ error: "tier must be bronze-10 or bronze-25" });
            return;
        }
        if (!isWalletAddress(wallet)) {
            res.status(400).json({ error: "wallet must be a valid 0x address" });
            return;
        }
        queueStore.remove(tier, wallet.toLowerCase());
        (0, queue_1.clearAssignment)(wallet);
        res.status(200).json({ status: "left" });
    });
    /** POST /queue/reset — clear queue and match assignments (for Reset everything in local dev). */
    router.post("/reset", (_req, res) => {
        queueStore.clearAll();
        (0, queue_1.clearAllAssignments)();
        res.status(200).json({ status: "ok", message: "Queue and match assignments cleared." });
    });
    /** GET /queue/status?wallet=0x... — polling: match_found or queued/idle */
    router.get("/status", (req, res) => {
        const wallet = req.query.wallet;
        if (!wallet) {
            res.status(400).json({ error: "wallet query required" });
            return;
        }
        if (!isWalletAddress(wallet)) {
            res.status(400).json({ error: "wallet must be a valid 0x address" });
            return;
        }
        (0, queue_1.clearExpiredAssignments)();
        const assignment = (0, queue_1.getAssignment)(wallet);
        if (assignment) {
            res.status(200).json({
                status: "match_found",
                matchId: assignment.matchId,
                entry_deadline: Math.floor(assignment.entryDeadline / 1000),
            });
            return;
        }
        res.status(200).json({ status: "idle" });
    });
    return router;
}
