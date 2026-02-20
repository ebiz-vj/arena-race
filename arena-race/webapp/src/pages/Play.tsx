import { useEffect, useState } from "react";
import { formatUnits, getBytes, keccak256, toBeHex } from "ethers";
import type { BrowserProvider } from "ethers";

const STATUS_NAMES: Record<number, string> = {
  0: "PendingEntries",
  1: "Escrowed",
  2: "Expired",
  3: "Refunded",
  4: "Resolved",
};

const SIGNER_URL = "http://localhost:3344";
const GAME_SERVER_URL = "http://localhost:3000";

const ESCROW_ERRORS: Record<string, string> = {
  "0xfc2bc70d": "Match already exists. Do NOT click Create match again. Switch account in MetaMask and use Enter match for more players.",
  "0x118cdaa7": "Only the contract owner can create matches. With this account use Enter match instead.",
  "0x3c3544ed": "Invalid match id (zero). Use a positive seed (e.g. 1).",
  "0x2c5211c6": "Invalid amount (e.g. zero). Entry is 10 USDC per player.",
  "0x83b9f0c6": "Not the contract owner.",
  "0x2d5a3b7a": "Contract is paused.",
  "0x8baa579f": "Invalid signature. Run the signer (npm run signer) and ensure it uses the deployer key (first Hardhat account).",
  "0x78636683": "This account has already entered this match. Use another account to fill the remaining slots.",
  "0xc8b89ef0": "Match is not accepting entries (e.g. already Escrowed or Expired). Check match status with Fetch match.",
  "0x81efbd8d": "Entry window has closed. Create a new match or use an existing one that is still PendingEntries.",
  "0xd0404f85": "Match has not expired yet. Wait until after the entry deadline to expire or claim refund.",
  "0xff272902": "Match is not Escrowed (e.g. still PendingEntries or already Resolved). Only Escrowed matches can have results submitted.",
  "0xa85e6f1a": "Refund already claimed for this match by this account.",
  "0x67b4a24c": "Payout amounts do not sum to the pool. Use placement 0,1,2,3 for standard 38/30/20/12.",
  "0xb19089b8": "No match exists for this id. Create a match first or check the seed.",
  "0xd92e233d": "Invalid zero address in contract config.",
};

function decodeRevertReason(e: unknown): string {
  const err = e as { data?: string | { data?: string }; reason?: string; message?: string; error?: { data?: string }; code?: string; value?: string };
  let data: string | undefined;
  if (typeof err?.data === "string") data = err.data;
  else if (err?.data?.data) data = err.data.data;
  else if (err?.error?.data) data = err.error.data;
  if (data && data.length >= 10) {
    const selector = data.slice(0, 10).toLowerCase();
    const friendly = ESCROW_ERRORS[selector];
    if (friendly) return friendly;
  }
  if (err?.code === "ACTION_REJECTED" || err?.code === 4001) return "Transaction was rejected in your wallet.";
  const errMsg = [err?.message, err?.reason, (err as { error?: { message?: string } })?.error?.message].filter(Boolean).join(" ");
  if (errMsg.toLowerCase().includes("user rejected") || errMsg.toLowerCase().includes("user denied")) return "Transaction was rejected in your wallet.";
  if (err?.code === "BAD_DATA" && (err?.value === "0x" || (err?.message && err.message.includes("could not decode result data")))) {
    return "No contract at this escrow address. Run deploy:localhost once (with the node running), then refresh this page.";
  }
  if (errMsg.includes("Parse error") || errMsg.includes("Unexpected end of JSON input") || errMsg.includes("JSON input")) {
    return "RPC returned an invalid response. Ensure the Hardhat node is running (npm run node:localhost) and try again.";
  }
  if (err?.code === "NETWORK_ERROR" || errMsg.includes("ECONNREFUSED") || errMsg.includes("timeout") || errMsg.includes("TIMEOUT")) {
    return "Network error. Check that the Hardhat node is running and that MetaMask is on Localhost 8545.";
  }
  if (errMsg.includes("insufficient balance") || errMsg.includes("ERC20: transfer amount exceeds balance")) return "Insufficient USDC balance. You need at least 10 USDC to enter.";
  if (errMsg.includes("allowance") || errMsg.includes("ERC20: insufficient allowance")) return "Allowance too low. The Enter match flow will request approval — try again and confirm both approval and entry.";
  const msg = err?.reason ?? err?.message;
  if (msg && typeof msg === "string") return msg;
  return "Transaction failed.";
}

