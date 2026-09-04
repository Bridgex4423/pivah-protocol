import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";

import {
  collectionAbi,
  collectionFactoryAbi,
  erc20Abi,
  erc721Abi,
  marketplaceAbi,
  poolAbi,
  poolExtraAbi,
  poolFactoryAbi,
  stakingVaultAbi,
} from "./abis";
import { getAddresses, isDeployed } from "./addresses";

export type Address = `0x${string}`;

export const MAX_UINT256 = (1n << 256n) - 1n;

export function usePivah() {
  const chainId = useChainId();
  return useMemo(
    () => ({ chainId, addresses: getAddresses(chainId), deployed: isDeployed(chainId) }),
    [chainId],
  );
}

/**
 * Max tokens minted per ownerMint() transaction. Empirically measured at
 * ~118,000 gas/token, so 100 was originally chosen with real margin under
 * the ~16.7M gas cap several RPC providers/wallets enforce — but MetaMask's
 * optional "Smart Transactions" relay has its own separate timeout that
 * isn't a gas limit at all, and real usage showed 95 tokens succeeding
 * where 100 hit that relay timeout. Lowered to 80 for real margin under
 * both constraints at once. If this ever needs raising again, re-verify
 * against both: the gas-per-token measurement, and an actual mint at the
 * new size with Smart Transactions left on (most users won't turn it off).
 */
export const MINT_BATCH_SIZE = 80;

export function deadline(minutes = 20) {
  return BigInt(Math.floor(Date.now() / 1000) + minutes * 60);
}

export interface TxRequest {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

/** Write helper: sends a tx, toasts progress, waits for the receipt. */
export function useTx() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [pending, setPending] = useState<string | null>(null);

  const send = useCallback(
    async (label: string, request: TxRequest) => {
      setPending(label);
      const id = toast.loading(`${label} — confirm in your wallet`);
      try {
        if (!publicClient)
          throw new Error("Wallet network is not ready. Reconnect your wallet and try again.");
        const hash = await writeContractAsync(
          request as unknown as Parameters<typeof writeContractAsync>[0],
        );
        toast.loading(`${label} — confirming on-chain`, { id });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("The transaction reverted on-chain");
        toast.success(`${label} confirmed`, { id, description: hash });
        return receipt;
      } catch (error) {
        const message =
          error instanceof Error ? error.message.split("\n")[0] : "Transaction failed";
        toast.error(`${label} failed`, { id, description: message });
        throw error;
      } finally {
        setPending(null);
      }
    },
    [writeContractAsync, publicClient],
  );

  return { send, pending };
}

export interface PoolSummary {
  address: Address;
  collection: Address;
  quoteToken: Address;
  curve: number;
  spotPrice: bigint;
  delta: bigint;
  lpFeeBps: number;
  inventory: bigint;
  quoteReserves: bigint;
  name: string;
  symbol: string;
}

/** All pools registered on the factory, with their live state. */
export type PricePoint = { timestamp: number; price: bigint };

/**
 * Real trade history read directly from the pool contract's own Buy/Sell
 * events — no backend indexer exists yet, so this is the honest
 * alternative: query the chain itself rather than show an empty chart or
 * invent numbers. Chunks requests to stay under typical RPC provider block
 * range limits, and looks back a bounded window rather than the pool's
 * entire history, since a very old, very active pool could otherwise mean
 * an unbounded number of requests on every page load.
 */
export type MarketplaceSalesStats = { count: number; volume: bigint };

/**
 * Real, cumulative Marketplace sales history read directly from the
 * contract's own Sold events — same reasoning as the DEX price chart:
 * there's no backend indexer yet, so the chain itself is the honest source
 * of truth rather than a guess or a manually-typed number. Looks back far
 * enough to cover the Marketplace's full history so far (it's only days
 * old), chunked to stay under typical RPC provider block-range limits.
 */
/** Fetches one chunk's Sold events, retrying with backoff on transient
 *  failures (most commonly RPC rate limiting) rather than letting one bad
 *  request take down the whole aggregate count. */
