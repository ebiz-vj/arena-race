import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { BrowserProvider, Contract, formatUnits } from "ethers";
import { ERC20_ABI } from "../abis";

export type Deployed = {
  chainId: number;
  usdc: string;
  escrow: string;
  entryAmount: string;
};

type WalletContextValue = {
  provider: BrowserProvider | null;
  address: string | null;
  chainId: number | null;
  deployed: Deployed | null;
  usdcBalance: string;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshAccount: () => Promise<{ address: string | null; provider: BrowserProvider | null }>;
  refreshBalance: () => void;
  loadDeployed: () => Promise<void>;
  connectLoading: boolean;
  setConnectLoading: (v: boolean) => void;
  errorMessage: string | null;
  setErrorMessage: (v: string | null) => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

const DEPLOYED_URL = "/deployed-local.json";
const LAST_CHAIN_KEY = "arena_last_chain_id";

function loadDeployedConfig(): Promise<Deployed | null> {
  return fetch(`${DEPLOYED_URL}?t=${Date.now()}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [deployed, setDeployed] = useState<Deployed | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string>("—");
  const [connectLoading, setConnectLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDeployed = useCallback(async () => {
    const d = await loadDeployedConfig();
    setDeployed(d);
  }, []);

  useEffect(() => {
    loadDeployed();
  }, [loadDeployed]);

  const refreshUsdcBalance = useCallback(() => {
    if (!provider || !address || !deployed) return;
    const usdc = new Contract(deployed.usdc, ERC20_ABI, provider);
    usdc
      .balanceOf(address)
      .then((b: bigint) => setUsdcBalance(formatUnits(b, 6)))
      .catch(() => setUsdcBalance("—"));
  }, [provider, address, deployed]);

  useEffect(() => {
    refreshUsdcBalance();
  }, [refreshUsdcBalance]);

  useEffect(() => {
    if (!provider) return;
    provider
      .getNetwork()
      .then((n) => setChainId(Number(n.chainId)))
      .catch(() => setChainId(null));
  }, [provider]);

  useEffect(() => {
    const ethereum = (window as unknown as {
      ethereum?: {
        on: (e: string, h: (...args: unknown[]) => void) => void;
        removeListener?: (e: string, h: (...args: unknown[]) => void) => void;
      };
    }).ethereum;
    if (!ethereum?.on) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setAddress(accounts[0]);
      } else {
        setAddress(null);
        setProvider(null);
      }
      setErrorMessage(null);
    };
    const handleChainChanged = (chainIdHex: string) => {
      const parsed = typeof chainIdHex === "string" ? parseInt(chainIdHex, 16) : NaN;
      const nextChainId = Number.isFinite(parsed) ? parsed : null;
      setChainId(nextChainId);
      setProvider(new BrowserProvider(ethereum as import("ethers").Eip1193Provider));
      if (nextChainId != null && deployed && nextChainId !== deployed.chainId) {
        setErrorMessage(
          `Wrong network. Switch to Localhost 8545 (chain id ${deployed.chainId}). You are on chain ${nextChainId}.`
        );
      } else {
        setErrorMessage((prev) =>
          prev?.startsWith("Wrong network.") ? null : prev
        );
      }
    };
    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);
    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
        ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [deployed]);

  const connectWallet = useCallback(async () => {
    setErrorMessage(null);
    const ethereum = (window as unknown as { ethereum?: unknown }).ethereum;
    if (!ethereum) {
      setErrorMessage(
        "No wallet found. Install MetaMask (or another Web3 wallet), refresh the page, then try again."
      );
      return;
    }
    setConnectLoading(true);
    try {
      const p = new BrowserProvider(ethereum);
      const accounts = await p.send("eth_requestAccounts", []);
      if (!accounts?.length) throw new Error("No account selected.");
      setAddress(accounts[0]);
      setProvider(p);
      const net = await p.getNetwork();
      const chId = Number(net.chainId);
      setChainId(chId);
      try {
        localStorage.setItem(LAST_CHAIN_KEY, String(chId));
      } catch {
        // ignore
      }
      if (deployed && chId !== deployed.chainId) {
        setErrorMessage(
          `Wrong network. Switch to Localhost 8545 (chain id ${deployed.chainId}). You are on chain ${chId}.`
        );
      }
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err?.code === "ACTION_REJECTED" || err?.code === 4001) {
        setErrorMessage("Transaction was rejected in your wallet.");
      } else {
        setErrorMessage(err?.message ?? "Failed to connect");
      }
    } finally {
      setConnectLoading(false);
    }
  }, [deployed]);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setProvider(null);
    setChainId(null);
    setUsdcBalance("—");
    setErrorMessage(null);
  }, []);

  const refreshAccount = useCallback(async (): Promise<{
    address: string | null;
    provider: BrowserProvider | null;
  }> => {
    const win = window as unknown as {
      ethereum?: {
        request: (args: { method: string }) => Promise<string[]>;
        selectedAddress?: string | null;
      };
    };
    const ethereum = win.ethereum;
    if (!ethereum?.request) {
      return { address: null, provider: null };
    }
    setErrorMessage(null);
    try {
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accounts?.length > 0) {
        const selected = ethereum.selectedAddress?.toLowerCase();
        const newAddress =
          selected && accounts.some((a) => a.toLowerCase() === selected)
            ? accounts.find((a) => a.toLowerCase() === selected)!
            : accounts[0];
        const p = new BrowserProvider(ethereum as import("ethers").Eip1193Provider);
        setAddress(newAddress);
        setProvider(p);
        return { address: newAddress, provider: p };
      }
      setAddress(null);
      setProvider(null);
      return { address: null, provider: null };
    } catch (e) {
      setErrorMessage((e as Error)?.message ?? "Could not refresh account");
      return { address: null, provider: null };
    }
  }, []);

  const refreshBalance = useCallback(() => {
    if (!provider || !address || !deployed) return;
    const usdc = new Contract(deployed.usdc, ERC20_ABI, provider);
    usdc
      .balanceOf(address)
      .then((b: bigint) => setUsdcBalance(formatUnits(b, 6)))
      .catch(() => setUsdcBalance("—"));
  }, [provider, address, deployed]);

  const value: WalletContextValue = {
    provider,
    address,
    chainId,
    deployed,
    usdcBalance,
    connectWallet,
    disconnectWallet,
    refreshAccount,
    refreshBalance,
    loadDeployed,
    connectLoading,
    setConnectLoading,
    errorMessage,
    setErrorMessage,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return ctx;
}