export type Deployed = { chainId: number; usdc: string; escrow: string; entryAmount: string };

export type MatchState = {
  turnIndex: number;
  tokenPositions: number[][][];
  scores: { total: number }[];
  turnDeadlineMs?: number;
};

export type PlayPageProps = {
  provider: BrowserProvider | null;
  address: string | null;
  deployed: Deployed | null;
  chainId: number | null;
  escrowHasCode: boolean | null;
  signerMatchesContract: boolean | null;
  matchIdInput: string;
  setMatchIdInput: (v: string) => void;
  placementInput: string;
  setPlacementInput: (v: string) => void;
  msg: { type: "error" | "success"; text: string } | null;
  setMsg: (v: { type: "error" | "success"; text: string } | null) => void;
  matchInfo: string;
  setMatchInfo: (v: string) => void;
  txPending: boolean;
  fetchMatchLoading: boolean;
  queueTier: "bronze-10" | "bronze-25";
  setQueueTier: (v: "bronze-10" | "bronze-25") => void;
  inQueue: boolean;
  setInQueue: (v: boolean) => void;
  queueLoading: boolean;
  matchFound: { matchId: string; entry_deadline: number } | null;
  setMatchFound: (v: { matchId: string; entry_deadline: number } | null) => void;
  matchState: MatchState | null;
  setMatchState: (v: MatchState | null) => void;
  playerIndex: number | null;
  setPlayerIndex: (v: number | null) => void;
  matchMove0: string;
  setMatchMove0: (v: string) => void;
  matchMove1: string;
  setMatchMove1: (v: string) => void;
  matchMove2: string;
  setMatchMove2: (v: string) => void;
  matchActionLoading: boolean;
  joinQueue: () => void;
  leaveQueue: () => void;
  loadMatchState: () => void;
  startMatchThenLoad: () => void;
  submitMatchAction: () => void;
  createMatchWithId: (matchIdHex: string) => void;
  createMatch: () => void;
  enterMatch: () => void;
  fetchMatch: () => void;
  submitResult: () => void;
};

function matchIdToBytes32(id: string): string {
  const trimmed = (id || "0").trim();
  if (trimmed === "" || !/^\d+$/.test(trimmed)) throw new Error("Invalid seed. Use a positive number (e.g. 1).");
  const n = BigInt(trimmed);
  if (n < 0n) throw new Error("Invalid seed. Use a positive number.");
  return keccak256(getBytes(toBeHex(n)));
}

function resolveMatchId(id: string): string {
  const trimmed = (id || "").trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed;
  return matchIdToBytes32(id);
}

type JourneyStep = "lobby" | "enter" | "arena" | "results";

const STEPS: { key: JourneyStep; label: string }[] = [
  { key: "lobby", label: "Lobby" },
  { key: "enter", label: "Enter" },
  { key: "arena", label: "Arena" },
  { key: "results", label: "Results" },
];

