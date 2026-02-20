import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";

function getNetworkName(chainId: number): string {
  if (chainId === 31337) return "Localhost 8545";
  if (chainId === 1) return "Ethereum Mainnet";
  if (chainId === 137) return "Polygon";
  return `Chain ${chainId}`;
}

export default function Wallet() {
  const {
    address,
    chainId,
    deployed,
    usdcBalance,
    connectWallet,
    disconnectWallet,
    refreshBalance,
    refreshAccount,
    connectLoading,
  } = useWallet();
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    document.title = "Wallet – Arena Race";
    return () => {
      document.title = "Arena Race";
    };
  }, []);

  const wrongChain = deployed && chainId != null && chainId !== deployed.chainId;

  const switchNetwork = async () => {
    if (!deployed) return;
    const ethereum = (window as unknown as { ethereum?: { request: (args: unknown) => Promise<null> } }).ethereum;
    if (!ethereum?.request) return;
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${deployed.chainId.toString(16)}` }],
      });
      await refreshAccount();
    } catch {
      // User may reject or chain not added
    }
  };

  const copyEscrow = async () => {
    if (!deployed?.escrow) return;
    try {
      await navigator.clipboard.writeText(deployed.escrow);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!address) {
    return (
      <div className="card">
        <h1>Wallet</h1>
        <p>Connect your wallet to view balance and network.</p>
        <button onClick={connectWallet} disabled={connectLoading}>
          {connectLoading ? "Connecting…" : "Connect wallet"}
        </button>
      </div>
    );
  }

  return (
    <>
      <h1>Wallet</h1>

      {wrongChain && (
        <div className="card" style={{ borderColor: "var(--error)", background: "rgba(248,113,113,0.1)" }}>
          <h2>Wrong network</h2>
          <p>
            This app uses {getNetworkName(deployed.chainId)} (Chain ID: {deployed.chainId}). You are on {chainId != null ? getNetworkName(chainId) : "—"}.
          </p>
          <button type="button" onClick={switchNetwork}>
            Switch network
          </button>
        </div>
      )}

      <div className="card">
        <h2>Network</h2>
        <p>
          {chainId != null ? (
            <>
              {getNetworkName(chainId)} · Chain ID: {chainId}
            </>
          ) : (
            "—"
          )}
        </p>
      </div>

      <div className="card">
        <h2>USDC balance</h2>
        <p className="stat-value" style={{ fontSize: "var(--text-xl)" }}>
          {usdcBalance} USDC
        </p>
        <button type="button" onClick={refreshBalance}>
          Refresh
        </button>
      </div>

      {deployed?.escrow && (
        <div className="card">
          <h2>Escrow contract</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Contract: {deployed.escrow.slice(0, 10)}…{deployed.escrow.slice(-8)}
          </p>
          <button type="button" onClick={copyEscrow}>
            {copySuccess ? "Copied!" : "Copy address"}
          </button>
        </div>
      )}

      <div className="card wallet-metanask-note">
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          MetaMask may not update custom token balances on Localhost. The balance above is read from the chain and is correct.
        </p>
      </div>

      <div className="card">
        <button type="button" onClick={disconnectWallet} className="layout-disconnect-btn">
          Disconnect
        </button>
      </div>
    </>
  );
}
