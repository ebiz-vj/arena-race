/**
 * Arena Race Game Server — HTTP API and (later) turn loop.
 * Health/readiness for production-ready local development (Plan Phase G1).
 * Persistence: SQLite matches + match_turns (Plan Phase G2).
 */
import express from "express";
import { config } from "./config";
import { initDb } from "./db";
import { queueRouter } from "./routes/queue";
import { matchRouter } from "./routes/match";
import * as TurnLoop from "./turnLoop/TurnLoop";
import { getDbInstance } from "./db";

// Persistence: init DB and create tables on first run
initDb(config.dbPath);

const app = express();

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
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", ts: Date.now() });
});

app.get("/ready", (_req, res) => {
  res.status(200).json({ ready: true });
});

app.use("/queue", queueRouter());
app.use("/match", matchRouter());

// Turn loop tick every 1s (G5)
setInterval(() => {
  const db = getDbInstance();
  if (db) TurnLoop.tick(db);
}, 1000);

const server = app.listen(config.port, () => {
  console.log(`Game server listening on http://127.0.0.1:${config.port}`);
  console.log("  GET /health, GET /ready");
  console.log("  POST /queue/join, POST /queue/leave, GET /queue/status");
  console.log("  GET /match/entry-status?matchId=0x...&entry_deadline=...");
});

export { app, server };
