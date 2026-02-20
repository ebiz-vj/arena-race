import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

// Payouts: empty state (no backend). Option A (chain events) can be added when escrow event reading is available.

export default function Rewards() {
  const { address, connectWallet, connectLoading } = useWallet();

  useEffect(() => {
    document.title = "Rewards – Arena Race";
    return () => {
      document.title = "Arena Race";
    };
  }, []);

  return (
    <>
      <section className="dashboard-hero">
        <h1>Rewards</h1>
        <p className="subtitle">Payouts, leaderboard & achievements</p>
      </section>

      <section className="rewards-section" aria-labelledby="rewards-payouts">
        <h2 id="rewards-payouts">💰 Payouts</h2>
        <div className="card">
          {!address ? (
            <>
              <p>Connect wallet to see payouts.</p>
              <button onClick={connectWallet} disabled={connectLoading}>
                {connectLoading ? "Connecting…" : "Connect wallet"}
              </button>
            </>
          ) : (
            <>
              <p style={{ color: "var(--text-muted)" }}>
                Payout history will appear here after you complete matches.
              </p>
              <Link to="/play" className="button-as-link" style={{ marginTop: "var(--space-sm)" }}>
                Go to Play
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="rewards-section" aria-labelledby="rewards-leaderboard">
        <h2 id="rewards-leaderboard">🏆 Leaderboard</h2>
        <div className="card">
          <p style={{ color: "var(--text-muted)" }}>Coming soon.</p>
          <table style={{ fontSize: "0.9rem", marginTop: "var(--space-md)", opacity: 0.8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", paddingRight: "var(--space-lg)" }}>Rank</th>
                <th style={{ textAlign: "left", paddingRight: "var(--space-lg)" }}>Wallet</th>
                <th style={{ textAlign: "left" }}>Wins</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>0x1234…abcd</td><td>12</td></tr>
              <tr><td>2</td><td>0x5678…ef01</td><td>10</td></tr>
              <tr><td>3</td><td>0x9abc…2345</td><td>8</td></tr>
            </tbody>
          </table>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "var(--space-sm)" }}>Mock data</p>
        </div>
      </section>

      <section className="rewards-section" aria-labelledby="rewards-achievements">
        <h2 id="rewards-achievements">🎯 Achievements</h2>
        <div className="card achievements-grid">
          <div className="achievement-card">
            <span className="achievement-icon" aria-hidden>🏆</span>
            <strong>First Win</strong>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Win your first match</span>
          </div>
          <div className="achievement-card">
            <span className="achievement-icon" aria-hidden>🎮</span>
            <strong>10 Matches</strong>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Play 10 matches</span>
          </div>
          <div className="achievement-card">
            <span className="achievement-icon" aria-hidden>🥉</span>
            <strong>Bronze Tier</strong>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Reach Bronze tier</span>
          </div>
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "var(--space-sm)" }}>Coming soon.</p>
      </section>
    </>
  );
}