/** Fetches one range's Sold events. Tries the full range first — Sold
 *  events are sparse, so a wide range is normally cheap regardless of its
 *  block span. Retries transient failures (rate limiting) with backoff at
 *  the same size; only falls back to splitting the range in half — down to
 *  a proven-safe floor — if it still won't succeed, since that usually
 *  means the range itself is genuinely too wide for this provider rather
 *  than a passing hiccup. */
async function fetchSoldChunk(
  publicClient: ReturnType<typeof usePublicClient>,
  marketplace: Address,
  from: bigint,
  to: bigint,
  attempt = 0,
): Promise<{ args: { price?: bigint } }[]> {
  try {
    return (await publicClient!.getContractEvents({
      address: marketplace,
      abi: marketplaceAbi,
      eventName: "Sold",
      fromBlock: from,
      toBlock: to,
    })) as unknown as { args: { price?: bigint } }[];
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
      return fetchSoldChunk(publicClient, marketplace, from, to, attempt + 1);
    }
    const span = to - from;
    if (span <= 2_000n) throw err;
    const mid = from + span / 2n;
    const [first, second] = await Promise.all([
      fetchSoldChunk(publicClient, marketplace, from, mid),
      fetchSoldChunk(publicClient, marketplace, mid + 1n, to),
    ]);
    return [...first, ...second];
  }
}

export function useMarketplaceSalesStats() {
  const { addresses } = usePivah();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const marketplace = addresses.marketplace as Address | undefined;

  return useQuery({
    queryKey: ["marketplace-sales-stats", marketplace, chainId],
    enabled: Boolean(marketplace && publicClient),
    // A full history rescan is genuinely expensive (up to 150 chunked RPC
    // calls) — refetching every 30s was rerunning that entire scan while
    // the page just sat open, competing with itself for the same rate
    // limit and likely making the slow, retry-heavy loads worse. An
    // all-time cumulative total doesn't need near-real-time freshness the
    // way live listings do, so this only refreshes every few minutes now.
    refetchInterval: 3 * 60_000,
    staleTime: 60_000,
    retry: 2,
    queryFn: async (): Promise<MarketplaceSalesStats> => {
      if (!marketplace || !publicClient) return { count: 0, volume: 0n };

      const latest = await publicClient.getBlockNumber();
      // Sold events are sparse, so a much wider window per request is
      // normally cheap — fetchSoldChunk automatically falls back to
      // smaller, proven-safe pieces if a given range turns out too wide
      // for the provider. This cuts total requests roughly 5x in the
      // common case where the wide range just works.
      const CHUNK = 10_000n;
      // The Marketplace is only days old — 300k blocks (~7 days on Base)
      // comfortably covers its whole history with real margin, without the
      // hundreds of near-empty requests a much larger window would force.
      const LOOKBACK = 300_000n;
      const fromFloor = latest > LOOKBACK ? latest - LOOKBACK : 0n;

      const ranges: { from: bigint; to: bigint }[] = [];
      let cursor = latest;
      while (cursor > fromFloor) {
        const from = cursor - CHUNK > fromFloor ? cursor - CHUNK : fromFloor;
        ranges.push({ from, to: cursor });
        cursor = from;
      }

      // Wider chunks mean far fewer total ranges now, so a larger
      // concurrent batch no longer risks the same rate-limit pressure the
      // original narrower-chunk version hit.
      let count = 0;
      let volume = 0n;
      const BATCH = 6;
      for (let i = 0; i < ranges.length; i += BATCH) {
        const batch = ranges.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map((r) => fetchSoldChunk(publicClient, marketplace, r.from, r.to)),
        );
        for (const sales of results) {
          for (const log of sales) {
            if (log.args.price === undefined) continue;
            count += 1;
            volume += log.args.price;
          }
        }
        if (i + BATCH < ranges.length) await new Promise((r) => setTimeout(r, 150));
      }

      return { count, volume };
    },
  });
}

