/**
 * Match: entry-status (G4), start turn loop, action, state. TDD §10.1, Plan G5.
 */
import { Router } from "express";
import { config } from "../config";
import { checkEntryFlow, getMatchInfoFromChain } from "../escrow";
import { EscrowMatchStatus } from "../escrow";
import { getDbInstance } from "../db";
import { matches as matchesDb } from "../db";
import * as TurnLoop from "../turnLoop/TurnLoop";
import { replayMatchFromDb } from "../replayFromDb";

export function matchRouter(): Router {
  const router = Router();

  /** GET /match/entry-status?matchId=0x...&entry_deadline=123 */
  router.get("/entry-status", async (req, res) => {
    const matchId = req.query.matchId as string;
    const entryDeadlineStr = req.query.entry_deadline as string;
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
      const outcome = await checkEntryFlow(
        config.chainRpcUrl,
        config.escrowAddress,
        matchId,
        entryDeadlineSec,
        nowSec
      );
      if (outcome.triggerRefund) {
        const db = getDbInstance();
        if (db) {
          matchesDb.updateMatchStatus(db, matchId, "expired");
        }
      }
      res.status(200).json(outcome);
    } catch (e) {
      console.error("entry-status error:", e);
      res.status(500).json({ shouldStart: false, reason: "pending_entries" });
    }
  });

  /**
   * POST /match/start — body: { matchId }.
   * Server checks entry-status; only starts turn loop when shouldStart (Escrowed).
   */
  router.post("/start", async (req, res) => {
    const matchId = req.body?.matchId;
    if (!matchId || typeof matchId !== "string") {
      res.status(400).json({ error: "matchId required" });
      return;
    }
    const db = getDbInstance();
    if (!db) {
      res.status(500).json({ error: "db not available" });
      return;
    }
    let row = matchesDb.getMatchByMatchId(db, matchId);
    if (!row) {
      const chainInfo = await getMatchInfoFromChain(config.chainRpcUrl, config.escrowAddress, matchId);
      if (!chainInfo || chainInfo.status !== EscrowMatchStatus.Escrowed) {
        res.status(404).json({ error: "match not found or not escrowed; create match via queue or legacy, then enter with 4 players" });
        return;
      }
      matchesDb.createMatch(db, {
        match_id: matchId,
        tier: "bronze-10",
        entry_deadline: chainInfo.entryDeadline,
      });
      row = matchesDb.getMatchByMatchId(db, matchId)!;
    }
    const outcome = await checkEntryFlow(
      config.chainRpcUrl,
      config.escrowAddress,
      matchId,
      row.entry_deadline,
      Math.floor(Date.now() / 1000)
    );
    if (!outcome.shouldStart) {
      const reason = outcome.reason ?? "pending_entries";
      console.warn(
        "[match/start] cannot start:",
        reason,
        "| matchId:",
        matchId.slice(0, 18) + "…",
        "| escrow:",
        config.escrowAddress ? config.escrowAddress.slice(0, 10) + "…" : "(not set)"
      );
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

  /** POST /match/action — body: { matchId, turnIndex, playerIndex, moves: [n,n,n] }. Idempotent. */
  router.post("/action", (req, res) => {
    const { matchId, turnIndex, playerIndex, moves } = req.body ?? {};
    if (!matchId || typeof turnIndex !== "number" || typeof playerIndex !== "number" || !Array.isArray(moves) || moves.length !== 3) {
      res.status(400).json({ error: "matchId, turnIndex, playerIndex, moves[3] required" });
      return;
    }
    const result = TurnLoop.submitAction(
      matchId,
      turnIndex,
      playerIndex,
      [moves[0], moves[1], moves[2]],
      Date.now()
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(200).json({ status: "accepted" });
  });

  /**
   * GET /match/replay?matchId=0x...
   * Load match_turns from DB, run replayMatch; return { match, message?, ... }. G11.
   */
  router.get("/replay", (req, res) => {
    const matchId = req.query.matchId as string;
    if (!matchId) {
      res.status(400).json({ error: "matchId required" });
      return;
    }
    try {
      const result = replayMatchFromDb(matchId);
      res.status(200).json(result);
    } catch (e) {
      console.error("replay error:", e);
      res.status(500).json({ match: false, message: String((e as Error).message) });
    }
  });

  /** GET /match/state?matchId=0x... — current board, scores, turn, time remaining */
  router.get("/state", (req, res) => {
    const matchId = req.query.matchId as string;
    if (!matchId) {
      res.status(400).json({ error: "matchId required" });
      return;
    }
    const state = TurnLoop.getMatchState(matchId);
    const deadline = TurnLoop.getTurnDeadline(matchId);
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
    });
  });

  return router;
}
