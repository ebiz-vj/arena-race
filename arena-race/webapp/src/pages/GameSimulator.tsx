import { useEffect, useMemo, useState } from "react";

type PlayerScore = {
  positionPoints: number;
  zonePoints: number;
  overtakePoints: number;
  survivalPoints: number;
  total: number;
};

type SimState = {
  turnIndex: number;
  tokenPositions: number[][];
  scores: PlayerScore[];
  overtakeCounts: number[];
};

type MoveDiff = {
  player: number;
  token: number;
  from: number;
  to: number;
};

type ResolveTurnResult = {
  next: SimState;
  moved: MoveDiff[];
};

type MatchResult = {
  payouts: number[];
  placeLabels: string[];
  orderedPlayers: number[];
  distributedPool: number;
};

const PLAYER_INDICES = [0, 1, 2, 3] as const;
type PlayerIndex = (typeof PLAYER_INDICES)[number];

const BOARD_SIZE = 7;
const TILE_MAX = BOARD_SIZE * BOARD_SIZE - 1;
const FEE_PCT = 8;
const PAYOUT_PCTS = [38, 30, 20, 12] as const;
const TRAP_TILES = [12, 24, 36] as const;
const START_LANES = [
  [42, 43, 44],
  [45, 46, 47],
  [35, 36, 37],
  [38, 39, 40],
] as const;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function money(value: number): string {
  return round2(value).toFixed(2);
}

function playerLabel(player: number): string {
  return `P${player + 1}`;
}

function startPositions(tokenCount: number): number[][] {
  return START_LANES.map((lane) => lane.slice(0, tokenCount));
}

function makeScore(): PlayerScore {
  return {
    positionPoints: 0,
    zonePoints: 0,
    overtakePoints: 0,
    survivalPoints: 0,
    total: 0,
  };
}

function createInitialState(tokenCount: number): SimState {
  return {
    turnIndex: 0,
    tokenPositions: startPositions(tokenCount),
    scores: [makeScore(), makeScore(), makeScore(), makeScore()],
    overtakeCounts: [0, 0, 0, 0],
  };
}

function isLegalStep(from: number, to: number): boolean {
  if (to === from) return true;
  const fromRow = Math.floor(from / BOARD_SIZE);
  const fromCol = from % BOARD_SIZE;
  const toRow = Math.floor(to / BOARD_SIZE);
  const toCol = to % BOARD_SIZE;
  const rowAdvance = fromRow - toRow;
  if (rowAdvance < 0 || rowAdvance > 2) return false;
  if (Math.abs(toCol - fromCol) > 1) return false;
  return true;
}

function validateMoves(current: number[], moves: number[]): string | null {
  if (current.length !== moves.length) return "Move count mismatch.";
  for (let token = 0; token < current.length; token++) {
    const from = current[token];
    const to = moves[token];
    if (from < 0) {
      if (to !== -1) return `Token ${token} is eliminated and must remain -1.`;
      continue;
    }
    if (!Number.isInteger(to) || to < 0 || to > TILE_MAX) {
      return `Token ${token} must target an integer tile 0-48.`;
    }
    if (!isLegalStep(from, to)) {
      return `Token ${token}: illegal step ${from} -> ${to}.`;
    }
  }
  return null;
}

function defaultAction(current: number[]): number[] {
  return current.map((tile) => (tile < 0 ? -1 : tile));
}