export function usePoolPriceHistory(pool: Address | undefined) {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  return useQuery({
    queryKey: ["pool-price-history", pool, chainId],
    enabled: Boolean(pool && publicClient),
    refetchInterval: 30_000,
    queryFn: async (): Promise<PricePoint[]> => {
      if (!pool || !publicClient) return [];

      const latest = await publicClient.getBlockNumber();
      const CHUNK = 2_000n; // conservative — well under typical provider caps
      const LOOKBACK = 300_000n; // ~7 days on Base at ~2s blocks
      const fromFloor = latest > LOOKBACK ? latest - LOOKBACK : 0n;

      type RawLog = { blockNumber: bigint; args: { newSpot?: bigint } };
      const buyLogs: RawLog[] = [];
      const sellLogs: RawLog[] = [];

      let cursor = latest;
      while (cursor > fromFloor) {
        const from = cursor - CHUNK > fromFloor ? cursor - CHUNK : fromFloor;
        const [buys, sells] = await Promise.all([
          publicClient.getContractEvents({
            address: pool,
            abi: poolAbi,
            eventName: "Buy",
            fromBlock: from,
            toBlock: cursor,
          }),
          publicClient.getContractEvents({
            address: pool,
            abi: poolAbi,
            eventName: "Sell",
            fromBlock: from,
            toBlock: cursor,
          }),
        ]);
        buyLogs.push(...(buys as unknown as RawLog[]));
        sellLogs.push(...(sells as unknown as RawLog[]));
        cursor = from;
        // Enough points for a readable chart — stop scanning further back.
        if (buyLogs.length + sellLogs.length >= 200) break;
      }

      const all = [...buyLogs, ...sellLogs].filter((l) => l.args.newSpot !== undefined);
      if (all.length === 0) return [];

      const uniqueBlocks = Array.from(new Set(all.map((l) => l.blockNumber)));
      const blocks = await Promise.all(
        uniqueBlocks.map((b) => publicClient.getBlock({ blockNumber: b })),
      );
      const tsByBlock = new Map(blocks.map((b) => [b.number, Number(b.timestamp)]));

      return all
        .map((l) => ({
          timestamp: tsByBlock.get(l.blockNumber) ?? 0,
          price: l.args.newSpot as bigint,
        }))
        .filter((p) => p.timestamp > 0)
        .sort((a, b) => a.timestamp - b.timestamp);
    },
  });
}

export function usePools() {
  const { addresses, deployed } = usePivah();
  const factory = addresses.poolFactory as Address;

  const count = useReadContract({
    address: deployed ? factory : undefined,
    abi: poolFactoryAbi,
    functionName: "poolCount",
    query: { enabled: deployed, refetchInterval: 15_000 },
  });

  const n = Number(count.data ?? 0n);

  const addressReads = useReadContracts({
    contracts: Array.from({ length: n }, (_, i) => ({
      address: factory,
      abi: poolFactoryAbi,
      functionName: "allPools" as const,
      args: [BigInt(i)] as const,
    })),
    query: { enabled: n > 0 },
  });

  const poolAddresses = useMemo(
    () =>
      (addressReads.data ?? [])
        .map((r) => r.result as Address | undefined)
        .filter((a): a is Address => Boolean(a)),
    [addressReads.data],
  );

  const detailReads = useReadContracts({
    contracts: poolAddresses.flatMap((address) => [
      { address, abi: poolExtraAbi, functionName: "collection" as const },
      { address, abi: poolExtraAbi, functionName: "quoteToken" as const },
      { address, abi: poolAbi, functionName: "curve" as const },
      { address, abi: poolAbi, functionName: "spotPrice" as const },
      { address, abi: poolAbi, functionName: "delta" as const },
      { address, abi: poolAbi, functionName: "lpFeeBps" as const },
      { address, abi: poolAbi, functionName: "inventory" as const },
      { address, abi: poolAbi, functionName: "quoteReserves" as const },
    ]),
    query: { enabled: poolAddresses.length > 0, refetchInterval: 15_000 },
  });

  const metaReads = useReadContracts({
    contracts: poolAddresses.flatMap((_, i) => {
      const collection = detailReads.data?.[i * 8]?.result as Address | undefined;
      return [
        { address: collection, abi: collectionAbi, functionName: "name" as const },
        { address: collection, abi: collectionAbi, functionName: "symbol" as const },
      ];
    }),
    query: { enabled: Boolean(detailReads.data?.length) },
  });

  const pools = useMemo<PoolSummary[]>(() => {
    if (!detailReads.data) return [];
    return poolAddresses.map((address, i) => {
      const at = (k: number) => detailReads.data?.[i * 8 + k]?.result;
      return {
        address,
        collection: (at(0) as Address) ?? ("0x" as Address),
        quoteToken: (at(1) as Address) ?? ("0x" as Address),
        curve: Number(at(2) ?? 0),
        spotPrice: (at(3) as bigint) ?? 0n,
        delta: (at(4) as bigint) ?? 0n,
        lpFeeBps: Number(at(5) ?? 0),
        inventory: (at(6) as bigint) ?? 0n,
        quoteReserves: (at(7) as bigint) ?? 0n,
        name: (metaReads.data?.[i * 2]?.result as string) ?? "Collection",
        symbol: (metaReads.data?.[i * 2 + 1]?.result as string) ?? "",
      };
    });
  }, [detailReads.data, metaReads.data, poolAddresses]);

  return {
    pools,
    isLoading: count.isLoading || addressReads.isLoading || detailReads.isLoading,
    refetch: () => {
      void count.refetch();
      void addressReads.refetch();
      void detailReads.refetch();
    },
  };
}

