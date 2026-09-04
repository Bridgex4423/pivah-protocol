import { supabase } from "@/integrations/supabase/client";

export type TestnetAction =
  | "created_collection"
  | "owner_minted"
  | "created_pool"
  | "added_liquidity"
  | "removed_liquidity"
  | "swap_buy"
  | "swap_sell"
  | "listed_marketplace"
  | "bought_marketplace"
  | "staked_nft"
  | "unstaked_nft"
  | "claimed_rewards";

/**
 * Records a wallet's testnet activity for Pivah's own records — e.g.
 * deciding mainnet token rewards for early creators and users later. This
 * is intentionally fire-and-forget: a logging failure must never surface an
 * error to the person or interrupt whatever on-chain action they just
 * completed successfully.
 */
export function logActivity(
  wallet: string | undefined,
  action: TestnetAction,
  opts: {
    chainId?: number | undefined;
    txHash?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  } = {},
) {
  if (!wallet) return;
  // This table only exists in the testnet Supabase project — mainnet never
  // got an equivalent, since "testnet activity" isn't a mainnet concept.
  // Skip outright there rather than firing a request guaranteed to 404.
  if (opts.chainId === 8453) return;
  void supabase
    .from("testnet_activity")
    .insert({
      wallet: wallet.toLowerCase(),
      action,
      chain_id: opts.chainId ?? 84532,
      tx_hash: opts.txHash ?? null,
      metadata: (opts.metadata ?? {}) as never,
    })
    .then(({ error }) => {
      if (error) console.warn("[testnet activity log]", error.message);
    });
}