function resolveTurn(state: SimState, actions: Array<number[] | null>): ResolveTurnResult {
  const effectiveActions = PLAYER_INDICES.map((player) => actions[player] ?? defaultAction(state.tokenPositions[player]));
  const moved = state.tokenPositions.map((row) => [...row]);
  for (let p = 0; p < moved.length; p++) {
    for (let t = 0; t < moved[p].length; t++) {
      if (moved[p][t] < 0) continue;
      moved[p][t] = effectiveActions[p][t];
    }
  }

  const trapSet = new Set(TRAP_TILES);
  const afterTrap = moved.map((row) => [...row]);
  for (let p = 0; p < afterTrap.length; p++) {
    for (let t = 0; t < afterTrap[p].length; t++) {
      if (afterTrap[p][t] >= 0 && trapSet.has(afterTrap[p][t] as (typeof TRAP_TILES)[number])) {
        afterTrap[p][t] = -1;
      }
    }
  }

  const zonePoints = [0, 0, 0, 0];
  const playersInRow = Array.from({ length: BOARD_SIZE }, () => new Set<number>());
  for (let p = 0; p < afterTrap.length; p++) {
    for (const tile of afterTrap[p]) {
      if (tile < 0) continue;
      playersInRow[Math.floor(tile / BOARD_SIZE)].add(p);
    }
  }
  for (let row = 0; row < BOARD_SIZE; row++) {
    if (playersInRow[row].size < 2) continue;
    for (const p of playersInRow[row]) zonePoints[p] += 2;
  }

  const overtakeAdds = [0, 0, 0, 0];
  for (let p = 0; p < PLAYER_INDICES.length; p++) {
    const overtakenPlayers = new Set<number>();
    for (let q = 0; q < PLAYER_INDICES.length; q++) {
      if (q === p) continue;
      let foundPair = false;
      for (let i = 0; i < state.tokenPositions[p].length && !foundPair; i++) {
        for (let j = 0; j < state.tokenPositions[q].length; j++) {
          const prevP = state.tokenPositions[p][i];
          const prevQ = state.tokenPositions[q][j];
          const nextP = afterTrap[p][i];
          const nextQ = afterTrap[q][j];
          if (prevP < 0 || prevQ < 0 || nextP < 0 || nextQ < 0) continue;
          if (prevP < prevQ && nextP > nextQ) {
            overtakenPlayers.add(q);
            foundPair = true;
            break;
          }
        }
      }
    }
    const capLeft = Math.max(0, 8 - state.overtakeCounts[p]);
    overtakeAdds[p] = Math.min(capLeft, overtakenPlayers.size);
  }
  const newOvertakes = PLAYER_INDICES.map((p) => state.overtakeCounts[p] + overtakeAdds[p]);

  const tileCounts = new Map<number, number>();
  for (let p = 0; p < afterTrap.length; p++) {
    for (const tile of afterTrap[p]) {
      if (tile < 0) continue;
      tileCounts.set(tile, (tileCounts.get(tile) ?? 0) + 1);
    }
  }
  const survivalPoints = [0, 0, 0, 0];
  for (let p = 0; p < afterTrap.length; p++) {
    let safe = 0;
    for (const tile of afterTrap[p]) {
      if (tile < 0) continue;
      if (trapSet.has(tile as (typeof TRAP_TILES)[number])) continue;
      if ((tileCounts.get(tile) ?? 0) >= 2) continue;
      safe++;
    }
    survivalPoints[p] = safe * 0.5;
  }

  const positionPoints = [0, 0, 0, 0];
  for (let p = 0; p < afterTrap.length; p++) {
    for (const tile of afterTrap[p]) {
      if (tile < 0) continue;
      const row = Math.floor(tile / BOARD_SIZE);
      positionPoints[p] += 0.13 * (6 - row);
    }
    positionPoints[p] = round2(positionPoints[p]);
  }

  const nextScores = state.scores.map((prev, p) => {
    const next: PlayerScore = { ...prev };
    next.positionPoints = round2(next.positionPoints + positionPoints[p]);
    next.zonePoints = round2(next.zonePoints + zonePoints[p]);
    next.overtakePoints = round2(newOvertakes[p] * 4);
    next.survivalPoints = round2(next.survivalPoints + survivalPoints[p]);
    next.total = round2(next.positionPoints + next.zonePoints + next.overtakePoints + next.survivalPoints);
    return next;
  });

  const movedDiff: MoveDiff[] = [];
  for (let p = 0; p < afterTrap.length; p++) {
    for (let t = 0; t < afterTrap[p].length; t++) {
      const from = state.tokenPositions[p][t];
      const to = afterTrap[p][t];
      if (from !== to) movedDiff.push({ player: p, token: t, from, to });
    }
  }

  return {
    next: {
      turnIndex: state.turnIndex + 1,
      tokenPositions: afterTrap,
      scores: nextScores,
      overtakeCounts: newOvertakes,
    },
    moved: movedDiff,
  };
}