/** Token ids of `collection` held by the connected wallet (ERC721Enumerable). */
export function useOwnedTokens(collection: Address | undefined) {
  const { address } = useAccount();

  const balance = useReadContract({
    address: collection,
    abi: collectionAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(collection && address), refetchInterval: 15_000 },
  });

  const n = Number(balance.data ?? 0n);

  const tokens = useReadContracts({
    contracts: Array.from({ length: Math.min(n, 500) }, (_, i) => ({
      address: collection,
      abi: collectionAbi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [address as Address, BigInt(i)] as const,
    })),
    query: { enabled: Boolean(collection && address) && n > 0 },
  });

  const tokenIds = useMemo(
    () =>
      (tokens.data ?? [])
        .map((r) => r.result as bigint | undefined)
        .filter((t): t is bigint => typeof t === "bigint"),
    [tokens.data],
  );

  return {
    tokenIds,
    isLoading: balance.isLoading || tokens.isLoading,
    refetch: () => {
      void balance.refetch();
      void tokens.refetch();
    },
  };
}

/**
 * Resolves a token's real image the same way any wallet or marketplace
 * would: read `tokenURI` from the contract, fetch that JSON, read `image`
 * off it. Works for any PivahCollection regardless of which Creator Studio
 * mode built it — shared artwork, layered/generative, or hand-uploaded.
 */
export function useTokenImage(collection: Address | undefined, tokenId: bigint | undefined) {
  const uri = useReadContract({
    address: collection,
    abi: collectionAbi,
    functionName: "tokenURI",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: Boolean(collection && tokenId !== undefined), staleTime: 5 * 60_000 },
  });

  const metaUrl = uri.data as string | undefined;

  const meta = useQuery({
    queryKey: ["token-image", metaUrl],
    queryFn: async () => {
      const res = await fetch(metaUrl as string);
      if (!res.ok) throw new Error("metadata fetch failed");
      return (await res.json()) as { image?: string; name?: string };
    },
    enabled: Boolean(metaUrl),
    staleTime: 5 * 60_000,
  });

  return {
    image: meta.data?.image,
    name: meta.data?.name,
    isLoading: uri.isLoading || meta.isLoading,
  };
}

/**
 * A representative image for an entire collection (not one specific token) —
 * used on cards/rows where showing every token isn't practical. Reads
 * tokenURI for token id 1 (every PivahCollection mints sequentially from 1),
 * so it works for shared-artwork, generative and hand-uploaded collections
 * alike, same as {@link useTokenImage}.
 */
export function useCollectionImage(collection: Address | undefined) {
  return useTokenImage(collection, collection ? 1n : undefined);
}

/** Ensure `spender` can move the wallet's NFTs; returns true if a tx was sent. */
export function useNftApproval() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { send } = useTx();

  return useCallback(
    async (collection: Address, spender: Address) => {
      if (!address || !publicClient) return false;
      const approved = await publicClient.readContract({
        address: collection,
        abi: erc721Abi,
        functionName: "isApprovedForAll",
        args: [address, spender],
      });
      if (approved) return false;
      await send("Approve collection", {
        address: collection,
        abi: erc721Abi,
        functionName: "setApprovalForAll",
        args: [spender, true],
      });
      return true;
    },
    [address, publicClient, send],
  );
}

