/**
 * Queue API: join, leave, status (match found). TDD §10.1, Plan G3.
 */
import { Router } from "express";
import crypto from "crypto";
import { getDbInstance } from "../db";
import { matches } from "../db";
import {
  InMemoryQueueStore,
  tryFormMatch,
  setAssignmentsForMatch,
  getAssignment,
  type Tier,
} from "../queue";

const ENTRY_WINDOW_SEC = 300; // 5 min, aligned with contract

const queueStore = new InMemoryQueueStore();
const VALID_TIERS: Tier[] = ["bronze-10", "bronze-25"];

function isValidTier(tier: string): tier is Tier {
  return VALID_TIERS.includes(tier as Tier);
}

function generateMatchId(): string {
  return "0x" + crypto.randomBytes(32).toString("hex");
}

export function queueRouter(): Router {
  const router = Router();

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
    const playerId = wallet;
    queueStore.add(tier as Tier, {
      playerId,
      wallet,
      joinedAt: Date.now(),
      tier: tier as Tier,
    });

    const four = tryFormMatch(queueStore, tier as Tier);
    if (four) {
      const matchId = generateMatchId();
      const entryDeadlineSec = Math.floor(Date.now() / 1000) + ENTRY_WINDOW_SEC;
      const entryDeadlineMs = entryDeadlineSec * 1000;

      const db = getDbInstance();
      if (db) {
        matches.createMatch(db, {
          match_id: matchId,
          tier: tier as Tier,
          entry_deadline: entryDeadlineSec,
        });
      }
      setAssignmentsForMatch(
        four.map((e) => e.wallet),
        matchId,
        entryDeadlineMs
      );
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
    queueStore.remove(tier as Tier, wallet);
    res.status(200).json({ status: "left" });
  });

  /** GET /queue/status?wallet=0x... — polling: match_found or queued/idle */
  router.get("/status", (req, res) => {
    const wallet = req.query.wallet as string;
    if (!wallet) {
      res.status(400).json({ error: "wallet query required" });
      return;
    }
    const assignment = getAssignment(wallet);
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