function rankAndPayout(scores: PlayerScore[], overtakes: number[], pool: number): MatchResult {
  const ordered = [0, 1, 2, 3].sort((a, b) => {
    if (scores[b].total !== scores[a].total) return scores[b].total - scores[a].total;
    const ozA = scores[a].overtakePoints + scores[a].zonePoints;
    const ozB = scores[b].overtakePoints + scores[b].zonePoints;
    if (ozB !== ozA) return ozB - ozA;
    if (overtakes[b] !== overtakes[a]) return overtakes[b] - overtakes[a];
    return a - b;
  });

  const payouts = [0, 0, 0, 0];
  const labels = ["4", "4", "4", "4"];
  let cursor = 0;
  while (cursor < 4) {
    const tieGroup = [ordered[cursor]];
    while (
      cursor + tieGroup.length < 4 &&
      scores[ordered[cursor]].total === scores[ordered[cursor + tieGroup.length]].total &&
      scores[ordered[cursor]].overtakePoints + scores[ordered[cursor]].zonePoints ===
        scores[ordered[cursor + tieGroup.length]].overtakePoints + scores[ordered[cursor + tieGroup.length]].zonePoints &&
      overtakes[ordered[cursor]] === overtakes[ordered[cursor + tieGroup.length]]
    ) {
      tieGroup.push(ordered[cursor + tieGroup.length]);
    }
    const pct = PAYOUT_PCTS.slice(cursor, cursor + tieGroup.length).reduce((a, b) => a + b, 0);
    const each = round2((pool * pct) / 100 / tieGroup.length);
    const label = tieGroup.length > 1 ? `T${cursor + 1}` : String(cursor + 1);
    for (const player of tieGroup) {
      payouts[player] = each;
      labels[player] = label;
    }
    cursor += tieGroup.length;
  }
  const distributed = round2(payouts.reduce((a, b) => a + b, 0));
  const remainder = round2(pool - distributed);
  if (Math.abs(remainder) > 0) {
    payouts[ordered[0]] = round2(payouts[ordered[0]] + remainder);
  }
  return {
    payouts,
    placeLabels: labels,
    orderedPlayers: ordered,
    distributedPool: round2(payouts.reduce((a, b) => a + b, 0)),
  };
}

function randomLegalMove(from: number): number {
  if (from < 0) return -1;
  const fromRow = Math.floor(from / BOARD_SIZE);
  const fromCol = from % BOARD_SIZE;
  const options = [from];
  for (let up = 1; up <= 2; up++) {
    const row = fromRow - up;
    if (row < 0) continue;
    for (let shift = -1; shift <= 1; shift++) {
      const col = fromCol + shift;
      if (col < 0 || col > 6) continue;
      options.push(row * BOARD_SIZE + col);
    }
  }
  return options[Math.floor(Math.random() * options.length)];
}

