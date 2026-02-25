import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Contract, formatUnits, JsonRpcProvider, zeroPadValue } from "ethers";
import type { Provider } from "ethers";
import { ESCROW_ABI, ERC20_ABI } from "./abis";
import { useWallet } from "./context/WalletContext";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import Play from "./pages/Play";
import GameSimulator from "./pages/GameSimulator";
import Rewards from "./pages/Rewards";
import Wallet from "./pages/Wallet";
import Account from "./pages/Account";
import {
  decodeRevertReason,
  resolveMatchId,
  STATUS_NAMES,
  SIGNER_URL,
  GAME_SERVER_URL,
} from "./pages/Play";
import type { PlayPageProps, MatchState } from "./pages/Play";

const PARTICIPANTS_STORAGE_KEY = "arena_race_participants";

function loadStoredParticipants(): (string | null)[] {
  try {
    const raw = sessionStorage.getItem(PARTICIPANTS_STORAGE_KEY);
    if (!raw) return [null, null, null, null];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 4) return [null, null, null, null];
    return parsed.map((v) => (typeof v === "string" && v.startsWith("0x") ? v : null));
  } catch {
    return [null, null, null, null];
  }
}

function saveParticipants(arr: (string | null)[]) {
  try {
    sessionStorage.setItem(PARTICIPANTS_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

/** Normalize matchId to 0x + 64 lowercase hex so contract lookup is consistent. */
function normalizeMatchIdHex(id: string): string {
  const t = id.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(t)) return "0x" + t.slice(2).toLowerCase();
  return t;
}

/** Read match status from chain. matchIdBytes32 must be the same key used at create (use resolveMatchId). */
async function fetchMatchFromChain(
  provider: Provider,
  escrowAddress: string,
  matchIdBytes32: string
): Promise<string | null> {
  try {
    const key = zeroPadValue(matchIdBytes32, 32);
    const escrow = new Contract(escrowAddress, ESCROW_ABI, provider);
    const m = await escrow.matches(key);
    const row = m as unknown as Record<string, unknown> & Array<unknown>;
    const pick = (...keys: Array<string | number>) => {
      for (const keyCandidate of keys) {
        const v = typeof keyCandidate === "number" ? row?.[keyCandidate] : row?.[keyCandidate];
        if (v !== undefined && v !== null) return v;
      }
      return undefined;
    };
    const toNumber = (v: unknown, fallback = 0) => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "bigint") return Number(v);
      if (typeof v === "string" && v.trim() !== "") {
        const parsed = Number(v);
        if (Number.isFinite(parsed)) return parsed;
      }
      return fallback;
    };
    const toBigInt = (v: unknown, fallback: bigint = 0n) => {
      if (typeof v === "bigint") return v;
      if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
      if (typeof v === "string" && v.trim() !== "") {
        try {
          return BigInt(v);
        } catch {
          return fallback;
        }
      }
      return fallback;
    };
    // Current getter ABI (8 outputs): entries=4, status=5, entryDeadline=7.
    // Include legacy fallbacks for older local builds.
    const entryDeadline = toNumber(pick("entryDeadline", 7, 8, 11), 0);
    if (entryDeadline === 0) return null;
    const statusVal = toNumber(pick("status", 5, 6, 9), 0);
    const entriesReceived = toNumber(pick("entriesReceived", 4, 5, 8), 0);
    const poolAmount = toBigInt(pick("poolAmount", 3), 0n);
    const status = STATUS_NAMES[statusVal] ?? "?";
    return `Status: ${status} | Entries: ${entriesReceived}/4 | Pool: ${formatUnits(poolAmount, 6)} USDC`;
  } catch (e) {
    console.warn("[fetchMatchFromChain]", (e as Error)?.message ?? e);
    return null;
  }
}

