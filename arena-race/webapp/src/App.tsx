import { useState, useEffect } from "react";
import { BrowserProvider, Contract, formatUnits, getBytes, keccak256, toBeHex } from "ethers";
import { ESCROW_ABI, ERC20_ABI } from "./abis";

const STATUS_NAMES: Record<number, string> = {
  0: "PendingEntries",
  1: "Escrowed",
  2: "Expired",
  3: "Refunded",
  4: "Resolved",
};

const SIGNER_URL = "http://localhost:3344";

// Contract custom error selectors (first 4 bytes of keccak256("ErrorName(...)"))
const ESCROW_ERRORS: Record<string, string> = {
  "0xfc2bc70d": "Match already exists. Do NOT click Create match again. To add another player: switch account in MetaMask (address above should change), then click Enter match below.",
  "0x118cdaa7": "Only the contract owner can create matches. With this account, use Enter match to join a match (do not use Create match).",
  "0x3c3544ed": "Invalid match id (zero).",
  "0x2c5211c6": "Invalid amount (e.g. zero).",
  "0x83b9f0c6": "Not the contract owner.",
  "0x2d5a3b7a": "Contract is paused.",
  "0x8baa579f": "Invalid signature. Start the signer (npm run signer in arena-race) and ensure it uses the deployer key (first Hardhat account). Then try Submit result again.",
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
  // No contract at address (RPC returns 0x -> ethers throws BAD_DATA)
  if (err?.code === "BAD_DATA" && (err?.value === "0x" || (err?.message && err.message.includes("could not decode result data")))) {
    return "No contract at this escrow address. The node was likely restarted — run deploy:localhost once (with the node running), then refresh this page.";
  }
  // JSON-RPC parse error: node returned empty/invalid response (e.g. node restarted or overloaded)
  const errMsg = [err?.message, err?.reason, (err as { error?: { message?: string } })?.error?.message].filter(Boolean).join(" ");
  if (errMsg.includes("Parse error") || errMsg.includes("Unexpected end of JSON input") || errMsg.includes("JSON input")) {
    return "RPC returned an invalid response. Make sure the Hardhat node is running (npm run node:localhost) and try again. If the node restarted, run deploy:localhost then refresh.";
  }
  const msg = err?.reason ?? err?.message;
  if (msg && typeof msg === "string") return msg;
  return "Transaction failed";
}

type Deployed = { chainId: number; usdc: string; escrow: string; entryAmount: string };

