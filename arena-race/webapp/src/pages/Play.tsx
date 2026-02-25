import { useEffect, useRef, useState } from "react";
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
const GAME_SERVER_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_GAME_SERVER_URL) ||
  "http://localhost:3000";

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
  const err = e as { data?: string | { data?: string }; reason?: string; message?: string; error?: { data?: string; message?: string }; code?: string | number; value?: string };
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
  if (err?.code === -32603 || err?.code === "SERVER_ERROR" || (errMsg && errMsg.includes("Internal JSON-RPC error"))) {
    return "RPC error from the node (often after restart or contract revert). Try: 1) Ensure dev:all / Hardhat node is running. 2) Click Reset everything and try again. 3) If the match was already created, use Refresh above.";
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
  refreshEscrowCheck: () => void;
  signerMatchesContract: boolean | null;
  /** Escrow contract owner; only this address can call createMatch. */
  escrowOwner: string | null;
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
  enterMatch: () => void;
  fetchMatch: (overrides?: { matchId?: string; escrowAddress?: string }) => void;
  submitResult: () => void;
  loadDeployed: () => Promise<void>;
  /** Reload addresses and clear match/queue state; then go back to Lobby. */
  resetEverything: () => void;
  /** Four participant slots for single-screen local testing. */
  participantAddresses: (string | null)[];
  setParticipant: (slot: number, value: string | null) => void;
  joinQueueAll: () => void;
  enterMatchAs: (slot: number) => void;
};

function matchIdToBytes32(id: string): string {
  const trimmed = (id || "0").trim();
  if (trimmed === "" || !/^\d+$/.test(trimmed)) throw new Error("Invalid seed. Use a positive number (e.g. 1).");
  const n = BigInt(trimmed);
  if (n < 0n) throw new Error("Invalid seed. Use a positive number.");
  return keccak256(getBytes(toBeHex(n)));
}

/** Same bytes32 key used for createMatch and matches() lookup. Always 0x + 64 lowercase hex. */
function resolveMatchId(id: string): string {
  const trimmed = (id || "").trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return "0x" + trimmed.slice(2).toLowerCase();
  return matchIdToBytes32(id);
}

type JourneyStep = "lobby" | "enter" | "arena" | "results";

