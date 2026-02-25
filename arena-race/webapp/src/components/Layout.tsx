import { Link, NavLink, useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import "./Layout.css";

type LayoutProps = {
  children: React.ReactNode;
  /** Reload addresses and clear match/queue; navigates to Play lobby. May be async. */
  resetEverything?: () => void | Promise<void>;
};

export default function Layout({ children, resetEverything }: LayoutProps) {
  const {
    address,
    usdcBalance,
    connectWallet,
    disconnectWallet,
    connectLoading,
    errorMessage,
    setErrorMessage,
  } = useWallet();
  const navigate = useNavigate();

  const walletSlot = !address ? (
    <div className="layout-wallet-slot">
      <button
        onClick={connectWallet}
        disabled={connectLoading}
        className="layout-connect-btn"
      >
        {connectLoading ? "Connecting…" : "Connect wallet"}
      </button>
      {errorMessage && (
        <span className="layout-wallet-error" role="alert">
          {errorMessage}
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss"
            className="layout-dismiss-error"
          >
            ×
          </button>
        </span>
      )}
    </div>
  ) : (
    <div className="layout-wallet-slot layout-wallet-connected">
      <span className="layout-address" title={address}>
        {address.slice(0, 6)}…{address.slice(-4)}
      </span>
      <span className="layout-balance">{usdcBalance} USDC</span>
      <NavLink to="/account" className="layout-account-link">
        Account
      </NavLink>
      {resetEverything && (
        <button
          type="button"
          onClick={async () => {
            await resetEverything();
            navigate("/play");
          }}
          className="layout-reset-btn"
          title="Clear everything and start fresh: queue, match state, participants; reload addresses; return to Lobby"
        >
          Reset
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          disconnectWallet();
          navigate("/");
        }}
        className="layout-disconnect-btn"
      >
        Disconnect
      </button>
    </div>
  );

  return (
    <div className="layout">
      <header className="layout-header" role="banner">
        <Link to="/" className="layout-brand" aria-label="Arena Race home">
          Arena Race
        </Link>
        <nav className="layout-nav" role="navigation" aria-label="Main">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Dashboard
          </NavLink>
          <NavLink to="/play" className={({ isActive }) => (isActive ? "active" : "")}>
            Play
          </NavLink>
          <NavLink to="/simulator" className={({ isActive }) => (isActive ? "active" : "")}>
            Game Simulator
          </NavLink>
          <NavLink to="/rewards" className={({ isActive }) => (isActive ? "active" : "")}>
            Rewards
          </NavLink>
          <NavLink to="/wallet" className={({ isActive }) => (isActive ? "active" : "")}>
            Wallet
          </NavLink>
          <NavLink to="/account" className={({ isActive }) => (isActive ? "active" : "")}>
            Account
          </NavLink>
        </nav>
        <div className="layout-wallet">{walletSlot}</div>
      </header>
      <main className="layout-main" role="main">
        {children}
      </main>
      <footer className="layout-footer" role="contentinfo">
        <span>Arena Race</span>
        {" · "}
        <a href="https://github.com" target="_blank" rel="noopener noreferrer">
          Docs
        </a>
      </footer>
    </div>
  );
}
