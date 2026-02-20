import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Contract, formatUnits } from "ethers";
import { ESCROW_ABI, ERC20_ABI } from "./abis";
import { useWallet } from "./context/WalletContext";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import Play from "./pages/Play";
import Rewards from "./pages/Rewards";
import Wallet from "./pages/Wallet";
import Account from "./pages/Account";
import {
  decodeRevertReason,
  matchIdToBytes32,
  resolveMatchId,
  STATUS_NAMES,
  SIGNER_URL,
  GAME_SERVER_URL,
} from "./pages/Play";
import type { PlayPageProps, MatchState } from "./pages/Play";

export default function App() {
  const { provider, address, deployed, chainId, usdcBalance, refreshBalance } = useWallet();
  const [matchIdInput, setMatchIdInput] = useState("1");
  const [placementInput, setPlacementInput] = useState("0,1,2,3");
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [matchInfo, setMatchInfo] = useState<string>("");
  const [txPending, setTxPending] = useState(false);
  const [escrowHasCode, setEscrowHasCode] = useState<boolean | null>(null);
  const [signerMatchesContract, setSignerMatchesContract] = useState<boolean | null>(null);
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

  useEffect(() => {
    setMsg(null);
  }, [address]);

  useEffect(() => {
    if (!provider || !deployed?.escrow) return;
    provider.getCode(deployed.escrow).then((code) => {
      setEscrowHasCode(code !== "0x" && code.length > 4);
    }).catch(() => setEscrowHasCode(null));
  }, [provider, deployed?.escrow]);

  useEffect(() => {
    if (!provider || !deployed?.escrow) return;
    const escrow = new Contract(deployed.escrow, ESCROW_ABI, provider);
    Promise.all([
      fetch(SIGNER_URL + "/whoami").then((r) => r.ok ? r.json() : null).catch(() => null),
      escrow.resultSigner().catch(() => null),
    ]).then(([who, contractSigner]) => {
      if (who?.address && contractSigner) {
        setSignerMatchesContract(who.address.toLowerCase() === String(contractSigner).toLowerCase());
      } else {
        setSignerMatchesContract(null);
      }
    }).catch(() => setSignerMatchesContract(null));
  }, [provider, deployed?.escrow]);

  // Poll queue status only when in queue. When match_found, update matchFound.
  // Do NOT clear matchFound when status is idle (e.g. after switching to another
  // MetaMask account) so local testing with 4 accounts keeps the same match visible.
  useEffect(() => {
    if (!address || !inQueue) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`${GAME_SERVER_URL}/queue/status?wallet=${encodeURIComponent(address)}`);
        const data = await res.json();
        if (data.status === "match_found" && data.matchId) {
          setMatchFound({ matchId: data.matchId, entry_deadline: data.entry_deadline });
          setInQueue(false);
        }
        // Never set matchFound to null from polling — only leaveQueue() or Play again clears it
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(t);
  }, [address, inQueue]);

  const loadMatchState = async () => {
    if (!address || !deployed || !matchIdInput.trim()) return;
    const mid = resolveMatchId(matchIdInput);
    try {
      const [stateRes, escrow] = await Promise.all([
        fetch(`${GAME_SERVER_URL}/match/state?matchId=${encodeURIComponent(mid)}`),
        provider ? new Contract(deployed.escrow, ESCROW_ABI, provider).matches(mid) : null,
      ]);
      if (stateRes.ok) {
        const data = await stateRes.json();
        setMatchState({
          turnIndex: data.turnIndex,
          tokenPositions: data.tokenPositions,
          scores: data.scores?.map((s: { total: number }) => ({ total: s.total })) ?? [],
          turnDeadlineMs: data.turnDeadlineMs,
        });
      } else {
        setMatchState(null);
      }
      const wallets = escrow && (Array.isArray(escrow.playerWallets) ? escrow.playerWallets : (escrow as unknown[])[4]);
      if (Array.isArray(wallets)) {
        const idx = wallets.findIndex((w: string) => String(w).toLowerCase() === address.toLowerCase());
        setPlayerIndex(idx >= 0 ? idx : null);
      } else {
        setPlayerIndex(null);
      }
    } catch {
      setMatchState(null);
      setPlayerIndex(null);
    }
  };

  const startMatchThenLoad = async () => {
    if (!address || !deployed || !matchIdInput.trim()) return;
    const mid = resolveMatchId(matchIdInput);
    setMatchActionLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${GAME_SERVER_URL}/match/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: mid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = data.reason ? ` (${data.reason})` : "";
        let text = data.error ?? `Start failed (${res.status})`;
        if (data.reason === "pending_entries") {
          text += ". Ensure the game server .env has ESCROW_ADDRESS set to the same escrow as this page: " + (deployed?.escrow?.slice(0, 10) + "…") + ".";
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

  const submitMatchAction = async () => {
    if (!matchIdInput.trim() || typeof playerIndex !== "number" || matchState == null) return;
    const mid = resolveMatchId(matchIdInput);
    const m0 = parseInt(matchMove0.trim(), 10);
    const m1 = parseInt(matchMove1.trim(), 10);
    const m2 = parseInt(matchMove2.trim(), 10);
    if ([m0, m1, m2].some((n) => isNaN(n) || n < 0 || n > 48)) {
      setMsg({ type: "error", text: "Moves must be tile indices 0–48" });
      return;
    }
    setMatchActionLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${GAME_SERVER_URL}/match/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: mid, turnIndex: matchState.turnIndex, playerIndex, moves: [m0, m1, m2] }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "success", text: "Move submitted." });
        await loadMatchState();
      } else {
        setMsg({ type: "error", text: data.error ?? "Submit failed" });
      }
    } catch (e) {
      setMsg({ type: "error", text: (e as Error)?.message ?? "Submit failed" });
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

  const createMatchWithId = async (matchIdHex: string) => {
    if (!provider || !address || !deployed) return;
    setMsg(null);
    setTxPending(true);
    try {
      const signer = await provider.getSigner();
      const escrow = new Contract(deployed.escrow, ESCROW_ABI, signer);
      const tx = await escrow.createMatch(matchIdHex, deployed.entryAmount);
      const receipt = await tx.wait();
      const hash = receipt?.hash ?? tx.hash;
      setMsg({ type: "success", text: hash ? `Match created on-chain. Tx: ${String(hash).slice(0, 18)}…` : "Match created." });
    } catch (e) {
      setMsg({ type: "error", text: decodeRevertReason(e) });
    } finally {
      setTxPending(false);
    }
  };

  const createMatch = async () => {
    if (!provider || !address || !deployed) return;
    setMsg(null);
    setTxPending(true);
    try {
      const signer = await provider.getSigner();
      const escrow = new Contract(deployed.escrow, ESCROW_ABI, signer);
      const mid = matchIdToBytes32(matchIdInput);
      const tx = await escrow.createMatch(mid, deployed.entryAmount);
      const receipt = await tx.wait();
      const hash = receipt?.hash ?? tx.hash;
      setMsg({ type: "success", text: hash ? `Match created. Tx: ${String(hash).slice(0, 18)}…` : "Match created." });
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
      const mid = resolveMatchId(matchIdInput);
      const amount = BigInt(deployed.entryAmount);
      const txApprove = await usdc.approve(deployed.escrow, amount);
      await txApprove.wait();
      const txEntry = await escrow.submitEntry(mid, amount);
      const receipt = await txEntry.wait();
      const hash = receipt?.hash ?? txEntry.hash;
      setMsg({ type: "success", text: hash ? `Entry submitted. Tx: ${String(hash).slice(0, 18)}…` : "Entry submitted." });
      refreshBalance();
    } catch (e) {
      setMsg({ type: "error", text: decodeRevertReason(e) });
    } finally {
      setTxPending(false);
    }
  };

  const fetchMatch = async () => {
    if (!provider || !deployed) return;
    setMsg(null);
    setMatchInfo("");
    setFetchMatchLoading(true);
    try {
      const escrow = new Contract(deployed.escrow, ESCROW_ABI, provider);
      const mid = resolveMatchId(matchIdInput);
      const m = await escrow.matches(mid);
      if (m.entryDeadline === 0n || (typeof m.entryDeadline === "number" && m.entryDeadline === 0)) {
        setMatchInfo("No match at this seed. Create a match first or ensure you're on Localhost 8545 and haven't run deploy:localhost again.");
        return;
      }
      const status = STATUS_NAMES[Number(m.status)] ?? "?";
      setMatchInfo(
        `Status: ${status} | Entries: ${m.entriesReceived}/4 | Pool: ${formatUnits(m.poolAmount, 6)} USDC`
      );
    } catch (e) {
      const err = e as Error & { code?: string; value?: string; reason?: string };
      const friendly = err.code === "BAD_DATA" && (err.value === "0x" || (err.message && String(err.message).includes("could not decode result data")))
        ? "No contract at this escrow address. Run deploy:localhost once (with the node running), then refresh this page."
        : decodeRevertReason(e);
      const hint = chainId !== deployed.chainId ? " Switch MetaMask to Localhost 8545 (31337)." : "";
      setMatchInfo(`${friendly}${hint}`);
    } finally {
      setFetchMatchLoading(false);
    }
  };

  const submitResult = async () => {
    if (!provider || !address || !deployed) return;
    setMsg(null);
    setTxPending(true);
    try {
      const mid = resolveMatchId(matchIdInput);
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
    createMatchWithId,
    createMatch,
    enterMatch,
    fetchMatch,
    submitResult,
  };

  return (
    <BrowserRouter>
      <Layout>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/play" element={<Play {...playProps} />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/account" element={<Account />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </BrowserRouter>
  );
}