export default function App() {
  const { provider, address, deployed, chainId, usdcBalance, refreshBalance, refreshAccount, loadDeployed } = useWallet();
  const [participantAddresses, setParticipantAddressesState] = useState<(string | null)[]>(loadStoredParticipants);
  const setParticipant = (slot: number, value: string | null) => {
    if (slot < 0 || slot > 3) return;
    setParticipantAddressesState((prev) => {
      const next = [...prev];
      next[slot] = value;
      saveParticipants(next);
      return next;
    });
  };
  const [matchIdInput, setMatchIdInput] = useState("");
  const [placementInput, setPlacementInput] = useState("0,1,2,3");
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [matchInfo, setMatchInfo] = useState<string>("");
  const [txPending, setTxPending] = useState(false);
  const [escrowHasCode, setEscrowHasCode] = useState<boolean | null>(null);
  const [escrowCheckTrigger, setEscrowCheckTrigger] = useState(0);
  const refreshEscrowCheck = () => setEscrowCheckTrigger((t) => t + 1);
  const [signerMatchesContract, setSignerMatchesContract] = useState<boolean | null>(null);
  const [escrowOwner, setEscrowOwner] = useState<string | null>(null);
  const [fetchMatchLoading, setFetchMatchLoading] = useState(false);
  const [queueTier, setQueueTier] = useState<"bronze-10" | "bronze-25">("bronze-10");
  const [inQueue, setInQueue] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [matchFound, setMatchFound] = useState<{ matchId: string; entry_deadline: number } | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [playerIndex, setPlayerIndex] = useState<number | null>(null);
  const [matchMove0, setMatchMove0] = useState("");
  const [matchMove1, setMatchMove1] = useState("");
  const [matchMove2, setMatchMove2] = useState("");
  const [matchActionLoading, setMatchActionLoading] = useState(false);
  /** Increment on Reset so in-flight queue poll responses are ignored and don't restore old matchFound. */
  const queuePollGenerationRef = useRef(0);
  /** Once we've successfully used the contract (create/enter), don't let getCode overwrite to false (avoids RPC quirks). */
  const contractConfirmedRef = useRef(false);
  const lastEscrowAddressRef = useRef<string | null>(null);

  useEffect(() => {
    setMsg(null);
  }, [address]);

  useEffect(() => {
    if (!provider || !deployed?.escrow) return;
    const escrowAddr = deployed.escrow;
    if (lastEscrowAddressRef.current !== escrowAddr) {
      lastEscrowAddressRef.current = escrowAddr;
      contractConfirmedRef.current = false;
    }
    provider.getCode(escrowAddr).then((code) => {
      const hasCode = code !== "0x" && code.length > 4;
      if (hasCode) {
        setEscrowHasCode(true);
        contractConfirmedRef.current = true;
      } else {
        if (!contractConfirmedRef.current) setEscrowHasCode(false);
      }
    }).catch(() => {
      if (!contractConfirmedRef.current) setEscrowHasCode(null);
    });
  }, [provider, deployed?.escrow, escrowCheckTrigger]);

  useEffect(() => {
    if (!provider || !deployed?.escrow) return;
    const escrow = new Contract(deployed.escrow, ESCROW_ABI, provider);
    Promise.all([
      fetch(SIGNER_URL + "/whoami").then((r) => r.ok ? r.json() : null).catch(() => null),
      escrow.resultSigner().catch(() => null),
      escrow.owner().catch(() => null),
    ]).then(([who, contractSigner, owner]) => {
      if (who?.address && contractSigner) {
        setSignerMatchesContract(who.address.toLowerCase() === String(contractSigner).toLowerCase());
      } else {
        setSignerMatchesContract(null);
      }
      const raw = owner != null ? String(owner) : "";
      setEscrowOwner(/^0x[0-9a-fA-F]{40}$/.test(raw) ? raw.toLowerCase() : null);
    }).catch(() => {
      setSignerMatchesContract(null);
      setEscrowOwner(null);
    });
  }, [provider, deployed?.escrow]);

  // Poll queue status when in queue (use first participant wallet if set, else current address).
  useEffect(() => {
    const wallet = participantAddresses[0] || address;
    if (!wallet || !inQueue) return;
    const t = setInterval(async () => {
      const generationWhenFired = queuePollGenerationRef.current;
      try {
        const res = await fetch(`${GAME_SERVER_URL}/queue/status?wallet=${encodeURIComponent(wallet)}`);
        const data = await res.json();
        if (generationWhenFired !== queuePollGenerationRef.current) return;
        if (data.status === "match_found" && data.matchId) {
          setMatchFound({ matchId: data.matchId, entry_deadline: data.entry_deadline });
          setInQueue(false);
        }
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(t);
  }, [address, participantAddresses, inQueue]);

  const loadMatchState = async () => {
    if (!matchIdInput.trim() || !address) return;
    const mid = zeroPadValue(resolveMatchId(matchIdInput.trim()), 32);
    const escrowParam = deployed?.escrow ? `&escrowAddress=${encodeURIComponent(deployed.escrow)}` : "";
    try {
      const [stateRes, statusRes] = await Promise.all([
        fetch(`${GAME_SERVER_URL}/match/state?matchId=${encodeURIComponent(mid)}`),
        fetch(`${GAME_SERVER_URL}/match/status?matchId=${encodeURIComponent(mid)}${escrowParam}`),
      ]);
      if (stateRes.ok) {
        const data = await stateRes.json();
        const submittedPlayers = Array.isArray(data.submittedPlayers)
          ? data.submittedPlayers.filter((p: unknown) => typeof p === "number" && Number.isInteger(p) && p >= 0 && p <= 3)
          : [];
        setMatchState({
          turnIndex: data.turnIndex,
          tokenPositions: data.tokenPositions,
          scores: data.scores?.map((s: { total: number }) => ({ total: s.total })) ?? [],
          turnDeadlineMs: data.turnDeadlineMs,
          submittedPlayers,
        });
      } else {
        setMatchState(null);
      }
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const wallets = statusData.playerWallets;
        if (Array.isArray(wallets) && wallets.length === 4) {
          const idx = wallets.findIndex((w: string) => String(w).toLowerCase() === address.toLowerCase());
          setPlayerIndex(idx >= 0 ? idx : null);
          return;
        }
      }
      // Fallback for local single-screen flow when chain getter doesn't expose wallet slots.
      const localPlayers = participantAddresses
        .filter((w): w is string => typeof w === "string" && w.startsWith("0x"))
        .map((w) => w.toLowerCase());
      if (localPlayers.length === 4) {
        const idx = localPlayers.findIndex((w) => w === address.toLowerCase());
        setPlayerIndex(idx >= 0 ? idx : null);
        return;
      }
      setPlayerIndex(null);
    } catch {
      setMatchState(null);
      setPlayerIndex(null);
    }
  };

  const startMatchThenLoad = async () => {
    if (!provider || !deployed || !matchIdInput.trim()) return;
    const mid = zeroPadValue(resolveMatchId(matchIdInput), 32);
    setMatchActionLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${GAME_SERVER_URL}/match/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: mid, escrowAddress: deployed.escrow }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "match already running") {
          setMsg({ type: "success", text: "Match already started. Loading…" });
          await loadMatchState();
          setMatchActionLoading(false);
          return;
        }
        const reason = data.reason ? ` (${data.reason})` : "";
        let text = data.error ?? `Start failed (${res.status})`;
        if (data.reason === "pending_entries") {
          text += ". Match must be Escrowed (4/4 entered). Refresh Match status above; if it shows 4/4, the game server may have started before deploy — restart dev:all or click Reset then try again.";
        } else {
          text += reason;
        }
        setMsg({ type: "error", text });
        setMatchActionLoading(false);
        return;
      }
      await loadMatchState();
    } catch (e) {
      setMsg({ type: "error", text: (e as Error)?.message ?? "Start failed (game server unreachable?)" });
    } finally {
      setMatchActionLoading(false);
    }
  };

  const submitMatchAction = async (
    opts?: { playerIndexOverride?: number; moves?: [number, number, number] }
  ): Promise<boolean> => {
    if (!matchIdInput.trim() || matchState == null) return false;
    const effectivePlayerIndex =
      typeof opts?.playerIndexOverride === "number"
        ? opts.playerIndexOverride
        : playerIndex;
    if (
      typeof effectivePlayerIndex !== "number" ||
      effectivePlayerIndex < 0 ||
      effectivePlayerIndex > 3
    ) {
      setMsg({
        type: "error",
        text: "Select which player you want to control before submitting a move.",
      });
      return false;
    }
    const mid = zeroPadValue(resolveMatchId(matchIdInput), 32);
    const cur = matchState.tokenPositions?.[effectivePlayerIndex];
    const currentTiles: [number, number, number] = [
      Number(cur?.[0] ?? 0),
      Number(cur?.[1] ?? 1),
      Number(cur?.[2] ?? 2),
    ];
    const parseMoveFromInput = (raw: string, token: 0 | 1 | 2): number | null => {
      if (currentTiles[token] < 0) return -1;
      const trimmed = raw.trim();
      if (trimmed === "") return null;
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n < 0 || n > 48) return null;
      return n;
    };
    const parseMoveFromOverride = (value: number, token: 0 | 1 | 2): number | null => {
      if (currentTiles[token] < 0) return -1;
      if (!Number.isInteger(value) || value < 0 || value > 48) return null;
      return value;
    };
    const parsedMoves: [number | null, number | null, number | null] = opts?.moves
      ? [
          parseMoveFromOverride(opts.moves[0], 0),
          parseMoveFromOverride(opts.moves[1], 1),
          parseMoveFromOverride(opts.moves[2], 2),
        ]
      : [
          parseMoveFromInput(matchMove0, 0),
          parseMoveFromInput(matchMove1, 1),
          parseMoveFromInput(matchMove2, 2),
        ];
    const firstInvalidIndex = parsedMoves.findIndex((v) => v == null);
    if (firstInvalidIndex >= 0) {
      setMsg({
        type: "error",
        text: `Invalid destination for Token ${firstInvalidIndex}. Use an integer tile index 0–48.`,
      });
      return false;
    }
    const normalizedMoves: [number, number, number] = [
      parsedMoves[0] as number,
      parsedMoves[1] as number,
      parsedMoves[2] as number,
    ];
    const isLegalStep = (from: number, to: number): boolean => {
      if (from < 0) return to === -1;
      if (to === from) return true;
      const fromRow = Math.floor(from / 7);
      const fromCol = from % 7;
      const toRow = Math.floor(to / 7);
      const toCol = to % 7;
      const rowAdvance = fromRow - toRow;
      if (rowAdvance < 0 || rowAdvance > 2) return false;
      if (Math.abs(toCol - fromCol) > 1) return false;
      return true;
    };
    for (let token = 0; token < 3; token++) {
      const from = currentTiles[token];
      const to = normalizedMoves[token];
      if (!isLegalStep(from, to)) {
        setMsg({
          type: "error",
          text: `Illegal move for Token ${token}. Stay put or move up 1-2 rows with max 1 column sideways.`,
        });
        return false;
      }
    }
    setMatchActionLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${GAME_SERVER_URL}/match/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: mid,
          turnIndex: matchState.turnIndex,
          playerIndex: effectivePlayerIndex,
          moves: normalizedMoves,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const pendingPlayers = Array.isArray(data.pendingPlayers)
          ? data.pendingPlayers.filter((p: unknown) => typeof p === "number" && p >= 0 && p <= 3)
          : [];
        setMsg({
          type: "success",
          text: data.resolved
            ? `Move submitted for P${effectivePlayerIndex}. Turn ${data.resolvedTurnIndex} resolved.`
            : pendingPlayers.length > 0
            ? `Move submitted for P${effectivePlayerIndex}. Waiting for: ${pendingPlayers.map((p: number) => `P${p}`).join(", ")}.`
            : `Move submitted for P${effectivePlayerIndex}.`,
        });
        await loadMatchState();
        return true;
      } else {
        if (typeof data.expectedTurnIndex === "number") {
          setMsg({
            type: "error",
            text: `Turn already advanced. Expected turn ${data.expectedTurnIndex}. Board refreshed; submit again.`,
          });
          await loadMatchState();
          return false;
        }
        setMsg({ type: "error", text: data.error ?? "Submit failed" });
        return false;
      }
    } catch (e) {
      setMsg({ type: "error", text: (e as Error)?.message ?? "Submit failed" });
      return false;
    } finally {
      setMatchActionLoading(false);
    }
  };

  const resolveTurnNow = async (): Promise<boolean> => {
    if (!matchIdInput.trim()) return false;
    const mid = zeroPadValue(resolveMatchId(matchIdInput.trim()), 32);
    setMatchActionLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${GAME_SERVER_URL}/match/resolve-turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: mid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const pendingPlayers = Array.isArray(data.pendingPlayers)
          ? data.pendingPlayers.filter((p: unknown) => typeof p === "number" && p >= 0 && p <= 3)
          : [];
        setMsg({
          type: "error",
          text: data.error
            ? `${data.error}${pendingPlayers.length ? ` (Waiting for: ${pendingPlayers.map((p: number) => `P${p}`).join(", ")})` : ""}`
            : "Could not resolve turn.",
        });
        return false;
      }
      setMsg({
        type: "success",
        text: `Turn ${data.resolvedTurnIndex} resolved manually.`,
      });
      await loadMatchState();
      return true;
    } catch (e) {
      setMsg({ type: "error", text: (e as Error)?.message ?? "Resolve turn failed" });
      return false;
    } finally {
      setMatchActionLoading(false);
    }
  };

  useEffect(() => {
    if (!matchState || !matchIdInput.trim()) return;
    const t = setInterval(loadMatchState, 1500);
    return () => clearInterval(t);
  }, [matchState != null, matchIdInput]);

  const joinQueue = async () => {
    if (!address) return;
    setQueueLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${GAME_SERVER_URL}/queue/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: queueTier, wallet: address }),
      });
      const data = await res.json();
      if (res.ok && data.status === "match_found") {
        setMatchFound({ matchId: data.matchId, entry_deadline: data.entry_deadline });
        setInQueue(false);
        setMsg({ type: "success", text: "Match found! Proceed to pay entry below." });
      } else if (res.ok) {
        setInQueue(true);
        setMsg({ type: "success", text: "Joined queue. Waiting for 4 players…" });
      } else {
        setMsg({ type: "error", text: data.error || "Join failed" });
      }
    } catch (e) {
      setMsg({ type: "error", text: (e as Error)?.message ?? "Game server unreachable. Start it with: npm run game-server" });
    } finally {
      setQueueLoading(false);
    }
  };

  const leaveQueue = async () => {
    if (!address) return;
    setQueueLoading(true);
    try {
      await fetch(`${GAME_SERVER_URL}/queue/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: queueTier, wallet: address }),
      });
      setInQueue(false);
      setMatchFound(null);
      setMsg(null);
    } catch {
      // ignore
    } finally {
      setQueueLoading(false);
    }
  };

  /** Join queue with all 4 participant slots (for single-screen local testing). */
  const joinQueueAll = async () => {
    const allSet = participantAddresses.every((a) => a != null && a.startsWith("0x"));
    if (!allSet) {
      setMsg({ type: "error", text: "Set all 4 participants above (use 'Set to current account' for each slot)." });
      return;
    }
    const normalized = participantAddresses.map((a) => String(a).toLowerCase());
    if (new Set(normalized).size !== 4) {
      setMsg({
        type: "error",
        text: "All 4 participant slots must be different wallets. Switch MetaMask account and set each slot once (P1–P4).",
      });
      return;
    }
    setQueueLoading(true);
    setMsg(null);
    setMatchFound(null);
    setInQueue(false);
    const generationWhenStarted = queuePollGenerationRef.current;
    try {
      let matchFromJoin: { matchId: string; entry_deadline: number } | null = null;
      for (let i = 0; i < 4; i++) {
        const wallet = participantAddresses[i]!;
        const res = await fetch(`${GAME_SERVER_URL}/queue/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: queueTier, wallet }),
        });
        const data = await res.json();
        if (res.ok && data.status === "match_found" && data.matchId) {
          matchFromJoin = { matchId: data.matchId, entry_deadline: data.entry_deadline };
        }
        if (!res.ok) {
          setMsg({ type: "error", text: data.error || `Join P${i + 1} failed` });
          setQueueLoading(false);
          return;
        }
      }
      if (generationWhenStarted !== queuePollGenerationRef.current) return;
      if (matchFromJoin) {
        setMatchFound(matchFromJoin);
        setMsg({ type: "success", text: "Match found! Proceed to Enter below." });
      } else {
        setMsg({
          type: "success",
          text: "All 4 joined. Polling for match… If this does not resolve in a few seconds, click Reset everything and re-join.",
        });
        setInQueue(true);
      }
    } catch (e) {
      setMsg({ type: "error", text: (e as Error)?.message ?? "Game server unreachable." });
    } finally {
      setQueueLoading(false);
    }
  };

  /** Enter match as the participant in the given slot (current MetaMask must match that slot). */
  const enterMatchAs = async (slot: number) => {
    if (slot < 0 || slot > 3 || !address || !participantAddresses[slot]) return;
    if (address.toLowerCase() !== participantAddresses[slot]!.toLowerCase()) {
      setMsg({ type: "error", text: `Switch MetaMask to Player ${slot + 1} (${participantAddresses[slot]!.slice(0, 6)}…${participantAddresses[slot]!.slice(-4)}) then click Enter as P${slot + 1}.` });
      return;
    }
    await enterMatch();
  };

  const [playKey, setPlayKey] = useState(0);
  /** Clear and reset everything for a fresh start: server queue/assignments, all UI state, participants, reload addresses. */
  const resetEverything = async () => {
    setMsg(null);
    queuePollGenerationRef.current += 1;
    let queueResetOk = true;
    try {
      const res = await fetch(`${GAME_SERVER_URL}/queue/reset`, { method: "POST" });
      if (!res.ok) queueResetOk = false;
    } catch {
      queueResetOk = false;
    }
    setMatchFound(null);
    setInQueue(false);
    setMatchIdInput("");
    setMatchInfo("");
    setMatchState(null);
    setPlayerIndex(null);
    setParticipantAddressesState([null, null, null, null]);
    try {
      sessionStorage.removeItem(PARTICIPANTS_STORAGE_KEY);
    } catch {
      // ignore
    }
    setQueueTier("bronze-10");
    setPlacementInput("0,1,2,3");
    setMatchMove0("");
    setMatchMove1("");
    setMatchMove2("");
    await loadDeployed();
    refreshEscrowCheck();
    setMsg({
      type: queueResetOk ? "success" : "error",
      text: queueResetOk
        ? "Everything cleared. Start fresh from the Lobby."
        : "UI reset completed, but game server queue reset failed. Ensure game server is running on :3000, then click Reset again.",
    });
    setPlayKey((k) => k + 1);
  };

  /** Check if match already exists on-chain (so we can skip tx and show guidance). */
  const matchExistsOnChain = async (matchIdBytes32: string): Promise<boolean> => {
    if (!provider || !deployed?.escrow) return false;
    try {
      const escrow = new Contract(deployed.escrow, ESCROW_ABI, provider);
      const m = await escrow.matches(matchIdBytes32);
      const row = m as unknown as Record<string, unknown> & Array<unknown>;
      const rawDeadline = row.entryDeadline ?? row[7] ?? row[8] ?? row[11] ?? 0n;
      const deadline =
        typeof rawDeadline === "bigint"
          ? Number(rawDeadline)
          : typeof rawDeadline === "number"
          ? rawDeadline
          : Number(rawDeadline ?? 0);
      return Number.isFinite(deadline) && deadline > 0;
    } catch {
      return false;
    }
  };

  const createMatchWithId = async (matchIdHex: string) => {
    setMsg(null);
    let effectiveProvider = provider;
    let effectiveAddress = address;
    if (!effectiveProvider || !effectiveAddress) {
      const refreshed = await refreshAccount();
      effectiveProvider = refreshed.provider ?? effectiveProvider;
      effectiveAddress = refreshed.address ?? effectiveAddress;
    }
    if (!effectiveProvider || !effectiveAddress) {
      setMsg({
        type: "error",
        text: "Wallet not detected. Use Connect wallet in the header, or switch to the escrow owner in MetaMask and try again.",
      });
      return;
    }
    if (!deployed) {
      setMsg({ type: "error", text: "Contract addresses not loaded. Click Reload addresses or refresh the page." });
      return;
    }
    const matchIdBytes32 = zeroPadValue(resolveMatchId(matchIdHex), 32);
    setTxPending(true);
    try {
      const exists = await matchExistsOnChain(matchIdBytes32);
      if (exists) {
        setEscrowHasCode(true);
        contractConfirmedRef.current = true;
        setMsg({ type: "success", text: "Match already exists on-chain. Click Refresh above to see status, then have each player use Enter match." });
        fetchMatch().catch(() => {});
        return;
      }
      const signer = await effectiveProvider.getSigner();
      const escrow = new Contract(deployed.escrow, ESCROW_ABI, signer);
      const tx = await escrow.createMatch(matchIdBytes32, deployed.entryAmount);
      const receipt = await tx.wait();
      const hash = receipt?.hash ?? tx.hash;
      setMsg({ type: "success", text: hash ? `Match created on-chain. Tx: ${String(hash).slice(0, 18)}…` : "Match created." });
      setEscrowHasCode(true);
      contractConfirmedRef.current = true;
      setMatchInfo("Match created. Refreshing…");
      fetchMatch().catch(() => {});
      setTimeout(() => fetchMatch(), 2000);
      setTimeout(() => fetchMatch(), 4000);
      setTimeout(() => fetchMatch(), 6000);
    } catch (e) {
      setMsg({ type: "error", text: decodeRevertReason(e) });
    } finally {
      setTxPending(false);
    }
  };

  const enterMatch = async () => {
    if (!provider || !address || !deployed) return;
    setMsg(null);
    setTxPending(true);
    try {
      const signer = await provider.getSigner();
      const usdc = new Contract(deployed.usdc, ERC20_ABI, signer);
      const escrow = new Contract(deployed.escrow, ESCROW_ABI, signer);
      const mid = zeroPadValue(resolveMatchId(matchIdInput), 32);
      const amount = BigInt(deployed.entryAmount);
      const txApprove = await usdc.approve(deployed.escrow, amount);
      await txApprove.wait();
      const txEntry = await escrow.submitEntry(mid, amount);
      const receipt = await txEntry.wait();
      const hash = receipt?.hash ?? txEntry.hash;
      setMsg({ type: "success", text: hash ? `Entry submitted. Tx: ${String(hash).slice(0, 18)}…` : "Entry submitted." });
      contractConfirmedRef.current = true;
      refreshBalance();
    } catch (e) {
      setMsg({ type: "error", text: decodeRevertReason(e) });
    } finally {
      setTxPending(false);
    }
  };

  /** Pass matchId and escrowAddress from caller (Play) so we always use the values the UI shows. */
  const fetchMatch = async (overrides?: { matchId?: string; escrowAddress?: string }) => {
    const trimmed = overrides?.matchId ?? matchIdInput.trim();
    if (!trimmed) return;
    const escrowAddr = (overrides?.escrowAddress ?? deployed?.escrow ?? "").trim().toLowerCase();
    setMsg(null);
    setFetchMatchLoading(true);
    const mid = resolveMatchId(trimmed);
    const midNorm = normalizeMatchIdHex(trimmed);

    // When wallet is connected: read from chain using same bytes32 as createMatch.
    if (provider && escrowAddr) {
      const delays = [0, 1000, 2500];
      for (const delay of delays) {
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        const fromChain = await fetchMatchFromChain(provider, escrowAddr, mid);
        if (fromChain) {
          setMatchInfo(fromChain);
          setFetchMatchLoading(false);
          return;
        }
      }
      // For Localhost: try reading from 8545 directly (works even if MetaMask is on wrong network).
      if (deployed?.chainId === 31337) {
        try {
          const localProvider = new JsonRpcProvider("http://127.0.0.1:8545");
          const fromLocal = await fetchMatchFromChain(localProvider, escrowAddr, mid);
          if (fromLocal) {
            setMatchInfo(fromLocal + " (read from Localhost 8545)");
            setFetchMatchLoading(false);
            return;
          }
        } catch {
          // ignore
        }
      }
      // Fallback through game server RPC to avoid false wallet-network hints.
      try {
        const escrowParam = `&escrowAddress=${encodeURIComponent(escrowAddr)}`;
        const res = await fetch(
          `${GAME_SERVER_URL}/match/status?matchId=${encodeURIComponent(mid)}${escrowParam}`
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.statusName != null) {
          setMatchInfo(
            `Status: ${data.statusName} | Entries: ${data.entriesReceived ?? 0}/4 | Pool: ${data.poolAmount ?? "0"} USDC (read via game server RPC)`
          );
          setFetchMatchLoading(false);
          return;
        }
      } catch {
        // ignore and show guidance below
      }

      const isQueuedUncreatedMatch =
        !!matchFound && matchFound.matchId.toLowerCase() === trimmed.toLowerCase();
      if (isQueuedUncreatedMatch) {
        setMatchInfo("Match ID is from queue but not created on-chain yet. Switch MetaMask to escrow owner and click Create match on-chain.");
        setFetchMatchLoading(false);
        return;
      }

      let walletChainId = chainId;
      if (walletChainId == null) {
        try {
          walletChainId = Number((await provider.getNetwork()).chainId);
        } catch {
          walletChainId = null;
        }
      }
      if (deployed?.chainId === 31337) {
        if (walletChainId != null && walletChainId !== 31337) {
          setMatchInfo("Match not found on this wallet network. Switch MetaMask to Localhost 8545 (chain 31337), then refresh.");
        } else {
          setMatchInfo("Match not found on current escrow deployment. If this ID came from queue, create it on-chain first with the escrow owner. If you already created it, reload addresses and reset queue to clear stale deployment data.");
        }
      } else {
        setMatchInfo("Match not found on chain. Ensure your wallet is on the same network and escrow deployment as this app.");
      }
      setFetchMatchLoading(false);
      return;
    }

    // No wallet: fallback to game server (e.g. before connect).
    try {
      const escrowParam = escrowAddr ? `&escrowAddress=${encodeURIComponent(escrowAddr)}` : "";
      const res = await fetch(`${GAME_SERVER_URL}/match/status?matchId=${encodeURIComponent(midNorm)}${escrowParam}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.statusName != null) {
        setMatchInfo(
          `Status: ${data.statusName} | Entries: ${data.entriesReceived ?? 0}/4 | Pool: ${data.poolAmount ?? "0"} USDC`
        );
        setFetchMatchLoading(false);
        return;
      }
      if (res.status === 404) {
        setMatchInfo("No match at this seed. Connect your wallet and create a match, or ensure the game server RPC matches your network.");
      } else if (res.status === 503) {
        setMatchInfo("Game server has no escrow. Run deploy:localhost and ensure dev:all or game-server is running.");
      } else {
        setMatchInfo(data.error ?? "Could not load match status.");
      }
    } catch {
      setMatchInfo("Could not reach game server. Start it with: npm run game-server (or npm run dev:all).");
    } finally {
      setFetchMatchLoading(false);
    }
  };

  const submitResult = async () => {
    if (!provider || !address || !deployed) return;
    setMsg(null);
    setTxPending(true);
    try {
      const mid = zeroPadValue(resolveMatchId(matchIdInput), 32);
      const placement = placementInput.split(",").map((s) => parseInt(s.trim(), 10)) as [number, number, number, number];
      if (placement.length !== 4 || placement.some((p) => p < 0 || p > 3)) {
        throw new Error("Placement must be four numbers 0–3 (e.g. 0,1,2,3)");
      }
      let res: Response;
      try {
        res = await fetch(SIGNER_URL + "/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId: mid, placement }),
        });
      } catch (fetchErr) {
        throw new Error("Signer unreachable. Is the signer running? Run: cd arena-race && npm run signer");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.signature) throw new Error(data.error || "Signer failed or returned no signature.");
      const signer = await provider.getSigner();
      const escrow = new Contract(deployed.escrow, ESCROW_ABI, signer);
      const tx = await escrow.submitResultWithPlacement(mid, placement, data.signature);
      const receipt = await tx.wait();
      const hash = receipt?.hash ?? tx.hash;
      setMsg({ type: "success", text: hash ? `Result submitted. Payouts sent. Tx: ${String(hash).slice(0, 18)}…` : "Result submitted. Payouts sent." });
      refreshBalance();
    } catch (e) {
      setMsg({ type: "error", text: decodeRevertReason(e) });
    } finally {
      setTxPending(false);
    }
  };

  // Auth: no route gate; unconnected users see connect prompts per GAME_PLATFORM_UI_EXECUTION_PLAN P2.4 Option A.

  const playProps: PlayPageProps = {
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
    setPlayerIndex,
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
    resolveTurnNow,
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
  };

  return (
    <BrowserRouter>
      <Layout resetEverything={resetEverything}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/play" element={<Play key={playKey} {...playProps} />} />
            <Route path="/simulator" element={<GameSimulator />} />
            <Route path="/sandbox" element={<GameSimulator />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/account" element={<Account />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </BrowserRouter>
  );
}