/** Animated "How it works" frames: each frame is [P0, P1, P2, P3] token positions. */
const EXAMPLE_FRAMES: { positions: [number, number, number][]; label: string }[] = [
  {
    positions: [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]],
    label: "Start — all tokens on the grid",
  },
  {
    positions: [[7, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]],
    label: "P0 moves token 0 → tile 7",
  },
  {
    positions: [[7, 1, 2], [10, 4, 5], [6, 7, 8], [9, 10, 11]],
    label: "P1 moves token 0 → tile 10",
  },
  {
    positions: [[7, 8, 2], [10, 4, 5], [6, 7, 8], [9, 10, 11]],
    label: "P0 moves token 1 → tile 8",
  },
  {
    positions: [[7, 8, 14], [10, 4, 5], [6, 7, 8], [9, 10, 11]],
    label: "P0 moves token 2 → tile 14",
  },
];
const EXAMPLE_FRAME_MS = 2200;

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
    refreshEscrowCheck,
    signerMatchesContract,
    escrowOwner,
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
    enterMatch,
  fetchMatch,
  submitResult,
  loadDeployed,
  resetEverything,
  participantAddresses,
  setParticipant,
  joinQueueAll,
  enterMatchAs,
  } = props;

  const [step, setStep] = useState<JourneyStep>("lobby");
  const [, setTick] = useState(0);
  const [exampleFrame, setExampleFrame] = useState(0);
  const [selectedTokenForMove, setSelectedTokenForMove] = useState<0 | 1 | 2>(0);
  const [dragOverTile, setDragOverTile] = useState<number | null>(null);
  const lastPrefillTurnRef = useRef<number | null>(null);
  const DRAG_TOKEN_KEY = "arena-race/tokenIndex";
  // Pre-fill move inputs with current positions when turn changes (so "stay put" is default)
  useEffect(() => {
    if (step !== "arena" || !matchState || playerIndex == null) return;
    const turn = matchState.turnIndex;
    if (lastPrefillTurnRef.current !== turn) {
      const pos = matchState.tokenPositions?.[playerIndex];
      if (pos?.length === 3) {
        setMatchMove0(String(pos[0]));
        setMatchMove1(String(pos[1]));
        setMatchMove2(String(pos[2]));
        lastPrefillTurnRef.current = turn;
      }
    }
  }, [step, matchState, playerIndex, matchState?.turnIndex, setMatchMove0, setMatchMove1, setMatchMove2]);
  // "How it works" board: cycle through example frames for video-like demo
  useEffect(() => {
    if (step !== "arena") return;
    const id = setInterval(() => {
      setExampleFrame((f) => (f + 1) % EXAMPLE_FRAMES.length);
    }, EXAMPLE_FRAME_MS);
    return () => clearInterval(id);
  }, [step]);
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

  // On Enter step: auto-refresh match status; pass current matchId and escrow so chain read uses correct values
  useEffect(() => {
    if (step !== "enter" || !matchIdInput.trim()) return;
    const opts = { matchId: matchIdInput.trim(), escrowAddress: deployed?.escrow ?? undefined };
    fetchMatch(opts);
    const t = setInterval(() => fetchMatch(opts), 4000);
    return () => clearInterval(t);
  }, [step, matchIdInput, deployed?.escrow]);

  // When matchState loads while in arena step, we're good; if we navigate to arena and load, stay there
  const goToArena = () => {
    setStep("arena");
    startMatchThenLoad();
  };

  const switchWalletToLocalhost = async () => {
    const ethereum = (window as unknown as {
      ethereum?: {
        request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      };
    }).ethereum;
    if (!ethereum?.request) {
      setMsg({ type: "error", text: "Wallet RPC not available. Open MetaMask and connect this site first." });
      return;
    }
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7a69" }],
      });
      setMsg({ type: "success", text: "Switched wallet to Localhost 8545 (chain 31337)." });
    } catch (e) {
      const err = e as { code?: number; message?: string };
      if (err?.code === 4902) {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x7a69",
              chainName: "Localhost 8545",
              rpcUrls: ["http://127.0.0.1:8545"],
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            }],
          });
          setMsg({ type: "success", text: "Added Localhost 8545 and switched wallet network." });
        } catch (addErr) {
          setMsg({
            type: "error",
            text: (addErr as Error)?.message ?? "Could not add Localhost 8545 network in wallet.",
          });
        }
        return;
      }
      setMsg({
        type: "error",
        text: err?.message ?? "Could not switch wallet network to Localhost 8545.",
      });
    }
  };

  const playAgain = () => {
    setMatchState(null);
    setMatchFound(null);
    setMsg(null);
    setStep("lobby");
  };

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);
  const participantsSetCount = participantAddresses.filter((a) => a != null && a.startsWith("0x")).length;
  const uniqueParticipants = new Set(
    participantAddresses
      .filter((a): a is string => typeof a === "string" && a.startsWith("0x"))
      .map((a) => a.toLowerCase())
  );
  const hasDuplicateParticipants = participantsSetCount !== uniqueParticipants.size;
  const participantsReady = participantsSetCount === 4 && !hasDuplicateParticipants;

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
            <>
              <p><strong>Wrong network.</strong> This app uses <strong>Localhost 8545</strong> (chain id <strong>31337</strong>). In MetaMask, switch to that network.</p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>If you don&apos;t see it: add a network with RPC <code>http://127.0.0.1:8545</code> and chain id <strong>31337</strong>.</p>
              <button type="button" onClick={switchWalletToLocalhost}>
                Switch wallet to Localhost 8545
              </button>
            </>
          ) : (
            <>
              <p>MetaMask is on the right network, but there is no contract at the escrow address the app loaded. This usually means the Hardhat node was restarted or deploy ran before the node was ready.</p>
              <p><strong>Fix:</strong> With the node running, run <code>npm run deploy:localhost</code> from the <code>arena-race</code> folder (or restart <code>npm run dev:all</code> and wait for deploy to finish). Then use the buttons below.</p>
              <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap", marginTop: "var(--space-md)" }}>
                <button type="button" onClick={async () => { await loadDeployed(); refreshEscrowCheck(); }}>Reload addresses</button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={async () => {
                    await resetEverything();
                    setStep("lobby");
                  }}
                >
                  Reset everything
                </button>
              </div>
            </>
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

          {/* Four participants strip — always visible; set wallet per slot, switch MetaMask to act */}
          <div className="participants-strip card">
            <h2 className="participants-strip-title">Four participants (same screen)</h2>
            <p className="participants-strip-desc">Set each slot to a wallet, then use &quot;Join all 4&quot; and &quot;Enter as P1/P2/P3/P4&quot;. Switch MetaMask to the account you want to act as.</p>
            <div className="participants-grid">
              {[0, 1, 2, 3].map((i) => {
                const addr = participantAddresses[i];
                const isYou = address && addr && address.toLowerCase() === addr.toLowerCase();
                return (
                  <div key={i} className={`participant-slot ${isYou ? "participant-slot-you" : ""}`}>
                    <span className="participant-slot-label">Player {i + 1}</span>
                    <span className="participant-slot-address" title={addr ?? undefined}>
                      {addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "Not set"}
                    </span>
                    {address && (
                      <button
                        type="button"
                        className="btn-outline participant-slot-set"
                        onClick={() => setParticipant(i, address)}
                      >
                        Set to current
                      </button>
                    )}
                    {isYou && <span className="participant-slot-you-badge">You</span>}
                  </div>
                );
              })}
            </div>
            {participantsSetCount < 4 && (
              <p style={{ marginTop: "var(--space-sm)", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Set {4 - participantsSetCount} more participant slot{4 - participantsSetCount === 1 ? "" : "s"} before joining queue.
              </p>
            )}
            {hasDuplicateParticipants && (
              <p style={{ marginTop: "var(--space-sm)", color: "var(--error)", fontSize: "0.85rem" }}>
                Player slots must be unique wallets (P1, P2, P3, P4 cannot share the same address).
              </p>
            )}
          </div>

          {/* ─── Lobby ─── */}
          {step === "lobby" && (
            <div className="journey-scene">
              <div className="journey-hero">
                <h2>Enter the Arena</h2>
                <p className="journey-desc">Set all 4 participants above, then click &quot;Join all 4 to queue&quot;. Match is formed when 4 are in.</p>
              </div>
              <div className="card journey-card">
                <h2>Find a match</h2>
                <select value={queueTier} onChange={(e) => setQueueTier(e.target.value as "bronze-10" | "bronze-25")}>
                  <option value="bronze-10">Bronze-10 (10 USDC)</option>
                  <option value="bronze-25">Bronze-25 (25 USDC)</option>
                </select>
                {" "}
                <button
                  onClick={joinQueueAll}
                  disabled={queueLoading || !participantsReady}
                  title={
                    participantsSetCount < 4
                      ? "Set all 4 participant slots above first"
                      : hasDuplicateParticipants
                      ? "Each slot must use a different wallet address"
                      : undefined
                  }
                >
                  {queueLoading ? "…" : inQueue ? "Waiting for match…" : "Join all 4 to queue"}
                </button>
                {inQueue && (
                  <p style={{ marginTop: "var(--space-sm)", fontSize: "0.85rem", color: "var(--text-muted)" }}>Match will form when queue has 4. Polling…</p>
                )}
                {matchFound && (
                  <>
                    <p className="status status-ok" style={{ marginTop: "var(--space-lg)" }}>
                      Match found. Entry by: {new Date(matchFound.entry_deadline * 1000).toLocaleTimeString()}.
                    </p>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Go to Enter: create match (escrow owner), then Enter as P1, P2, P3, P4.</p>
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
                <p className="journey-desc">1. Switch to escrow owner → Create match. 2. For each player: switch MetaMask to that participant, then click &quot;Enter as P1/P2/P3/P4&quot;. 3. When 4/4, Start race.</p>
              </div>
              {/* Match status — auto-refreshes so you see X/4 after each entry */}
              <div className="card journey-card" style={{ textAlign: "left", maxWidth: "520px", borderColor: "rgba(0,229,204,0.3)" }}>
                <h2>Match status</h2>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
                  <label style={{ margin: 0 }}>Match ID</label>
                  <input
                    value={matchIdInput}
                    readOnly
                    style={{ flex: "1 1 8rem", minWidth: 0 }}
                    title="From queue (same for all 4 players)"
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--cyan)" }}>From queue</span>
                  <button onClick={() => fetchMatch({ matchId: matchIdInput.trim(), escrowAddress: deployed?.escrow ?? undefined })} disabled={fetchMatchLoading}>{fetchMatchLoading ? "…" : "Refresh"}</button>
                  <button type="button" className="btn-outline" onClick={async () => { await loadDeployed(); refreshEscrowCheck(); }}>Reload addresses</button>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={async () => {
                      await resetEverything();
                      setStep("lobby");
                    }}
                    title="Reload contract addresses and clear match/queue state"
                  >
                    Reset everything
                  </button>
                </div>
                {matchInfo && (
                  <p className={"status " + (matchInfo.startsWith("Status:") ? "status-ok" : matchInfo.startsWith("No match") ? "status-empty" : "status-err")} style={{ marginTop: "var(--space-md)", marginBottom: 0 }}>
                    {matchInfo}
                  </p>
                )}
              </div>
              {/* Create match: queue-only; match ID comes from Join all 4 */}
              <div className="card journey-card" style={{ textAlign: "left", maxWidth: "520px" }}>
                <h2>1. Create match (escrow owner only)</h2>
                {escrowOwner && address && address.toLowerCase() !== escrowOwner && (
                  <p className="tab-identity-switch" style={{ marginBottom: "var(--space-md)" }} role="alert">
                    Only the <strong>escrow owner</strong> (deployer account) can create. That is <strong>{escrowOwner.slice(0, 6)}…{escrowOwner.slice(-4)}</strong>. Switch MetaMask to that account.
                  </p>
                )}
                {matchFound ? (
                  <>
                    <p style={{ marginBottom: "var(--space-md)" }}>One click to create this match on-chain. Entry: {deployed && formatUnits(deployed.entryAmount, 6)} USDC per player. If the match was already created, clicking again will refresh status instead of sending a tx.</p>
                    <button
                      onClick={() => createMatchWithId(matchFound.matchId)}
                      disabled={txPending || (escrowOwner != null && address != null && address.toLowerCase() !== escrowOwner)}
                      title={escrowOwner != null && address && address.toLowerCase() !== escrowOwner ? "Only the escrow owner can create" : undefined}
                    >
                      {txPending ? "Confirm in wallet…" : "Create match on-chain"}
                    </button>
                  </>
                ) : (
                  <p style={{ marginBottom: 0, color: "var(--text-muted)" }}>Get a match from the Lobby first: set all 4 participants and click &quot;Join all 4 to queue&quot;, then continue to Enter.</p>
                )}
              </div>
              {/* Enter: one button per participant */}
              <div className="card journey-card" style={{ textAlign: "left", maxWidth: "600px" }}>
                <h2>2. Enter match (each player)</h2>
                <p style={{ marginBottom: "var(--space-md)" }}>Switch MetaMask to the player, then click that player&apos;s Enter button. All four slots stay on screen so you can switch and click easily.</p>
                <div className="enter-as-buttons">
                  {[0, 1, 2, 3].map((i) => {
                    const addr = participantAddresses[i];
                    const isCurrent = address && addr && address.toLowerCase() === addr.toLowerCase();
                    const disabled = txPending || !addr || !isCurrent;
                    return (
                      <button
                        key={i}
                        onClick={() => enterMatchAs(i)}
                        disabled={disabled}
                        title={!addr ? `Set Player ${i + 1} above` : !isCurrent ? `Switch MetaMask to P${i + 1}` : undefined}
                        className={isCurrent ? "enter-as-btn active" : "enter-as-btn"}
                      >
                        {txPending ? "Confirm in wallet…" : !addr ? `P${i + 1} (not set)` : !isCurrent ? `Enter as P${i + 1} (switch wallet)` : `Enter as P${i + 1}`}
                      </button>
                    );
                  })}
                </div>
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

              {/* Two-column layout: example board (left) | arena board when loaded (right) */}
              <div className="arena-boards-row">
                {/* Example "How it works" board — always visible beside or above the live board */}
                <div className="arena-example-board-wrap">
                  <h3 className="arena-example-title">How it works</h3>
                  <div className="arena-example-content">
                    <div className="example-board-wrap" key={exampleFrame}>
                      <div className="example-board-labels example-board-labels-top">Finish ↑</div>
                      <div className="example-board">
                        {[0, 1, 2, 3, 4, 5, 6].map((row) =>
                          [0, 1, 2, 3, 4, 5, 6].map((col) => {
                            const tile = row * 7 + col;
                            const positions = EXAMPLE_FRAMES[exampleFrame].positions;
                            const tokensHere: { p: number; t: number }[] = [];
                            positions.forEach((playerTiles, p) =>
                              playerTiles.forEach((posTile, t) => {
                                if (posTile === tile) tokensHere.push({ p, t });
                              })
                            );
                            const tokenClass = tokensHere[0] ? `token-p${tokensHere[0].p} has-token` : "";
                            const rowClass = row === 0 ? " game-tile-row-finish" : row === 6 ? " game-tile-row-start" : "";
                            return (
                              <div
                                key={`ex-${row}-${col}`}
                                className={`example-tile ${tokenClass} ${rowClass}`}
                                title={`Tile ${tile}${tokensHere.length ? " — " + tokensHere.map(({ p, t }) => `P${p} token ${t}`).join(", ") : ""}`}
                              >
                                <span className="example-tile-id">{tile}</span>
                                {tokensHere.length > 0 && (
                                  <span className="example-tile-racers example-tile-racers-enter">
                                    {tokensHere.map(({ p, t }) => (
                                      <span key={`${p}-${t}`} className={`game-racer token-p${p}`}>{t}</span>
                                    ))}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="example-board-labels example-board-labels-bottom">Start ↓</div>
                    </div>
                    <div className="arena-example-step" role="status" aria-live="polite">
                      <span className="arena-example-step-dots">
                        {EXAMPLE_FRAMES.map((_, i) => (
                          <span key={i} className={i === exampleFrame ? "is-active" : ""} aria-hidden />
                        ))}
                      </span>
                      <p className="arena-example-step-label">{EXAMPLE_FRAMES[exampleFrame].label}</p>
                    </div>
                    <ul className="arena-example-callouts">
                      <li><strong>4 players</strong>, each with <strong>3 tokens</strong> (0, 1, 2).</li>
                      <li><strong>Each turn</strong> you choose a <strong>destination tile (0–48)</strong> for each token.</li>
                      <li><strong>Higher rows</strong> (e.g. row 0 = finish) score <strong>more points</strong>.</li>
                    </ul>
                  </div>
                </div>

                {!matchState ? (
                  <div className="arena-board-placeholder card">
                    <p>Live board will appear here once the match has started.</p>
                    <button type="button" onClick={goToArena} disabled={matchActionLoading}>
                      {matchActionLoading ? "…" : "Start match / Refresh state"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="arena-live-section">
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

                      {playerIndex != null && (
                        <p className="arena-board-hint">Click a tile to set <strong>Token {selectedTokenForMove}</strong> destination</p>
                      )}
                      <div className="game-board-container arena-board-main">
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
                              if (selectedTokenForMove === 0) setMatchMove0(String(tile));
                              else if (selectedTokenForMove === 1) setMatchMove1(String(tile));
                              else setMatchMove2(String(tile));
                            };
                            const destClass =
                              matchMove0 === String(tile) ? " game-tile-dest-0" :
                              matchMove1 === String(tile) ? " game-tile-dest-1" :
                              matchMove2 === String(tile) ? " game-tile-dest-2" : "";
                            const rowClass = row === 0 ? " game-tile-row-finish" : row === 6 ? " game-tile-row-start" : "";
                            const tileContent = (
                              <>
                                <span className="game-tile-id" title={`Tile ${tile}`}>{tile}</span>
                                {tokensHere.length > 0 && (
                                  <span className="game-tile-racers" aria-hidden>
                                    {tokensHere.map(({ p, t }) =>
                                      p === playerIndex ? (
                                        <span
                                          key={`${p}-${t}`}
                          className={`game-racer token-p${p} game-racer-draggable`}
                                          title={`Player ${p} token ${t} — drag to move`}
                                          draggable
                                          onDragStart={(e) => {
                                            e.stopPropagation();
                                            e.dataTransfer.setData(DRAG_TOKEN_KEY, String(t));
                                            e.dataTransfer.effectAllowed = "move";
                                          }}
                                          onDragEnd={() => setDragOverTile(null)}
                                        >
                                          {t}
                                        </span>
                                      ) : (
                                        <span key={`${p}-${t}`} className={`game-racer token-p${p}`} title={`Player ${p} token ${t}`}>
                                          {t}
                                        </span>
                                      )
                                    )}
                                  </span>
                                )}
                              </>
                            );
                            const handleDragOver = (e: React.DragEvent) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                              if (isSelectable) setDragOverTile(tile);
                            };
                            const handleDrop = (e: React.DragEvent) => {
                              e.preventDefault();
                              setDragOverTile(null);
                              if (playerIndex == null) return;
                              const tokenIndex = parseInt(e.dataTransfer.getData(DRAG_TOKEN_KEY), 10);
                              if (tokenIndex === 0) setMatchMove0(String(tile));
                              else if (tokenIndex === 1) setMatchMove1(String(tile));
                              else if (tokenIndex === 2) setMatchMove2(String(tile));
                              setSelectedTokenForMove(tokenIndex as 0 | 1 | 2);
                            };
                            const handleDragLeave = () => setDragOverTile(null);
                            return isSelectable ? (
                              <button
                                type="button"
                                key={`${row}-${col}`}
                                className={"game-tile game-tile-selectable " + (tokenClasses[0] ?? "") + rowClass + destClass + (dragOverTile === tile ? " game-tile-drag-over" : "")}
                                title={`Tile ${tile} — Click or drag a token here`}
                                onClick={handleTileClick}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                              >
                                {tileContent}
                                {destClass && (
                                  <span className={"game-tile-dest-badge game-tile-dest-badge-" + (matchMove0 === String(tile) ? "0" : matchMove1 === String(tile) ? "1" : "2")}>
                                    {matchMove0 === String(tile) ? "0" : matchMove1 === String(tile) ? "1" : "2"}
                                  </span>
                                )}
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
                    </div>

                    {playerIndex != null && (
                    <div className="arena-moves-panel card">
                      <h2>Your move this turn</h2>
                      <p className="arena-moves-desc"><strong>Drag a token</strong> to a tile, or pick a token and <strong>click a tile</strong>, or type tile numbers (0–48).</p>
                      <div className="arena-token-selector" role="group" aria-label="Choose which token to set">
                        <span className="arena-token-selector-label">Set destination for:</span>
                        {([0, 1, 2] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            className={"arena-token-btn " + (selectedTokenForMove === t ? "is-selected" : "")}
                            onClick={() => setSelectedTokenForMove(t)}
                            aria-pressed={selectedTokenForMove === t}
                          >
                            Token {t} → {t === 0 ? matchMove0 : t === 1 ? matchMove1 : matchMove2}
                          </button>
                        ))}
                      </div>
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
                      <div className="arena-moves-actions">
                        <button
                          type="button"
                          className="btn-outline"
                          onClick={() => {
                            const pos = matchState.tokenPositions?.[playerIndex];
                            if (pos?.length === 3) {
                              setMatchMove0(String(pos[0]));
                              setMatchMove1(String(pos[1]));
                              setMatchMove2(String(pos[2]));
                            }
                          }}
                        >
                          Reset to current
                        </button>
                        <button type="button" className="arena-submit-move" onClick={submitMatchAction} disabled={matchActionLoading}>
                          {matchActionLoading ? "Submitting…" : "Submit move"}
                        </button>
                      </div>
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