/** Ensure `spender` has at least `amount` ERC20 allowance. */
export function useErc20Approval() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { send } = useTx();

  return useCallback(
    async (token: Address, spender: Address, amount: bigint, symbol = "WETH") => {
      if (!address || !publicClient) return false;
      const allowance = (await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, spender],
      })) as bigint;
      if (allowance >= amount) return false;
      // Approve once for an unlimited amount so people are not prompted to
      // approve again on every deposit, trade or stake.
      await send(`Approve ${symbol}`, {
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, MAX_UINT256],
      });
      return true;
    },
    [address, publicClient, send],
  );
}

export interface ListingRow {
  id: bigint;
  seller: Address;
  collection: Address;
  tokenId: bigint;
  quoteToken: Address;
  price: bigint;
  expiry: bigint;
  active: boolean;
}

/** Active marketplace listings read straight from the contract. */
export function useListings() {
  const { addresses, deployed } = usePivah();
  const marketplace = addresses.marketplace as Address;

  const next = useReadContract({
    address: deployed && marketplace ? marketplace : undefined,
    abi: marketplaceAbi,
    functionName: "nextListingId",
    query: { enabled: Boolean(deployed && marketplace), refetchInterval: 15_000 },
  });

  const n = Number(next.data ?? 1n) - 1;

  const reads = useReadContracts({
    contracts: Array.from({ length: Math.max(n, 0) }, (_, i) => ({
      address: marketplace,
      abi: marketplaceAbi,
      functionName: "listings" as const,
      args: [BigInt(i + 1)] as const,
    })),
    query: { enabled: n > 0, refetchInterval: 15_000 },
  });

  const listings = useMemo<ListingRow[]>(() => {
    return (reads.data ?? [])
      .map((r, i) => {
        const v = r.result as
          readonly [Address, Address, bigint, Address, bigint, bigint, boolean] | undefined;
        if (!v) return null;
        return {
          id: BigInt(i + 1),
          seller: v[0],
          collection: v[1],
          tokenId: v[2],
          quoteToken: v[3],
          price: v[4],
          expiry: v[5],
          active: v[6],
        };
      })
      .filter((l): l is ListingRow => Boolean(l && l.active));
  }, [reads.data]);

  return {
    listings,
    isLoading: next.isLoading || reads.isLoading,
    refetch: () => {
      void next.refetch();
      void reads.refetch();
    },
  };
}

/** Collections deployed through the Pivah collection factory. */
export function useCollections(onlyMine = false) {
  const { address } = useAccount();
  const { addresses, deployed } = usePivah();
  const factory = addresses.collectionFactory as Address;
  const enabled = Boolean(deployed && factory);

  const mine = useReadContract({
    address: enabled ? factory : undefined,
    abi: collectionFactoryAbi,
    functionName: "creatorCollections",
    args: address ? [address] : undefined,
    query: { enabled: enabled && onlyMine && Boolean(address), refetchInterval: 15_000 },
  });

  const count = useReadContract({
    address: enabled ? factory : undefined,
    abi: collectionFactoryAbi,
    functionName: "collectionCount",
    query: { enabled: enabled && !onlyMine, refetchInterval: 15_000 },
  });

  const n = Number(count.data ?? 0n);

  const all = useReadContracts({
    contracts: Array.from({ length: n }, (_, i) => ({
      address: factory,
      abi: collectionFactoryAbi,
      functionName: "allCollections" as const,
      args: [BigInt(i)] as const,
    })),
    query: { enabled: !onlyMine && n > 0 },
  });

  const list = useMemo<Address[]>(() => {
    if (onlyMine) return ((mine.data as Address[] | undefined) ?? []).slice();
    return (all.data ?? [])
      .map((r) => r.result as Address | undefined)
      .filter((a): a is Address => Boolean(a));
  }, [onlyMine, mine.data, all.data]);

  const meta = useReadContracts({
    contracts: list.flatMap((address_) => [
      { address: address_, abi: collectionAbi, functionName: "name" as const },
      { address: address_, abi: collectionAbi, functionName: "symbol" as const },
      { address: address_, abi: collectionAbi, functionName: "totalSupply" as const },
      { address: address_, abi: collectionAbi, functionName: "maxSupply" as const },
      { address: address_, abi: collectionAbi, functionName: "mintPrice" as const },
      { address: address_, abi: collectionAbi, functionName: "mintOpen" as const },
    ]),
    query: { enabled: list.length > 0, refetchInterval: 15_000 },
  });

  const collections = useMemo(
    () =>
      list.map((address_, i) => {
        const at = (k: number) => meta.data?.[i * 6 + k]?.result;
        return {
          address: address_,
          name: (at(0) as string) ?? "Collection",
          symbol: (at(1) as string) ?? "",
          totalSupply: (at(2) as bigint) ?? 0n,
          maxSupply: (at(3) as bigint) ?? 0n,
          mintPrice: (at(4) as bigint) ?? 0n,
          mintOpen: Boolean(at(5)),
        };
      }),
    [list, meta.data],
  );

  return {
    collections,
    isLoading: mine.isLoading || count.isLoading || all.isLoading || meta.isLoading,
    refetch: () => {
      void mine.refetch();
      void count.refetch();
      void all.refetch();
      void meta.refetch();
    },
  };
}

