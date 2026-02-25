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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = exports.app = void 0;
/**
 * Arena Race Game Server — HTTP API and (later) turn loop.
 * Health/readiness for production-ready local development (Plan Phase G1).
 * Persistence: SQLite matches + match_turns (Plan Phase G2).
 */
const express_1 = __importDefault(require("express"));
const config_1 = require("./config");
const db_1 = require("./db");
const queue_1 = require("./routes/queue");
const match_1 = require("./routes/match");
const TurnLoop = __importStar(require("./turnLoop/TurnLoop"));
const db_2 = require("./db");
// Persistence: init DB and create tables on first run
(0, db_1.initDb)(config_1.config.dbPath);
const app = (0, express_1.default)();
exports.app = app;
// CORS: allow webapp (and any localhost) to call the API
app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
    }
    next();
});
app.use(express_1.default.json());
app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", ts: Date.now() });
});
app.get("/ready", (_req, res) => {
    res.status(200).json({ ready: true });
});
app.use("/queue", (0, queue_1.queueRouter)());
app.use("/match", (0, match_1.matchRouter)());
// Turn loop tick every 1s (G5)
setInterval(() => {
    const db = (0, db_2.getDbInstance)();
    if (db)
        TurnLoop.tick(db);
}, 1000);
const server = app.listen(config_1.config.port, () => {
    console.log(`Game server listening on http://127.0.0.1:${config_1.config.port}`);
    console.log("  GET /health, GET /ready");
    console.log("  POST /queue/join, POST /queue/leave, GET /queue/status");
    console.log("  GET /match/entry-status?matchId=0x...&entry_deadline=...");
});
exports.server = server;
