import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

const DISPLAY_NAME_KEY_PREFIX = "arena_displayname_";

function getDisplayName(address: string): string {
  try {
    const key = `${DISPLAY_NAME_KEY_PREFIX}${address.toLowerCase()}`;
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function Dashboard() {
  const { address, usdcBalance, connectWallet, connectLoading } = useWallet();

  useEffect(() => {
    document.title = "Dashboard – Arena Race";
    return () => {
      document.title = "Arena Race";
    };
  }, []);
  const displayName = address ? getDisplayName(address) : "";
  const welcomeName = displayName.trim() || (address ? shortenAddress(address) : null);

  return (
    <>
      <section className="dashboard-hero">
        <h1>Arena Race</h1>
        <p className="subtitle">
          {welcomeName
            ? `Welcome back, ${welcomeName}. Ready to race?`
            : "Skill-based racing. Connect your wallet to enter the arena."}
        </p>
      </section>

      {!address ? (
        <div className="card" style={{ maxWidth: 420, margin: "0 auto", textAlign: "center" }}>
          <h2>Connect wallet</h2>
          <p>Connect your wallet to see your stats and join matches.</p>
          <button onClick={connectWallet} disabled={connectLoading} style={{ marginTop: "var(--space-md)" }}>
            {connectLoading ? "Connecting…" : "Connect wallet"}
          </button>
        </div>
      ) : (
        <>
          <section className="dashboard-stats" aria-label="Stats">
            <div className="card stat-card">
              <span className="stat-icon" aria-hidden>💰</span>
              <h2>USDC balance</h2>
              <span className="stat-value">{usdcBalance} USDC</span>
            </div>
            <div className="card stat-card">
              <span className="stat-icon" aria-hidden>🎮</span>
              <h2>Matches played</h2>
              <span className="stat-value">—</span>
              <p style={{ fontSize: "0.8rem", marginTop: "var(--space-xs)" }}>Play to see stats</p>
            </div>
            <div className="card stat-card">
              <span className="stat-icon" aria-hidden>🏆</span>
              <h2>Wins / Top-2</h2>
              <span className="stat-value">—</span>
            </div>
            <div className="card stat-card">
              <span className="stat-icon" aria-hidden>🥉</span>
              <h2>Current tier</h2>
              <span className="stat-value">Bronze</span>
            </div>
          </section>

          <section className="dashboard-activity" aria-label="Recent activity">
            <h2>Recent activity</h2>
            <div className="card">
              <p style={{ color: "var(--text-muted)" }}>No recent matches.</p>
              <Link to="/play" className="button-as-link" style={{ marginTop: "var(--space-sm)" }}>
                Go to Play
              </Link>
            </div>
          </section>

          <section className="dashboard-actions" aria-label="Quick actions">
            <h2>Quick actions</h2>
            <div className="quick-actions">
              <Link to="/play" className="quick-action-card">
                ▶ Find a match
              </Link>
              <Link to="/rewards" className="quick-action-card">
                🎁 Rewards
              </Link>
              <Link to="/wallet" className="quick-action-card">
                💳 Wallet
              </Link>
            </div>
          </section>
        </>
      )}
    </>
  );
}
