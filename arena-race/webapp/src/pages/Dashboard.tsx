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
      <h1>Dashboard</h1>
      <p>
        {welcomeName
          ? `Welcome back, ${welcomeName}.`
          : "Welcome to Arena Race."}
      </p>

      {!address ? (
        <div className="card">
          <h2>Connect your wallet</h2>
          <p>Connect your wallet to see your stats and play matches.</p>
          <button onClick={connectWallet} disabled={connectLoading}>
            {connectLoading ? "Connecting…" : "Connect wallet"}
          </button>
        </div>
      ) : (
        <>
          <section className="dashboard-stats" aria-label="Stats">
            <div className="card stat-card">
              <h2>USDC balance</h2>
              <p className="stat-value">{usdcBalance} USDC</p>
            </div>
            <div className="card stat-card">
              <h2>Matches played</h2>
              <p className="stat-value">—</p>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Play matches to see stats
              </p>
            </div>
            <div className="card stat-card">
              <h2>Wins / Top-2</h2>
              <p className="stat-value">—</p>
            </div>
            <div className="card stat-card">
              <h2>Current tier</h2>
              <p className="stat-value">Bronze</p>
            </div>
          </section>

          <section className="dashboard-activity" aria-label="Recent activity">
            <h2>Recent activity</h2>
            <div className="card">
              <p style={{ color: "var(--text-muted)" }}>No recent matches.</p>
              <Link to="/play">Go to Play</Link>
            </div>
          </section>

          <section className="dashboard-actions" aria-label="Quick actions">
            <h2>Quick actions</h2>
            <div className="quick-actions">
              <Link to="/play" className="card quick-action-card">
                Find a match (Play)
              </Link>
              <Link to="/rewards" className="card quick-action-card">
                View rewards
              </Link>
              <Link to="/wallet" className="card quick-action-card">
                Wallet
              </Link>
            </div>
          </section>
        </>
      )}
    </>
  );
}