export type PivahCollectionRow = ReturnType<typeof useCollections>["collections"][number];

/**
 * Everything the /portfolio page needs, read live: which collections the
 * wallet holds any NFTs from, LP shares in every pool, and staked PIVAH.
 * No indexer, no backend — pure on-chain reads across the known
 * collections/pools, same pattern as the DEX and marketplace pages.
 */
export function usePortfolio() {
  const { address } = useAccount();
  const { collections, isLoading: collectionsLoading } = useCollections();
  const { pools, isLoading: poolsLoading } = usePools();
  const vault = useStakingVault();

  const nftBalances = useReadContracts({
    contracts: collections.map((c) => ({
      address: c.address,
      abi: erc721Abi,
      functionName: "balanceOf" as const,
      args: address ? ([address] as const) : undefined,
    })),
    query: { enabled: Boolean(address) && collections.length > 0, refetchInterval: 20_000 },
  });

  const lpBalances = useReadContracts({
    contracts: pools.map((p) => ({
      address: p.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: address ? ([address] as const) : undefined,
    })),
    query: { enabled: Boolean(address) && pools.length > 0, refetchInterval: 20_000 },
  });

  const heldCollections = useMemo(
    () =>
      collections
        .map((c, i) => ({ ...c, balance: (nftBalances.data?.[i]?.result as bigint) ?? 0n }))
        .filter((c) => c.balance > 0n),
    [collections, nftBalances.data],
  );

  const lpPositions = useMemo(
    () =>
      pools
        .map((p, i) => ({ ...p, lpBalance: (lpBalances.data?.[i]?.result as bigint) ?? 0n }))
        .filter((p) => p.lpBalance > 0n),
    [pools, lpBalances.data],
  );

  const nftsHeld = useMemo(
    () => heldCollections.reduce((sum, c) => sum + c.balance, 0n),
    [heldCollections],
  );

  return {
    heldCollections,
    lpPositions,
    nftsHeld,
    nftsStaked: vault.vault.myStakes.length,
    pendingRewards: vault.vault.userPending,
    isLoading: collectionsLoading || poolsLoading || nftBalances.isLoading || lpBalances.isLoading,
  };
}

/** Vault-wide stats plus the connected wallet's stake, PIVAH balance and
 *  allowance — everything the /stake page needs, all live on-chain. */
export interface StakedNft {
  stakeId: bigint;
  collection: Address;
  tokenId: bigint;
}

/** Vault-wide stats, the connected wallet's claimable PIVAH, and the exact
 *  list of NFTs they currently have staked — everything the /stake page
 *  needs, all live on-chain. No indexer: scans stake ids 1..nextStakeId-1
 *  in one multicall, which is fine at testnet scale and honest about not
 *  needing more infrastructure than that yet. */