export default function Play(props: PlayPageProps) {
  const {
    provider,
    address,
    deployed,
    chainId,
    escrowHasCode,
    signerMatchesContract,
    matchIdInput,
    setMatchIdInput,
    placementInput,
    setPlacementInput,
    msg,
    setMsg,
    matchInfo,
    setMatchInfo,
    txPending,
    fetchMatchLoading,
    queueTier,
    setQueueTier,
    inQueue,
    setInQueue,
    queueLoading,
    matchFound,
    setMatchFound,
    matchState,
    setMatchState,
    playerIndex,
    matchMove0,
    setMatchMove0,
    matchMove1,
    setMatchMove1,
    matchMove2,
    setMatchMove2,
    matchActionLoading,
    joinQueue,
    leaveQueue,
    loadMatchState,
    startMatchThenLoad,
    submitMatchAction,
    createMatchWithId,
    createMatch,
    enterMatch,
    fetchMatch,
    submitResult,
  } = props;

  const [step, setStep] = useState<JourneyStep>("lobby");
  const [, setTick] = useState(0);
  // Live countdown in Arena: re-render every second so timer updates
  useEffect(() => {
    if (step !== "arena" || !matchState?.turnDeadlineMs) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [step, matchState?.turnDeadlineMs]);

  useEffect(() => {
    document.title = "Play – Arena Race";
    return () => {
      document.title = "Arena Race";
    };
  }, []);

  useEffect(() => {
    if (matchFound) setMatchIdInput(matchFound.matchId);
  }, [matchFound?.matchId, setMatchIdInput]);

  // When we successfully submit result, show Results scene
  useEffect(() => {
    if (msg?.type === "success" && (msg.text.includes("Result submitted") || msg.text.includes("Payouts sent"))) {
      setStep("results");
    }
  }, [msg]);

  // On Enter step: auto-refresh match status so participants see updated "X/4 entered" when switching accounts
  useEffect(() => {
    if (step !== "enter" || !matchIdInput.trim()) return;
    fetchMatch();
    const t = setInterval(fetchMatch, 4000);
    return () => clearInterval(t);
  }, [step, matchIdInput]);

  // When matchState loads while in arena step, we're good; if we navigate to arena and load, stay there
  const goToArena = () => {
    setStep("arena");
    startMatchThenLoad();
  };

  const playAgain = () => {
    setMatchState(null);
    setMatchFound(null);
    setMsg(null);
    setStep("lobby");
  };

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  const stepper = (
    <div className="journey-stepper" role="navigation" aria-label="Journey progress">
      {STEPS.flatMap((s, i) => {
        const stepEl = (
          <span key={s.key} className={`journey-step ${s.key === step ? "is-active" : i < currentStepIndex ? "is-done" : ""}`}>
            <span className="journey-step-num">{i + 1}</span>
            <span>{s.label}</span>
          </span>
        );
        const connector = i < STEPS.length - 1 ? (
          <span key={`${s.key}-conn`} className={`journey-step-connector ${currentStepIndex > i ? "is-done" : ""}`} aria-hidden />
        ) : null;
        return [stepEl, connector];
      })}
    </div>
  );

  return (
    <div className="play-page play-journey">
      {msg && (
        <div className={`msg-box msg-box-${msg.type}`} role="alert">
          <span className="msg-text">{msg.text}</span>
          <button type="button" className="msg-dismiss" onClick={() => setMsg(null)} aria-label="Dismiss message">
            Dismiss
          </button>
        </div>
      )}

      {!deployed && (
        <div className="card">
          <p>Load deployed addresses: run <code>npm run deploy:localhost</code> (after starting the node).</p>
        </div>
      )}

      {deployed && escrowHasCode === false && (
        <div className="card" style={{ borderColor: "var(--error)", background: "rgba(248,113,113,0.1)" }}>
          <h2>No contract at escrow address</h2>
          {chainId != null && chainId !== 31337 ? (
            <p><strong>Wrong network.</strong> Switch to <strong>Localhost 8545</strong> (chain id <strong>31337</strong>) in MetaMask.</p>
          ) : (
            <p>With the Hardhat node running, run <code>npm run deploy:localhost</code>, then refresh.</p>
          )}
        </div>
      )}

      {deployed && !address && (
        <div className="card journey-card">
          <div className="journey-hero">
            <h2>Enter the Arena</h2>
            <p className="journey-desc">Connect your wallet to find a match and play.</p>
          </div>
          <p style={{ color: "var(--text-muted)" }}>Use the Connect wallet button in the header.</p>
        </div>
      )}

      {deployed && address && (
        <>
          {stepper}

          {/* ─── Lobby ─── */}
          {step === "lobby" && (
            <div className="journey-scene">
              <div className="journey-hero">
                <h2>Enter the Arena</h2>
                <p className="journey-desc">Join the queue. When 4 players are in, the match is ready.</p>
              </div>
              <div className="card journey-card">
                <h2>Find a match</h2>
                <select value={queueTier} onChange={(e) => setQueueTier(e.target.value as "bronze-10" | "bronze-25")}>
                  <option value="bronze-10">Bronze-10 (10 USDC)</option>
                  <option value="bronze-25">Bronze-25 (25 USDC)</option>
                </select>
                {" "}
                <button onClick={joinQueue} disabled={queueLoading || inQueue}>
                  {queueLoading ? "…" : inQueue ? "Searching…" : "Join queue"}
                </button>
                {inQueue && (
                  <button type="button" className="btn-outline" onClick={leaveQueue} disabled={queueLoading}>Leave queue</button>
                )}
                {matchFound && (
                  <>
                    <p className="status status-ok" style={{ marginTop: "var(--space-lg)" }}>
                      Match found. Entry by: {new Date(matchFound.entry_deadline * 1000).toLocaleTimeString()}.
                    </p>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Same match for all 4. Switch MetaMask accounts and continue to Enter.</p>
                    <button type="button" className="journey-cta" onClick={() => setStep("enter")}>
                      Continue to Enter →
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ─── Enter ─── */}
          {step === "enter" && (
            <div className="journey-scene">
              <a href="#" className="journey-back" onClick={(e) => { e.preventDefault(); setStep("lobby"); }}>← Back to Lobby</a>
              <div className="journey-hero">
                <h2>Get ready</h2>
                <p className="journey-desc">1. Owner creates match → 2. Each player enters (switch MetaMask account) → 3. When 4/4, Start race.</p>
              </div>
              {/* Current account — for localhost testing with multiple MetaMask accounts */}
              <div className="card journey-card enter-current-wallet" style={{ maxWidth: "520px", margin: "0 auto var(--space-lg)" }}>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                  Current account: <span style={{ fontFamily: "var(--font-mono)", color: "var(--cyan)" }}>{address.slice(0, 6)}…{address.slice(-4)}</span>
                  {" "}(switch in MetaMask to add another player)
                </p>
              </div>
              {/* Match status — auto-refreshes so you see X/4 after each entry */}
              <div className="card journey-card" style={{ textAlign: "left", maxWidth: "520px", borderColor: "rgba(0,229,204,0.3)" }}>
                <h2>Match status</h2>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
                  <label style={{ margin: 0 }}>Match ID</label>
                  <input
                    value={matchIdInput}
                    onChange={(e) => setMatchIdInput(e.target.value)}
                    placeholder="1"
                    style={{ flex: "1 1 8rem", minWidth: 0 }}
                    readOnly={!!matchFound}
                    title={matchFound ? "From queue (same for all 4 players)" : "Seed or 0x…"}
                  />
                  {matchFound && <span style={{ fontSize: "0.75rem", color: "var(--cyan)" }}>From queue</span>}
                  <button onClick={fetchMatch} disabled={fetchMatchLoading}>{fetchMatchLoading ? "…" : "Refresh"}</button>
                </div>
                {matchInfo && (
                  <p className={"status " + (matchInfo.startsWith("Status:") ? "status-ok" : matchInfo.startsWith("No match") ? "status-empty" : "status-err")} style={{ marginTop: "var(--space-md)", marginBottom: 0 }}>
                    {matchInfo}
                  </p>
                )}
              </div>
              {/* Single create action: from queue (one button) or manual (ID + create) */}
              <div className="card journey-card" style={{ textAlign: "left", maxWidth: "520px" }}>
                <h2>1. Create match (owner only)</h2>
                {matchFound ? (
                  <>
                    <p style={{ marginBottom: "var(--space-md)" }}>One click to create this match on-chain. Entry: {deployed && formatUnits(deployed.entryAmount, 6)} USDC per player.</p>
                    <button onClick={() => createMatchWithId(matchFound.matchId)} disabled={txPending}>
                      {txPending ? "Confirm in wallet…" : "Create match on-chain"}
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ marginBottom: "var(--space-sm)" }}>Set Match ID above (e.g. seed number), then create. Entry: {deployed && formatUnits(deployed.entryAmount, 6)} USDC per player.</p>
                    <button onClick={createMatch} disabled={txPending}>{txPending ? "Confirm in wallet…" : "Create match"}</button>
                  </>
                )}
              </div>
              {/* Enter: one action per account */}
              <div className="card journey-card" style={{ textAlign: "left", maxWidth: "520px" }}>
                <h2>2. Enter match (each player)</h2>
                <p style={{ marginBottom: "var(--space-md)" }}>Use the <strong>current account</strong> above. Click Enter, confirm in MetaMask. Then switch account and click Enter again for the next player (4 total).</p>
                <button onClick={enterMatch} disabled={txPending}>{txPending ? "Confirm in wallet…" : "Enter match"}</button>
              </div>
              {/* Start when 4/4 */}
              <div className="journey-hero">
                <p className="journey-desc">When status shows Escrowed (4/4), start the race.</p>
                <button type="button" className="journey-cta" onClick={goToArena} disabled={matchActionLoading}>
                  {matchActionLoading ? "Starting…" : "3. Start match → Arena"}
                </button>
              </div>
            </div>
          )}

          {/* ─── Arena ─── */}
          {step === "arena" && (
            <div className="journey-scene arena-scene">
              <a href="#" className="journey-back" onClick={(e) => { e.preventDefault(); setStep("enter"); }}>← Back to Enter</a>

              {/* Instructions — always visible */}
              <div className="arena-instructions card">
                <h2 className="arena-instructions-title">How to play</h2>
                <ul className="arena-instructions-list">
                  <li>Each turn, <strong>all four players</strong> submit where to move their 3 tokens (tile 0–48).</li>
                  <li>You have <strong>~6 seconds</strong> per turn. Submit before the timer runs out.</li>
                  <li>Pick a <strong>destination tile</strong> for each token (same tile = stay put). Higher rows = more points.</li>
                  <li><strong>Click a tile</strong> on the board to assign it to your next token, or type numbers below.</li>
                </ul>
                {playerIndex != null ? (
                  <p className="arena-you-are">
                    You are <span className={`arena-player-badge arena-player-badge-p${playerIndex}`}>Player {playerIndex}</span>
                    {matchState && (
                      <span className="arena-your-score"> — Score: {matchState.scores[playerIndex]?.total ?? 0}</span>
                    )}
                  </p>
                ) : (
                  <p className="arena-you-are arena-you-spectator">You are not in this match (spectator). Connect with a wallet that entered.</p>
                )}
              </div>

              {!matchState ? (
                <div className="card journey-card">
                  <p>Board not loaded yet. Start the match to begin, or you may still be waiting for the game server.</p>
                  <button type="button" onClick={goToArena} disabled={matchActionLoading}>
                    {matchActionLoading ? "…" : "Start match / Refresh state"}
                  </button>
                </div>
              ) : (
                <>
                  {/* "Your turn" highlight when you're a participant */}
                  {playerIndex != null && (
                    <div className="arena-your-turn-banner" role="status" aria-live="polite">
                      <span className="arena-your-turn-glow" aria-hidden />
                      <span className="arena-your-turn-text">Your turn — choose destinations and submit below</span>
                      {matchState.turnDeadlineMs != null && (
                        <span className="arena-your-turn-timer">
                          {Math.max(0, Math.ceil((matchState.turnDeadlineMs - Date.now()) / 1000))}s left
                        </span>
                      )}
                    </div>
                  )}

                  <div className="game-hud">
                    <span className="turn-badge">
                      Turn {matchState.turnIndex}
                      {matchState.turnDeadlineMs != null && (
                        <span className="turn-timer">
                          — <span className="turn-timer-value">{Math.max(0, Math.ceil((matchState.turnDeadlineMs - Date.now()) / 1000))}</span>s left
                        </span>
                      )}
                    </span>
                    <div className="scores">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} className={`score-pill ${playerIndex === i ? "score-pill-you" : ""}`}>
                          P{i}: {matchState.scores[i]?.total ?? 0}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="game-board-container">
                    <div className="game-board-wrap">
                      <div className="game-board-legend">
                        <span className="game-legend-item token-p0">P0</span>
                        <span className="game-legend-item token-p1">P1</span>
                        <span className="game-legend-item token-p2">P2</span>
                        <span className="game-legend-item token-p3">P3</span>
                      </div>
                      <div className="game-board-labels game-board-labels-top" aria-hidden>Finish ↑</div>
                      <div className="game-board">
                        {[0, 1, 2, 3, 4, 5, 6].map((row) =>
                          [0, 1, 2, 3, 4, 5, 6].map((col) => {
                            const tile = row * 7 + col;
                            const tokensHere: { p: number; t: number }[] = [];
                            matchState.tokenPositions?.forEach((positions, p) =>
                              positions?.forEach((pos, t) => {
                                if (pos === tile) tokensHere.push({ p, t });
                              })
                            );
                            const tokenClasses = tokensHere.map(({ p }) => `token-p${p} has-token`);
                            const isSelectable = playerIndex != null;
                            const handleTileClick = () => {
                              if (playerIndex == null) return;
                              if (matchMove0 === "") setMatchMove0(String(tile));
                              else if (matchMove1 === "") setMatchMove1(String(tile));
                              else if (matchMove2 === "") setMatchMove2(String(tile));
                              else {
                                setMatchMove0(String(tile));
                                setMatchMove1("");
                                setMatchMove2("");
                              }
                            };
                            const rowClass = row === 0 ? " game-tile-row-finish" : row === 6 ? " game-tile-row-start" : "";
                            const tileContent = (
                              <>
                                <span className="game-tile-id" title={`Tile ${tile}`}>{tile}</span>
                                {tokensHere.length > 0 && (
                                  <span className="game-tile-racers" aria-hidden>
                                    {tokensHere.map(({ p, t }) => (
                                      <span key={`${p}-${t}`} className={`game-racer token-p${p}`} title={`Player ${p} token ${t}`}>
                                        {t}
                                      </span>
                                    ))}
                                  </span>
                                )}
                              </>
                            );
                            return isSelectable ? (
                              <button
                                type="button"
                                key={`${row}-${col}`}
                                className={"game-tile game-tile-selectable " + (tokenClasses[0] ?? "") + rowClass}
                                title={`Tile ${tile}${tokensHere.length ? " — " + tokensHere.map(({ p, t }) => `P${p}-${t}`).join(", ") : ""} — Click to set move`}
                                onClick={handleTileClick}
                              >
                                {tileContent}
                              </button>
                            ) : (
                              <div
                                key={`${row}-${col}`}
                                className={"game-tile " + (tokenClasses[0] ?? "") + rowClass}
                                title={`Tile ${tile}${tokensHere.length ? " " + tokensHere.map(({ p, t }) => `P${p} token ${t}`).join(", ") : ""}`}
                              >
                                {tileContent}
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="game-board-labels game-board-labels-bottom" aria-hidden>Start ↓</div>
                    </div>
                  </div>

                  {playerIndex != null && (
                    <div className="arena-moves-panel card">
                      <h2>Your move this turn</h2>
                      <p className="arena-moves-desc">Set destination tile (0–48) for each token. Click tiles on the board or type below.</p>
                      <div className="arena-moves-inputs">
                        <div className="arena-move-row">
                          <label>Token 0</label>
                          <input
                            type="number"
                            min={0}
                            max={48}
                            value={matchMove0}
                            onChange={(e) => setMatchMove0(e.target.value)}
                            placeholder={String(matchState.tokenPositions?.[playerIndex]?.[0] ?? "0")}
                          />
                        </div>
                        <div className="arena-move-row">
                          <label>Token 1</label>
                          <input
                            type="number"
                            min={0}
                            max={48}
                            value={matchMove1}
                            onChange={(e) => setMatchMove1(e.target.value)}
                            placeholder={String(matchState.tokenPositions?.[playerIndex]?.[1] ?? "1")}
                          />
                        </div>
                        <div className="arena-move-row">
                          <label>Token 2</label>
                          <input
                            type="number"
                            min={0}
                            max={48}
                            value={matchMove2}
                            onChange={(e) => setMatchMove2(e.target.value)}
                            placeholder={String(matchState.tokenPositions?.[playerIndex]?.[2] ?? "2")}
                          />
                        </div>
                      </div>
                      <button type="button" className="arena-submit-move" onClick={submitMatchAction} disabled={matchActionLoading}>
                        {matchActionLoading ? "Submitting…" : "Submit move"}
                      </button>
                    </div>
                  )}

                  <details className="arena-result-details card">
                    <summary>Submit result (signer only)</summary>
                    <p>Placement: 1st, 2nd, 3rd, 4th as player indices (e.g. 0,1,2,3). Run the signer: <code>cd arena-race && npm run signer</code>.</p>
                    {signerMatchesContract === false && (
                      <p style={{ color: "var(--error)", marginBottom: "0.5rem" }}>Signer address does not match contract. Use first Hardhat account for signer.</p>
                    )}
                    <input value={placementInput} onChange={(e) => setPlacementInput(e.target.value)} placeholder="0,1,2,3" />
                    <button onClick={submitResult} disabled={txPending}>{txPending ? "Confirm in wallet…" : "Submit result"}</button>
                  </details>
                </>
              )}
            </div>
          )}

          {/* ─── Results ─── */}
          {step === "results" && (
            <div className="journey-scene results-scene">
              <div className="journey-hero">
                <h2>Match complete</h2>
                <p className="journey-desc">Payouts have been sent. Ready for another race?</p>
              </div>
              <div className="card journey-card">
                <button type="button" className="journey-cta" onClick={playAgain}>
                  Play again
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Export for use in App
export { decodeRevertReason, matchIdToBytes32, resolveMatchId, SIGNER_URL, GAME_SERVER_URL, STATUS_NAMES };