export default function GameSimulator() {
  const [tokenMode, setTokenMode] = useState<2 | 3>(3);
  const [turnLimit, setTurnLimit] = useState(15);
  const [entryAmount, setEntryAmount] = useState(10);
  const [defaultBalance, setDefaultBalance] = useState(200);
  const [balances, setBalances] = useState([200, 200, 200, 200]);
  const [treasuryBalance, setTreasuryBalance] = useState(0);
  const [activeRewardPool, setActiveRewardPool] = useState(0);
  const [activeFee, setActiveFee] = useState(0);
  const [matchStatus, setMatchStatus] = useState<"idle" | "running" | "finished">("idle");
  const [state, setState] = useState<SimState | null>(null);
  const [drafts, setDrafts] = useState<string[][]>(startPositions(3).map((row) => row.map(String)));
  const [queuedActions, setQueuedActions] = useState<Array<number[] | null>>([null, null, null, null]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerIndex>(0);
  const [selectedToken, setSelectedToken] = useState(0);
  const [waitForAllSubmissions, setWaitForAllSubmissions] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [recentMoves, setRecentMoves] = useState<MoveDiff[]>([]);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    document.title = "Game Simulator - Arena Race";
    return () => {
      document.title = "Arena Race";
    };
  }, []);

  useEffect(() => {
    if (matchStatus !== "running") {
      const starts = startPositions(tokenMode);
      setDrafts(starts.map((row) => row.map(String)));
      if (selectedToken >= tokenMode) setSelectedToken(0);
    }
  }, [matchStatus, tokenMode, selectedToken]);

  const canInteract = matchStatus === "running" && state != null;
  const boardPositions = state?.tokenPositions ?? startPositions(tokenMode);
  const selectedDraft = drafts[selectedPlayer] ?? [];
  const submittedPlayers = useMemo(
    () => PLAYER_INDICES.filter((p) => queuedActions[p] != null),
    [queuedActions]
  );
  const pendingPlayers = useMemo(
    () => PLAYER_INDICES.filter((p) => queuedActions[p] == null),
    [queuedActions]
  );
  const statusText =
    matchStatus === "running" ? "RUNNING" : matchStatus === "finished" ? "FINISHED" : "IDLE";

  const pushLog = (text: string) => {
    const stamp = new Date().toLocaleTimeString();
    setLog((prev) => [`[${stamp}] ${text}`, ...prev].slice(0, 24));
  };

  const setDraftValue = (player: number, token: number, value: string) => {
    setDrafts((prev) =>
      prev.map((row, p) => (p === player ? row.map((v, i) => (i === token ? value : v)) : row))
    );
  };

  const settleMatch = (finalState: SimState) => {
    if (activeRewardPool <= 0) {
      setMatchStatus("finished");
      return;
    }
    const payout = rankAndPayout(finalState.scores, finalState.overtakeCounts, activeRewardPool);
    setBalances((prev) => prev.map((bal, p) => round2(bal + payout.payouts[p])));
    setResult(payout);
    setActiveRewardPool(0);
    setMatchStatus("finished");
    setNotice({
      type: "success",
      text: `Match finished. Reward pool ${money(payout.distributedPool)} paid out to demo balances.`,
    });
    pushLog(`Match settled. Order: ${payout.orderedPlayers.map((p) => playerLabel(p)).join(" > ")}.`);
  };

  const resolveWithActions = (actionsSnapshot: Array<number[] | null>) => {
    if (!state || !canInteract) return;
    const resolved = resolveTurn(state, actionsSnapshot);
    setState(resolved.next);
    setQueuedActions([null, null, null, null]);
    setDrafts(resolved.next.tokenPositions.map((row) => row.map(String)));
    setRecentMoves(resolved.moved);
    const movementText =
      resolved.moved.length > 0
        ? resolved.moved.map((m) => `${playerLabel(m.player)} T${m.token} ${m.from}->${m.to}`).join(" | ")
        : "no tile changes";
    pushLog(`Turn ${state.turnIndex} resolved (${movementText}).`);
    if (resolved.next.turnIndex >= turnLimit) {
      settleMatch(resolved.next);
    } else {
      setNotice({ type: "success", text: `Turn ${state.turnIndex} resolved.` });
    }
  };

  const parseMovesForPlayer = (
    player: number
  ): { ok: true; moves: number[] } | { ok: false; error: string } => {
    if (!state) return { ok: false, error: "Match is not running." };
    const current = state.tokenPositions[player];
    const draft = drafts[player] ?? [];
    const parsed = current.map((from, token) => {
      if (from < 0) return -1;
      const n = Number(draft[token] ?? "");
      return Number.isInteger(n) ? n : Number.NaN;
    });
    if (parsed.some((v) => Number.isNaN(v))) {
      return { ok: false, error: `${playerLabel(player)}: fill all active token destinations (integer tile IDs).` };
    }
    const err = validateMoves(current, parsed);
    if (err) return { ok: false, error: `${playerLabel(player)}: ${err}` };
    return { ok: true, moves: parsed };
  };

  const startMatch = () => {
    if (matchStatus === "running") {
      setNotice({ type: "error", text: "A simulator match is already running." });
      return;
    }
    if (!Number.isFinite(entryAmount) || entryAmount <= 0) {
      setNotice({ type: "error", text: "Entry amount must be greater than 0." });
      return;
    }
    if (!Number.isFinite(turnLimit) || turnLimit < 3 || turnLimit > 40) {
      setNotice({ type: "error", text: "Turn limit must be between 3 and 40." });
      return;
    }
    const insufficient = PLAYER_INDICES.filter((p) => balances[p] < entryAmount);
    if (insufficient.length > 0) {
      setNotice({
        type: "error",
        text: `Insufficient demo balance for ${insufficient.map((p) => playerLabel(p)).join(", ")}.`,
      });
      return;
    }
    const totalEntry = entryAmount * 4;
    const fee = round2((totalEntry * FEE_PCT) / 100);
    const pool = round2(totalEntry - fee);
    setBalances((prev) => prev.map((b) => round2(b - entryAmount)));
    setTreasuryBalance((prev) => round2(prev + fee));
    setActiveRewardPool(pool);
    setActiveFee(fee);
    const initial = createInitialState(tokenMode);
    setState(initial);
    setDrafts(initial.tokenPositions.map((row) => row.map(String)));
    setQueuedActions([null, null, null, null]);
    setRecentMoves([]);
    setResult(null);
    setMatchStatus("running");
    setNotice({
      type: "success",
      text: `Game Simulator match started. Pool ${money(pool)}, fee ${money(fee)}.`,
    });
    pushLog(`Simulator match started (${tokenMode} tokens/player, ${turnLimit} turns).`);
  };

  const resetMatch = () => {
    if (matchStatus === "running" && activeRewardPool > 0) {
      const refundEach = round2(activeRewardPool / 4);
      setBalances((prev) => prev.map((b) => round2(b + refundEach)));
      pushLog(`Running match cancelled. Reward pool refunded (${money(refundEach)} each).`);
    }
    setState(null);
    setQueuedActions([null, null, null, null]);
    setRecentMoves([]);
    setResult(null);
    setActiveRewardPool(0);
    setActiveFee(0);
    setMatchStatus("idle");
    setNotice({ type: "success", text: "Match reset." });
  };

  const resetEconomy = () => {
    const base = Math.max(0, round2(defaultBalance));
    setBalances([base, base, base, base]);
    setTreasuryBalance(0);
    setState(null);
    setQueuedActions([null, null, null, null]);
    setRecentMoves([]);
    setResult(null);
    setActiveRewardPool(0);
    setActiveFee(0);
    setMatchStatus("idle");
    setNotice({ type: "success", text: `Economy reset. Each player now has ${money(base)}.` });
    pushLog("Economy reset.");
  };

  const submitPlayer = (player: PlayerIndex) => {
    if (!canInteract) {
      setNotice({ type: "error", text: "Start a simulator match first." });
      return;
    }
    const parsed = parseMovesForPlayer(player);
    if (!parsed.ok) {
      setNotice({ type: "error", text: parsed.error });
      return;
    }

    if (waitForAllSubmissions) {
      const nextQueued = [...queuedActions];
      nextQueued[player] = parsed.moves;
      setQueuedActions(nextQueued);
      const waiting = PLAYER_INDICES.filter((p) => nextQueued[p] == null);
      setNotice({
        type: "success",
        text:
          waiting.length > 0
            ? `${playerLabel(player)} submitted. Waiting for ${waiting.map((p) => playerLabel(p)).join(", ")}.`
            : `${playerLabel(player)} submitted.`,
      });
      if (waiting.length === 0) {
        resolveWithActions(nextQueued);
      }
      return;
    }

    const instantActions: Array<number[] | null> = [null, null, null, null];
    instantActions[player] = parsed.moves;
    resolveWithActions(instantActions);
  };

  const resolveNow = () => {
    if (!canInteract) {
      setNotice({ type: "error", text: "Start a simulator match first." });
      return;
    }
    if (waitForAllSubmissions) {
      if (submittedPlayers.length === 0) {
        setNotice({ type: "error", text: "Submit at least one player action first." });
        return;
      }
      resolveWithActions(queuedActions);
      return;
    }
    const parsed = parseMovesForPlayer(selectedPlayer);
    if (!parsed.ok) {
      setNotice({ type: "error", text: parsed.error });
      return;
    }
    const actions: Array<number[] | null> = [null, null, null, null];
    actions[selectedPlayer] = parsed.moves;
    resolveWithActions(actions);
  };

  const autoFillSelected = () => {
    if (!state) return;
    const moves = state.tokenPositions[selectedPlayer].map((tile) => randomLegalMove(tile));
    setDrafts((prev) =>
      prev.map((row, p) => (p === selectedPlayer ? moves.map(String) : row))
    );
    setNotice({ type: "success", text: `${playerLabel(selectedPlayer)} draft auto-filled.` });
  };

  const autoSubmitPending = () => {
    if (!canInteract || !state) {
      setNotice({ type: "error", text: "Start a simulator match first." });
      return;
    }
    if (waitForAllSubmissions) {
      const nextQueued = [...queuedActions];
      for (const p of pendingPlayers) {
        nextQueued[p] = state.tokenPositions[p].map((tile) => randomLegalMove(tile));
      }
      setQueuedActions(nextQueued);
      setDrafts((prev) =>
        prev.map((row, p) => (nextQueued[p] ? (nextQueued[p] as number[]).map(String) : row))
      );
      resolveWithActions(nextQueued);
      return;
    }
    const instantActions: Array<number[] | null> = PLAYER_INDICES.map((p) =>
      state.tokenPositions[p].map((tile) => randomLegalMove(tile))
    );
    setDrafts(instantActions.map((row) => (row ?? []).map(String)));
    resolveWithActions(instantActions);
  };

  const settleNow = () => {
    if (!state || matchStatus !== "running") {
      setNotice({ type: "error", text: "No running match to settle." });
      return;
    }
    settleMatch(state);
  };

  const handleBoardTileClick = (tile: number) => {
    if (!canInteract || !state) {
      setNotice({ type: "error", text: "Start a simulator match first to edit moves." });
      return;
    }
    const tokenTile = state.tokenPositions[selectedPlayer][selectedToken];
    if (tokenTile < 0) {
      setNotice({ type: "error", text: `${playerLabel(selectedPlayer)} token ${selectedToken} is eliminated.` });
      return;
    }
    setDraftValue(selectedPlayer, selectedToken, String(tile));
  };

  return (
    <div className="play-page game-simulator-page">
      {notice && (
        <div className={`msg-box msg-box-${notice.type}`} role="alert">
          <span className="msg-text">{notice.text}</span>
          <button type="button" className="msg-dismiss" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="card game-sim-hero">
        <h2>Game Simulator</h2>
        <p>
          Wallet-free deep testing: 4 demo players, configurable token mode, strict move validation,
          and realistic reward sharing (38/30/20/12 from 92% pool after 8% fee).
        </p>
        <div className="manual-lab-balance-row">
          <span className="score-pill">Status: {matchStatus.toUpperCase()}</span>
          <span className="score-pill">Token mode: {tokenMode}</span>
          <span className="score-pill">Turn: {state?.turnIndex ?? 0}/{turnLimit}</span>
          <span className="score-pill">Resolve mode: {waitForAllSubmissions ? "All 4 submit" : "Instant"}</span>
        </div>
      </div>

      <div className="game-sim-layout">
        <div className="game-sim-top-row">
          <details className="card game-sim-details" open>
            <summary>Setup & Economy</summary>
            <div className="manual-lab-grid">
              <label>
                Token mode
                <select
                  value={tokenMode}
                  disabled={matchStatus === "running"}
                  onChange={(e) => setTokenMode(Number(e.target.value) as 2 | 3)}
                >
                  <option value={2}>2 tokens/player</option>
                  <option value={3}>3 tokens/player</option>
                </select>
              </label>
              <label>
                Turn limit
                <input
                  type="number"
                  min={3}
                  max={40}
                  disabled={matchStatus === "running"}
                  value={turnLimit}
                  onChange={(e) => setTurnLimit(Number(e.target.value))}
                />
              </label>
              <label>
                Entry per player
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  disabled={matchStatus === "running"}
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(Number(e.target.value))}
                />
              </label>
              <label>
                Default demo balance
                <input
                  type="number"
                  min={0}
                  step={1}
                  disabled={matchStatus === "running"}
                  value={defaultBalance}
                  onChange={(e) => setDefaultBalance(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="manual-lab-actions">
              <button type="button" onClick={startMatch} disabled={matchStatus === "running"}>
                {matchStatus === "running" ? "MATCH RUNNING..." : "START DEMO MATCH"}
              </button>
              <button type="button" className="btn-outline" onClick={resetMatch}>
                RESET MATCH
              </button>
              <button type="button" className="btn-outline" onClick={resetEconomy}>
                RESET BALANCES
              </button>
            </div>
            <p className="game-sim-status-line">
              Match status: <strong>{statusText}</strong>
              {matchStatus !== "running" && " · Start demo match to enable board movement controls."}
            </p>
            <p style={{ marginTop: "var(--space-sm)" }}>
              Treasury: {money(treasuryBalance)} · Active reward pool: {money(activeRewardPool)} · Active fee: {money(activeFee)}
            </p>
            <div className="manual-lab-balance-row">
              {PLAYER_INDICES.map((p) => (
                <span key={p} className={`score-pill token-p${p}`}>
                  {playerLabel(p)} balance: {money(balances[p])}
                </span>
              ))}
            </div>
          </details>

          <details className="card game-sim-details" open>
            <summary>Rules & Validation</summary>
            <ul className="arena-instructions-list">
              <li>Player labels use <strong>P1-P4</strong> for easier reading.</li>
              <li>Legal destination: integer tile <strong>0-48</strong> for active tokens.</li>
              <li>Legal step: stay, or move <strong>up 1-2 rows</strong> with max <strong>1 column sideways</strong>.</li>
              <li>Trap tiles: <strong>{TRAP_TILES.join(", ")}</strong>.</li>
              <li>
                Start lanes:{" "}
                {START_LANES.map((lane, p) => `${playerLabel(p)} [${lane.slice(0, tokenMode).join(", ")}]`).join(" · ")}
              </li>
              <li>Crowded tile (2+ tokens) lowers survival points for tokens on that tile.</li>
            </ul>
          </details>
        </div>

        <div className="game-sim-board-row">
          <div className="card game-sim-board-card">
            <h2>Simulator Board · Turn {state?.turnIndex ?? 0}</h2>
            <p>
              Click a tile to assign destination for <strong>{playerLabel(selectedPlayer)} Token {selectedToken}</strong>.
            </p>
            <div className="manual-lab-balance-row">
              {PLAYER_INDICES.map((p) => (
                <span key={`board-legend-${p}`} className={`score-pill token-p${p}`}>
                  {playerLabel(p)}
                </span>
              ))}
            </div>
            <div className="game-board-wrap">
              <div className="game-board-labels game-board-labels-top" aria-hidden>Finish ↑</div>
              <div className="game-board">
                {Array.from({ length: BOARD_SIZE }, (_, row) =>
                  Array.from({ length: BOARD_SIZE }, (_, col) => {
                    const tile = row * BOARD_SIZE + col;
                    const tokensHere: Array<{ player: number; token: number }> = [];
                    boardPositions.forEach((positions, player) =>
                      positions.forEach((pos, token) => {
                        if (pos === tile) tokensHere.push({ player, token });
                      })
                    );
                    const tokenClass = tokensHere[0] ? ` token-p${tokensHere[0].player} has-token` : "";
                    const rowClass = row === 0 ? " game-tile-row-finish" : row === 6 ? " game-tile-row-start" : "";
                    const trapClass = TRAP_TILES.includes(tile as (typeof TRAP_TILES)[number]) ? " game-tile-trap" : "";
                    const homeOwner = START_LANES.findIndex((lane) => lane.slice(0, tokenMode).includes(tile));
                    const homeClass = homeOwner >= 0 ? ` game-tile-home-p${homeOwner}` : "";
                    const destClass =
                      selectedDraft[0] === String(tile)
                        ? " game-tile-dest-0"
                        : selectedDraft[1] === String(tile)
                        ? " game-tile-dest-1"
                        : selectedDraft[2] === String(tile)
                        ? " game-tile-dest-2"
                        : "";
                    return (
                      <button
                        key={`${row}-${col}`}
                        type="button"
                        className={`game-tile game-tile-selectable${tokenClass}${rowClass}${trapClass}${homeClass}${destClass}`}
                        onClick={() => handleBoardTileClick(tile)}
                      >
                        <span className="game-tile-id">{tile}</span>
                        {TRAP_TILES.includes(tile as (typeof TRAP_TILES)[number]) && (
                          <span className="game-tile-dest-badge">T</span>
                        )}
                        {tokensHere.length > 0 && (
                          <span className="game-tile-racers">
                            {tokensHere.map(({ player, token }) => (
                              <span key={`${player}-${token}`} className={`game-racer token-p${player}`}>
                                {token}
                              </span>
                            ))}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="game-board-labels game-board-labels-bottom" aria-hidden>Start ↓</div>
            </div>
            {recentMoves.length > 0 && (
              <p className="arena-submit-info">
                Last resolve: {recentMoves.map((m) => `${playerLabel(m.player)} T${m.token} ${m.from}->${m.to}`).join(" · ")}
              </p>
            )}
          </div>

          <details className="card game-sim-details game-sim-turn-controls" open>
            <summary>Turn Controls</summary>
            <div className="manual-lab-balance-row">
              {PLAYER_INDICES.map((p) => (
                <span key={`control-legend-${p}`} className={`score-pill token-p${p}`}>
                  {playerLabel(p)}
                </span>
              ))}
            </div>
            <label style={{ display: "inline-flex", gap: "8px", alignItems: "center", marginTop: "var(--space-sm)" }}>
              <input
                type="checkbox"
                checked={waitForAllSubmissions}
                onChange={(e) => setWaitForAllSubmissions(e.target.checked)}
              />
              Wait for all 4 submissions before resolving turn
            </label>
            {!canInteract && (
              <p className="game-sim-hint">Controls unlock after you click START DEMO MATCH.</p>
            )}
            <div className="manual-lab-actions">
              {PLAYER_INDICES.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={
                    "btn-outline game-sim-player-btn " + (selectedPlayer === p ? "is-active" : "")
                  }
                  onClick={() => {
                    setSelectedPlayer(p);
                    setSelectedToken(0);
                  }}
                  aria-pressed={selectedPlayer === p}
                >
                  {playerLabel(p)}{queuedActions[p] ? " ✓" : ""}
                </button>
              ))}
            </div>
            <div className="manual-lab-grid" style={{ marginTop: "var(--space-sm)" }}>
              {Array.from({ length: tokenMode }, (_, token) => (
                <label key={token}>
                  {playerLabel(selectedPlayer)} Token {token}
                  <input
                    type="number"
                    min={-1}
                    max={48}
                    value={selectedDraft[token] ?? ""}
                    onChange={(e) => setDraftValue(selectedPlayer, token, e.target.value)}
                    onFocus={() => setSelectedToken(token)}
                    disabled={!canInteract || (state?.tokenPositions[selectedPlayer]?.[token] ?? 0) < 0}
                  />
                </label>
              ))}
            </div>
            <div className="manual-lab-actions">
              <button type="button" onClick={() => submitPlayer(selectedPlayer)} disabled={!canInteract}>
                SUBMIT {playerLabel(selectedPlayer)}
              </button>
              <button type="button" className="btn-outline" onClick={resolveNow} disabled={!canInteract}>
                RESOLVE TURN NOW
              </button>
              <button type="button" className="btn-outline" onClick={autoFillSelected} disabled={!canInteract}>
                AUTO-FILL SELECTED
              </button>
              <button type="button" className="btn-outline" onClick={autoSubmitPending} disabled={!canInteract}>
                AUTO-SUBMIT PENDING
              </button>
              <button type="button" className="btn-outline" onClick={settleNow} disabled={!canInteract}>
                SETTLE MATCH NOW
              </button>
            </div>
            <p style={{ marginTop: "var(--space-sm)" }}>
              {waitForAllSubmissions ? (
                <>
                  Submitted: {submittedPlayers.length ? submittedPlayers.map((p) => playerLabel(p)).join(", ") : "none"} ·
                  Waiting: {pendingPlayers.length ? pendingPlayers.map((p) => playerLabel(p)).join(", ") : "none"}
                </>
              ) : (
                <>Instant mode: each submit resolves immediately with default moves for other players.</>
              )}
            </p>
          </details>
        </div>

        <div className="game-sim-bottom-row">
          <details className="card game-sim-details" open>
            <summary>Scoreboard</summary>
            {(state?.scores ?? [makeScore(), makeScore(), makeScore(), makeScore()]).map((score, p) => (
              <p key={p}>
                <strong>{playerLabel(p)}</strong> · Total {money(score.total)} · Pos {money(score.positionPoints)} ·
                Zone {money(score.zonePoints)} · Overtake {money(score.overtakePoints)} · Survival {money(score.survivalPoints)}
              </p>
            ))}
          </details>

          <details className="card game-sim-details" open>
            <summary>Event Log</summary>
            {log.length === 0 ? (
              <p>No events yet.</p>
            ) : (
              log.map((line, i) => <p key={i}>{line}</p>)
            )}
          </details>
        </div>

        {result && (
          <details className="card game-sim-details" open>
            <summary>Payout Result</summary>
            <p>Distributed pool: <strong>{money(result.distributedPool)}</strong></p>
            {PLAYER_INDICES.map((p) => (
              <p key={p}>
                <strong>{playerLabel(p)}</strong> · Place {result.placeLabels[p]} · Payout {money(result.payouts[p])} ·
                Balance {money(balances[p])}
              </p>
            ))}
          </details>
        )}
      </div>
    </div>
  );
}