/** Live WETH balance sitting inside the FeeManager contract — accrued from
 *  every trade's protocol fee, waiting for someone to call sweep(). */
/** Live WETH balance for the connected wallet — used to offer a one-click
 *  "convert to ETH" action, e.g. after Marketplace sale proceeds land as
 *  WETH with no transaction the seller signs at that moment. */
export function useWethBalance() {
  const { address } = useAccount();
  const { addresses } = usePivah();
  const enabled = Boolean(address && addresses.weth);

  const read = useReadContract({
    address: addresses.weth as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: enabled ? ([address as Address] as const) : undefined,
    query: { enabled, refetchInterval: 15_000 },
  });

  return {
    balance: (read.data as bigint | undefined) ?? 0n,
    isLoading: read.isLoading,
    refetch: read.refetch,
  };
}

export function useFeeManagerBalance() {
  const { addresses } = usePivah();
  const enabled = Boolean(addresses.feeManager && addresses.weth);

  const read = useReadContract({
    address: addresses.weth as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: enabled ? ([addresses.feeManager as Address] as const) : undefined,
    query: { enabled, refetchInterval: 15_000 },
  });

  return {
    balance: (read.data as bigint | undefined) ?? 0n,
    isLoading: read.isLoading,
    refetch: read.refetch,
  };
}

export function useStakingVault() {
  const { addresses } = usePivah();
  const { address } = useAccount();
  const vault = addresses.stakingVault as Address | "";
  const enabled = Boolean(vault);

  const vaultReads = useReadContracts({
    contracts: [
      { address: vault as Address, abi: stakingVaultAbi, functionName: "totalStaked" as const },
      {
        address: vault as Address,
        abi: stakingVaultAbi,
        functionName: "rewardRatePerSecond" as const,
      },
      { address: vault as Address, abi: stakingVaultAbi, functionName: "nextStakeId" as const },
    ],
    query: { enabled, refetchInterval: 15_000 },
  });

  const nextStakeId = (vaultReads.data?.[2]?.result as bigint | undefined) ?? 1n;
  const stakeIdRange = useMemo(
    () => Array.from({ length: Math.max(0, Number(nextStakeId) - 1) }, (_, i) => BigInt(i + 1)),
    [nextStakeId],
  );

  const stakeReads = useReadContracts({
    contracts: stakeIdRange.map((id) => ({
      address: vault as Address,
      abi: stakingVaultAbi,
      functionName: "stakes" as const,
      args: [id] as const,
    })),
    query: { enabled: enabled && stakeIdRange.length > 0, refetchInterval: 15_000 },
  });

  const userReads = useReadContracts({
    contracts: [
      {
        address: vault as Address,
        abi: stakingVaultAbi,
        functionName: "pending" as const,
        args: address ? ([address] as const) : undefined,
      },
    ],
    query: { enabled: enabled && Boolean(address), refetchInterval: 15_000 },
  });

  const myStakes: StakedNft[] = useMemo(() => {
    if (!address || !stakeReads.data) return [];
    const out: StakedNft[] = [];
    stakeReads.data.forEach((r, i) => {
      const result = r.result as [Address, Address, bigint] | undefined;
      if (result && result[0].toLowerCase() === address.toLowerCase()) {
        out.push({ stakeId: stakeIdRange[i]!, collection: result[1], tokenId: result[2] });
      }
    });
    return out;
  }, [address, stakeReads.data, stakeIdRange]);

  const vaultData = useMemo(
    () => ({
      totalStaked: (vaultReads.data?.[0]?.result as bigint | undefined) ?? 0n,
      rewardRatePerSecond: (vaultReads.data?.[1]?.result as bigint | undefined) ?? 0n,
      userPending: (userReads.data?.[0]?.result as bigint | undefined) ?? 0n,
      myStakes,
    }),
    [vaultReads.data, userReads.data, myStakes],
  );

  return {
    vault: vaultData,
    deployed: enabled,
    isLoading: vaultReads.isLoading || stakeReads.isLoading || userReads.isLoading,
    refetch: () => {
      void vaultReads.refetch();
      void stakeReads.refetch();
      void userReads.refetch();
    },
  };
}
