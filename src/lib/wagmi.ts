import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { createConfig, http, fallback } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * Pivah supported networks. Base is the production target, Base Sepolia is the
 * test network. Additional EVM networks can be appended here without touching
 * any consuming code.
 */
export const pivahChains = [base, baseSepolia] as const;

/**
 * Which network this deployment treats as "home" when no wallet is
 * connected — e.g. the disconnected/public browse view on Projects. Set
 * VITE_DEFAULT_CHAIN_ID in each deployment's env: testnet.pivah.xyz leaves
 * it unset (falls back to Base Sepolia), the mainnet deployment sets it to
 * 8453 so it never shows testnet data to a visitor who hasn't connected a
 * wallet yet. Testnet and mainnet share one Supabase database, so this is
 * the only thing telling the app which world it's actually showing.
 */
export const DEFAULT_CHAIN_ID = (() => {
  const raw = import.meta.env["VITE_DEFAULT_CHAIN_ID"] as string | undefined;
  const parsed = raw ? Number(raw) : NaN;
  return pivahChains.some((c) => c.id === parsed) ? parsed : baseSepolia.id;
})();

let cachedConfig: ReturnType<typeof getDefaultConfig> | null = null;

/**
 * Reading contract state (pools, listings, balances, quotes) goes through
 * these transports — a totally separate connection from whatever RPC the
 * user's wallet (MetaMask etc.) uses to actually broadcast a signed
 * transaction. The chain's built-in default RPC (sepolia.base.org) is a
 * free, shared, rate-limited endpoint that's proven unreliable under real
 * usage — 503s, slow responses, timeouts. If VITE_BASE_SEPOLIA_RPC_URL /
 * VITE_BASE_RPC_URL are set (e.g. to an Alchemy or Infura endpoint), those
 * are tried first, with the chain's default as an automatic fallback rather
 * than a hard requirement — so nothing breaks if the env var is unset.
 */
function transportFor(chainId: number, envVar: string) {
  const custom = import.meta.env[envVar] as string | undefined;
  return custom ? fallback([http(custom), http()]) : http();
}

/**
 * Built lazily (never at module scope) so no wallet/storage side effects run
 * during SSR module evaluation.
 */
export function getWagmiConfig() {
  if (cachedConfig) return cachedConfig;
  const projectId = import.meta.env["VITE_WALLETCONNECT_PROJECT_ID"] as string | undefined;
  const transports = {
    [base.id]: transportFor(base.id, "VITE_BASE_RPC_URL"),
    [baseSepolia.id]: transportFor(baseSepolia.id, "VITE_BASE_SEPOLIA_RPC_URL"),
  };

  // A WalletConnect/Reown project ID is optional for browser-extension wallets.
  // This keeps MetaMask, Coinbase Wallet and other injected wallets usable in
  // local development and the hosted preview even before WalletConnect is set up.
  if (!projectId) {
    cachedConfig = createConfig({
      chains: pivahChains,
      connectors: [injected()],
      transports,
      ssr: true,
    }) as ReturnType<typeof getDefaultConfig>;
    return cachedConfig;
  }

  cachedConfig = getDefaultConfig({
    appName: "Pivah Protocol",
    projectId,
    chains: pivahChains,
    transports,
    ssr: true,
  });
  return cachedConfig;
}
