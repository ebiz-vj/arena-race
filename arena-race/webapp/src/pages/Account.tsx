import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

const TITLE = "Account – Arena Race";

const DISPLAY_NAME_KEY_PREFIX = "arena_displayname_";

function getDisplayNameKey(address: string): string {
  return `${DISPLAY_NAME_KEY_PREFIX}${address.toLowerCase()}`;
}

function getNetworkName(chainId: number): string {
  if (chainId === 31337) return "Localhost 8545";
  if (chainId === 1) return "Ethereum Mainnet";
  if (chainId === 137) return "Polygon";
  return `Chain ${chainId}`;
}

export default function Account() {
  const {
    address,
    chainId,
    usdcBalance,
    connectWallet,
    connectLoading,
  } = useWallet();
  const [displayName, setDisplayName] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    document.title = TITLE;
    return () => {
      document.title = "Arena Race";
    };
  }, []);

  useEffect(() => {
    if (!address) return;
    try {
      const key = getDisplayNameKey(address);
      const stored = localStorage.getItem(key);
      setDisplayName(stored ?? "");
    } catch {
      setDisplayName("");
    }
  }, [address]);

  const saveDisplayName = () => {
    if (!address) return;
    try {
      const key = getDisplayNameKey(address);
      if (displayName.trim()) {
        localStorage.setItem(key, displayName.trim());
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  };

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!address) {
    return (
      <>
        <section className="dashboard-hero">
          <h1>Account</h1>
          <p className="subtitle">Your profile and wallet info</p>
        </section>
        <div className="card" style={{ maxWidth: 420, margin: "0 auto", textAlign: "center" }}>
          <p>Connect your wallet to see your account.</p>
          <button onClick={connectWallet} disabled={connectLoading}>
            {connectLoading ? "Connecting…" : "Connect wallet"}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <section className="dashboard-hero">
        <h1>Account</h1>
        <p className="subtitle">
          <Link to="/" style={{ color: "var(--accent)" }}>Dashboard</Link>
          {" · "}
          <Link to="/play" style={{ color: "var(--accent)" }}>Play</Link>
        </p>
      </section>

      <div className="card">
        <h2>👛 Wallet</h2>
        <p>
          <span style={{ wordBreak: "break-all", fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>
            {address}
          </span>
          <button type="button" onClick={copyAddress} style={{ marginLeft: "var(--space-sm)" }}>
            {copySuccess ? "Copied!" : "Copy"}
          </button>
        </p>
      </div>

      <div className="card">
        <h2>🌐 Network</h2>
        <p>
          {chainId != null
            ? `${getNetworkName(chainId)} (${chainId})`
            : "—"}
        </p>
      </div>

      <div className="card">
        <h2>💰 USDC balance</h2>
        <p><strong>{usdcBalance}</strong> USDC</p>
      </div>

      <div className="card">
        <h2>✏️ Display name</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Stored locally per wallet. No backend.
        </p>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onBlur={saveDisplayName}
          placeholder="Your display name"
          style={{ maxWidth: "20rem" }}
        />
        <button type="button" onClick={saveDisplayName}>
          Save
        </button>
      </div>
    </>
  );
}
