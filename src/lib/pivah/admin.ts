import { useAccount } from "wagmi";

/**
 * Wallets treated as protocol admins in the UI — currently the mainnet
 * deployer wallet. This is a display-only gate: it hides admin-facing
 * panels from casual visitors, nothing more. It cannot be a real
 * access-control boundary, because the contracts it fronts are
 * intentionally permissionless — e.g. PivahFeeManager.sweep() is callable
 * by any address on-chain by design (the destination is fixed to treasury
 * regardless of caller), so anyone who already knows that can still call it
 * directly via BaseScan whether or not they see a button for it here.
 * Add more addresses below (lowercase) if more wallets should see this.
 */
const ADMIN_ADDRESSES = new Set<string>([
  "0xb41457cf703d39f44382a69dc82e578c6b8a14c8", // mainnet deployer wallet
]);

export function useIsAdmin() {
  const { address } = useAccount();
  return Boolean(address && ADMIN_ADDRESSES.has(address.toLowerCase()));
}