export default function App() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [deployed, setDeployed] = useState<Deployed | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string>("—");
  const [matchIdInput, setMatchIdInput] = useState("1");
  const [placementInput, setPlacementInput] = useState("0,1,2,3");
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [matchInfo, setMatchInfo] = useState<string>("");
  const [txPending, setTxPending] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [escrowHasCode, setEscrowHasCode] = useState<boolean | null>(null);
  const [signerMatchesContract, setSignerMatchesContract] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/deployed-local.json")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setDeployed(d))
      .catch(() => setDeployed(null));
  }, []);

  // When user switches account in MetaMask, update our state and clear any stale message
  useEffect(() => {
    const ethereum = (window as unknown as {
      ethereum?: { on: (e: string, h: (accounts: string[]) => void) => void; removeListener?: (e: string, h: (accounts: string[]) => void) => void };
    }).ethereum;
    if (!ethereum?.on) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setAddress(accounts[0]);
      } else {
        setAddress(null);
        setProvider(null);
      }
      setMsg(null);
    };
    ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      if (ethereum.removeListener) ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  // Clear stale error/success when address changes (e.g. after accountsChanged)
  useEffect(() => {
    setMsg(null);
  }, [address]);

  useEffect(() => {
    if (!provider || !address || !deployed) return;
    const usdc = new Contract(deployed.usdc, ERC20_ABI, provider);
    usdc.balanceOf(address).then((b: bigint) => setUsdcBalance(formatUnits(b, 6))).catch(() => setUsdcBalance("—"));
  }, [provider, address, deployed]);

  useEffect(() => {
    if (!provider) return;
    provider.getNetwork().then((n) => setChainId(Number(n.chainId))).catch(() => setChainId(null));
  }, [provider]);

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

  const connect = async () => {
    setMsg(null);
    const ethereum = (window as unknown as { ethereum?: unknown }).ethereum;
    if (!ethereum) {
      setMsg({
        type: "error",
        text: "No wallet found. Install MetaMask (or another Web3 wallet), refresh the page, then try again.",
      });
      return;
    }
    try {
      const p = new BrowserProvider(ethereum);
      const accounts = await p.send("eth_requestAccounts", []);
      if (!accounts?.length) throw new Error("No account");
      setAddress(accounts[0]);
      setProvider(p);
      const net = await p.getNetwork();
      const chId = Number(net.chainId);
      setChainId(chId);
      if (deployed && chId !== deployed.chainId) {
        setMsg({ type: "error", text: `Wrong network. Switch to Localhost 8545 (chain id ${deployed.chainId}). You are on chain ${chId}.` });
      }
    } catch (e) {
      setMsg({ type: "error", text: decodeRevertReason(e) });
    }
  };

  // Sync with wallet after you switch account in MetaMask. Call the wallet directly so we get the selected account.
  const refreshAccount = async () => {
    const win = window as unknown as {
      ethereum?: {
        request: (args: { method: string }) => Promise<string[]>;
        selectedAddress?: string | null;
      };
    };
    const ethereum = win.ethereum;
    if (!ethereum?.request) return;
    setMsg(null);
    try {
      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      if (accounts?.length > 0) {
        // MetaMask and some wallets expose selectedAddress (the account shown in the UI); prefer it if present
        const selected = ethereum.selectedAddress?.toLowerCase();
        const newAddress =
          selected && accounts.some((a) => a.toLowerCase() === selected)
            ? accounts.find((a) => a.toLowerCase() === selected)!
            : accounts[0];
        setAddress(newAddress);
        setProvider(new BrowserProvider(ethereum as import("ethers").Eip1193Provider));
        setMsg({ type: "success", text: `Switched to ${newAddress.slice(0, 8)}…${newAddress.slice(-6)}` });
      } else {
        setAddress(null);
        setProvider(null);
      }
    } catch (e) {
      setMsg({ type: "error", text: (e as Error)?.message ?? "Could not refresh account" });
    }
  };

  const matchIdToBytes32 = (id: string): string => {
    const n = BigInt(id || "0");
    return keccak256(getBytes(toBeHex(n)));
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
      await tx.wait();
      setMsg({ type: "success", text: `Match created. ID (bytes32): ${mid.slice(0, 18)}...` });
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
      const mid = matchIdToBytes32(matchIdInput);
      const amount = BigInt(deployed.entryAmount);
      const txApprove = await usdc.approve(deployed.escrow, amount);
      await txApprove.wait();
      const txEntry = await escrow.submitEntry(mid, amount);
      await txEntry.wait();
      setMsg({ type: "success", text: "Entry submitted." });
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
    try {
      const escrow = new Contract(deployed.escrow, ESCROW_ABI, provider);
      const mid = matchIdToBytes32(matchIdInput);
      const m = await escrow.matches(mid);
      if (m.entryDeadline === 0n || (typeof m.entryDeadline === "number" && m.entryDeadline === 0)) {
        setMatchInfo("No match at this seed on this contract. Create a match first, or ensure you're on Localhost 8545 and have not run deploy:localhost again (that overwrites addresses and the new contracts have no matches).");
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
        : (err.reason ?? err.message ?? String(e));
      const hint = chainId !== deployed.chainId
        ? " Switch MetaMask to Localhost 8545 (chain id 31337)."
        : "";
      setMatchInfo(`${friendly}${hint}`);
    }
  };

  const submitResult = async () => {
    if (!provider || !address || !deployed) return;
    setMsg(null);
    setTxPending(true);
    try {
      const mid = matchIdToBytes32(matchIdInput);
      const placement = placementInput.split(",").map((s) => parseInt(s.trim(), 10)) as [number, number, number, number];
      if (placement.length !== 4 || placement.some((p) => p < 0 || p > 3)) {
        throw new Error("Placement must be four numbers 0–3 (e.g. 0,1,2,3)");
      }
      const res = await fetch(SIGNER_URL + "/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: mid, placement }),
      });
      const data = await res.json();
      if (!res.ok || !data.signature) throw new Error(data.error || "Signer failed");
      const signer = await provider.getSigner();
      const escrow = new Contract(deployed.escrow, ESCROW_ABI, signer);
      const tx = await escrow.submitResultWithPlacement(mid, placement, data.signature);
      await tx.wait();
      setMsg({ type: "success", text: "Result submitted. Payouts sent." });
    } catch (e) {
      setMsg({ type: "error", text: decodeRevertReason(e) });
    } finally {
      setTxPending(false);
    }
  };

  return (
    <div>
      <h1>Arena Race — Local</h1>
      <p>Connect to Localhost 8545 and use the deployed escrow to create matches, enter, and resolve.</p>

      {!deployed && (
        <div className="card">
          <p>Load deployed addresses: run <code>npm run deploy:localhost</code> (after starting the node).</p>
        </div>
      )}

      <div className="card">
        <h2>Wallet</h2>
        {!address ? (
          <button onClick={connect}>Connect wallet</button>
        ) : (
          <>
            <p>{address.slice(0, 10)}…{address.slice(-8)}</p>
            {chainId != null && (
              <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                Network: chain id <strong>{chainId}</strong>
                {deployed && chainId !== deployed.chainId && (
                  <span style={{ color: "#f87171" }}> — switch to Localhost 8545 (31337)</span>
                )}
              </p>
            )}
            <p>USDC balance: <strong>{usdcBalance}</strong> USDC</p>
            <p style={{ fontSize: "0.8rem", color: "#64748b" }}>Escrow: {deployed?.escrow?.slice(0, 10)}…{deployed?.escrow?.slice(-8)}</p>
            <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.25rem" }}>MetaMask often does not update custom token balances on Localhost. The balance above is read from the chain and is correct; use this page after switching accounts to see payouts.</p>
            <p style={{ marginTop: "0.5rem", color: "#94a3b8", fontSize: "0.85rem" }}>
              Switched account in MetaMask? Click <strong>Refresh account</strong> so this page uses the new one.
            </p>
            <button onClick={refreshAccount} type="button">Refresh account</button>
          </>
        )}
        {msg && (
          <div className={msg.type}>
            {msg.text}
            <button type="button" onClick={() => setMsg(null)} style={{ marginLeft: "0.5rem", fontSize: "0.8rem", padding: "0.2rem 0.5rem" }} aria-label="Dismiss">
              Dismiss
            </button>
          </div>
        )}
      </div>

      {deployed && escrowHasCode === false && (
        <div className="card" style={{ borderColor: "#f87171", background: "rgba(248,113,113,0.1)" }}>
          <h2>No contract at escrow address</h2>
          <p>This usually means the node was restarted. With the node running, run <code>npm run deploy:localhost</code> in <code>arena-race</code>, then refresh this page.</p>
        </div>
      )}

      {deployed && address && (
        <>
          <div className="card">
            <h2>Match ID (numeric seed)</h2>
            <label>Seed</label>
            <input value={matchIdInput} onChange={(e) => setMatchIdInput(e.target.value)} placeholder="1" />
            <button onClick={fetchMatch}>Fetch match</button>
            {matchInfo && <p className="status">{matchInfo}</p>}
          </div>

          <div className="card">
            <h2>Create match (owner only)</h2>
            <p>Entry: {formatUnits(deployed.entryAmount, 6)} USDC per player. Only click once per match — if you see &quot;Match already exists&quot;, use Enter match with other accounts instead.</p>
            <button onClick={createMatch} disabled={txPending}>Create match</button>
          </div>

          <div className="card">
            <h2>Enter match</h2>
            <p>Approve USDC and submit entry for the <strong>current</strong> account (the one shown in Wallet above).</p>
            <p style={{ marginTop: "0.5rem", color: "#94a3b8" }}>Adding another player? Switch to that account in MetaMask — the address above should update — then click Enter match.</p>
            <button onClick={enterMatch} disabled={txPending}>Enter match</button>
          </div>

          <div className="card">
            <h2>Submit result (signer only)</h2>
            <p>Placement: 1st, 2nd, 3rd, 4th as player indices (e.g. 0,1,2,3). <strong>Run the signer in a terminal</strong>: <code>cd arena-race && npm run signer</code> — otherwise you'll get &quot;Invalid signature&quot;.</p>
            {signerMatchesContract === false && (
              <p style={{ color: "#f87171", marginBottom: "0.5rem" }}>
                Signer address does not match the contract&apos;s result signer. For localhost, run the signer <strong>without</strong> a .env that overrides DEPLOYER_PRIVATE_KEY, or set DEPLOYER_PRIVATE_KEY to the first Hardhat account key (see terminal when you run npm run node:localhost).
              </p>
            )}
            <input value={placementInput} onChange={(e) => setPlacementInput(e.target.value)} placeholder="0,1,2,3" />
            <button onClick={submitResult} disabled={txPending}>Submit result</button>
          </div>
        </>
      )}
    </div>
  );
}
