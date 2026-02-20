import { useEffect } from "react";
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

  useEffect(() => {
    document.title = "Play – Arena Race";
    return () => {
      document.title = "Arena Race";
    };
  }, []);

  useEffect(() => {
    if (matchFound) setMatchIdInput(matchFound.matchId);
  }, [matchFound?.matchId, setMatchIdInput]);

  return (
    <div>
      <h1>Play — Arena Race</h1>
      <p>Connect to Localhost 8545. Queue for a match, create/enter, then play and submit results.</p>

      {!deployed && (
        <div className="card">
          <p>Load deployed addresses: run <code>npm run deploy:localhost</code> (after starting the node).</p>
        </div>
      )}

      {deployed && escrowHasCode === false && (
        <div className="card" style={{ borderColor: "var(--error)", background: "rgba(248,113,113,0.1)" }}>
          <h2>No contract at escrow address</h2>
          {chainId != null && chainId !== 31337 ? (
            <p><strong>Wrong network.</strong> This app uses Localhost. In MetaMask, switch to <strong>Localhost 8545</strong> (RPC URL <code>http://127.0.0.1:8545</code>, chain id <strong>31337</strong>). Then refresh this page.</p>
          ) : (
            <p>With the Hardhat node running, run <code>npm run deploy:localhost</code> in <code>arena-race</code>, then refresh this page.</p>
          )}
        </div>
      )}

      {msg && (
        <div className={`msg-box msg-box-${msg.type}`} role="alert">
          <span className="msg-text">{msg.text}</span>
          <button type="button" className="msg-dismiss" onClick={() => setMsg(null)} aria-label="Dismiss message">
            Dismiss
          </button>
        </div>
      )}

      {deployed && address && (
        <>
          <div className="card">
            <h2>Queue (find a match)</h2>
            <p><strong>Each of the 4 players</strong> must click Join queue (same tier, e.g. Bronze-10). When the 4th joins, the server forms a match and everyone sees &quot;Match found&quot;. Then owner creates the match on-chain and all 4 enter. <strong>Order:</strong> Queue → Match found → Create on-chain + Enter ×4 → Start match below → Live match.</p>
            <select value={queueTier} onChange={(e) => setQueueTier(e.target.value as "bronze-10" | "bronze-25")}>
              <option value="bronze-10">Bronze-10 (10 USDC)</option>
              <option value="bronze-25">Bronze-25 (25 USDC)</option>
            </select>
            <button onClick={joinQueue} disabled={queueLoading || inQueue}>{queueLoading ? "…" : inQueue ? "In queue…" : "Join queue"}</button>
            {inQueue && <button type="button" onClick={leaveQueue} disabled={queueLoading}>Leave queue</button>}
            {matchFound && (
              <>
                <p className="status status-ok">Match found! Entry deadline: {new Date(matchFound.entry_deadline * 1000).toLocaleTimeString()}.</p>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Owner: create this match on-chain first. Then all 4 players use Enter match below.</p>
                <button type="button" onClick={() => createMatchWithId(matchFound!.matchId)} disabled={txPending}>{txPending ? "Confirm in wallet…" : "Create this match on-chain (owner)"}</button>
              </>
            )}
          </div>

          <div className="card">
            <h2>Match ID (numeric seed or 0x… from queue)</h2>
            <label>Seed</label>
            <input value={matchIdInput} onChange={(e) => setMatchIdInput(e.target.value)} placeholder="1" />
            <button onClick={fetchMatch} disabled={fetchMatchLoading}>
              {fetchMatchLoading ? "Fetching…" : "Fetch match"}
            </button>
            {matchInfo && <p className={"status " + (matchInfo.startsWith("Status:") ? "status-ok" : matchInfo.startsWith("No match") ? "status-empty" : "status-err")}>{matchInfo}</p>}
          </div>

          <div className="card">
            <h2>Create match (owner only)</h2>
            <p>Entry: {formatUnits(deployed.entryAmount, 6)} USDC per player. Only click once per match — if you see &quot;Match already exists&quot;, use Enter match with other accounts instead.</p>
            <button onClick={createMatch} disabled={txPending}>{txPending ? "Confirm in wallet…" : "Create match"}</button>
          </div>

          <div className="card">
            <h2>Enter match</h2>
            <p>Approve USDC and submit entry for the <strong>current</strong> account (the one shown in the header).</p>
            <p style={{ marginTop: "0.5rem", color: "var(--text-muted)" }}>Adding another player? Switch to that account in MetaMask — the address in the header should update — then click Enter match.</p>
            <button onClick={enterMatch} disabled={txPending}>{txPending ? "Confirm in wallet…" : "Enter match"}</button>
          </div>

          <div className="card">
            <h2>Live match (board and moves)</h2>
            <p>For a match that is already Escrowed (4/4 entries): put its <strong>Match ID</strong> above (seed number or 0x… from queue), then click <strong>Start match / Refresh state</strong>. The game server will start the turn loop and the board will appear. Submit moves each turn (tile 0–48 for your 3 tokens). Ensure the game server is running and <code>ESCROW_ADDRESS</code> is set in its .env.</p>
            <button type="button" onClick={startMatchThenLoad} disabled={matchActionLoading}>{matchActionLoading ? "…" : "Start match / Refresh state"}</button>
            {matchState && (
              <>
                <p>Turn {matchState.turnIndex} — {matchState.turnDeadlineMs != null ? `deadline in ${Math.max(0, Math.ceil((matchState.turnDeadlineMs - Date.now()) / 1000))}s` : ""}</p>
                <p>Scores: P0={matchState.scores[0]?.total ?? 0} P1={matchState.scores[1]?.total ?? 0} P2={matchState.scores[2]?.total ?? 0} P3={matchState.scores[3]?.total ?? 0}</p>
                <div style={{ display: "inline-block", border: "1px solid var(--border)", marginBottom: "0.5rem" }}>
                  {[0, 1, 2, 3, 4, 5, 6].map((row) => (
                    <div key={row} style={{ display: "flex" }}>
                      {[0, 1, 2, 3, 4, 5, 6].map((col) => {
                        const tile = row * 7 + col;
                        const tokens: string[] = [];
                        matchState.tokenPositions?.forEach((positions, p) =>
                          positions?.forEach((pos, t) => { if (pos === tile) tokens.push(`P${p}T${t}`); })
                        );
                        return (
                          <div
                            key={col}
                            style={{
                              width: 32,
                              height: 32,
                              border: "1px solid #475569",
                              background: "var(--bg-secondary)",
                              fontSize: 9,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            title={`Tile ${tile} ${tokens.join(" ")}`}
                          >
                            {tokens.slice(0, 2).join(" ") || ""}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {playerIndex != null && (
                  <>
                    <label>Your moves (tile 0–48 for token 0, 1, 2)</label>
                    <input value={matchMove0} onChange={(e) => setMatchMove0(e.target.value)} placeholder="0" style={{ width: 48 }} />
                    <input value={matchMove1} onChange={(e) => setMatchMove1(e.target.value)} placeholder="1" style={{ width: 48 }} />
                    <input value={matchMove2} onChange={(e) => setMatchMove2(e.target.value)} placeholder="2" style={{ width: 48 }} />
                    <button type="button" onClick={submitMatchAction} disabled={matchActionLoading}>{matchActionLoading ? "…" : "Submit move"}</button>
                  </>
                )}
              </>
            )}
          </div>

          <div className="card">
            <h2>Submit result (signer only)</h2>
            <p>Placement: 1st, 2nd, 3rd, 4th as player indices (e.g. 0,1,2,3). <strong>Run the signer in a terminal</strong>: <code>cd arena-race && npm run signer</code> — otherwise you&apos;ll get &quot;Invalid signature&quot;.</p>
            {signerMatchesContract === false && (
              <p style={{ color: "var(--error)", marginBottom: "0.5rem" }}>
                Signer address does not match the contract&apos;s result signer. For localhost, run the signer <strong>without</strong> a .env that overrides DEPLOYER_PRIVATE_KEY, or set DEPLOYER_PRIVATE_KEY to the first Hardhat account key (see terminal when you run npm run node:localhost).
              </p>
            )}
            <input value={placementInput} onChange={(e) => setPlacementInput(e.target.value)} placeholder="0,1,2,3" />
            <button onClick={submitResult} disabled={txPending}>{txPending ? "Confirm in wallet…" : "Submit result"}</button>
          </div>
        </>
      )}

      {deployed && !address && (
        <div className="card">
          <p>Connect your wallet (header) to queue, create, and play matches.</p>
        </div>
      )}
    </div>
  );
}

// Export for use in App (matchIdToBytes32, resolveMatchId, decodeRevertReason used in handlers)
export { decodeRevertReason, matchIdToBytes32, resolveMatchId, SIGNER_URL, GAME_SERVER_URL, STATUS_NAMES };
