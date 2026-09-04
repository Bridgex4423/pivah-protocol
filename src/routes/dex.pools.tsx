import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Info, Loader2, Plus } from "lucide-react";
import { decodeEventLog, formatEther, isAddress, parseEther } from "viem";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { toast } from "sonner";

import { PageHeader, Panel, StatCard, Badge, EmptyState } from "@/components/ui/pivah";
import { erc20Abi, erc721Abi, poolAbi, poolFactoryAbi } from "@/lib/pivah/abis";
import { logActivity } from "@/lib/pivah/activity";
import {
  useCollectionImage,
  useCollections,
  useErc20Approval,
  useNftApproval,
  useOwnedTokens,
  usePivah,
  usePools,
  useTx,
  type Address,
} from "@/lib/pivah/hooks";

export const Route = createFileRoute("/dex/pools")({
  validateSearch: (search: Record<string, unknown>): { collection?: string; create?: boolean } => ({
    ...(typeof search["collection"] === "string" ? { collection: search["collection"] } : {}),
    ...(search["create"] === true || search["create"] === "true" ? { create: true } : {}),
  }),
  head: () => ({
    meta: [
      { title: "NFT Liquidity Pools — Pivah DEX" },
      {
        name: "description",
        content:
          "Browse Pivah collection liquidity pools: NFT inventory, WETH liquidity, spot price, curve type, volume and fees.",
      },
      { property: "og:title", content: "NFT Liquidity Pools — Pivah DEX" },
      {
        property: "og:description",
        content: "Collection-level NFT liquidity pools with bonding-curve pricing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PoolsPage,
});

function PoolsPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { pools, isLoading, refetch } = usePools();
  const [creating, setCreating] = useState(Boolean(search.create || search.collection));

  const tvl = pools.reduce((acc, p) => acc + p.quoteReserves + p.spotPrice * p.inventory, 0n);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DEX"
        title="NFT Liquidity Pools"
        description="Each pool pairs a collection's NFT inventory with WETH liquidity under an explicit pricing curve."
        actions={
          <>
            <Link
              to="/dex/liquidity"
              className="rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm font-semibold"
            >
              Add / withdraw liquidity
            </Link>
            <button
              onClick={() => setCreating((v) => !v)}
              className="rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              {creating ? "Close" : "Create pool"}
            </button>
          </>
        }
      />

      {creating ? (
        <CreatePool
          initialCollection={search.collection ?? ""}
          onCreated={(pool) => {
            setCreating(false);
            refetch();
            void navigate({ to: "/dex/liquidity", search: { pool } });
          }}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pools" value={String(pools.length)} />
        <StatCard
          label="Total value locked"
          value={`${Number(formatEther(tvl)).toFixed(3)} WETH`}
          tone="primary"
        />
        <StatCard
          label="NFTs in pools"
          value={String(pools.reduce((a, p) => a + Number(p.inventory), 0))}
        />
        <StatCard
          label="WETH liquidity"
          value={Number(formatEther(pools.reduce((a, p) => a + p.quoteReserves, 0n))).toFixed(3)}
          tone="accent"
        />
      </div>

      {isLoading ? (
        <Panel className="p-10 text-center text-sm text-muted-foreground">Loading pools…</Panel>
      ) : pools.length === 0 ? (
        <EmptyState
          title="No pools yet"
          description="Create the first pool for a collection, then seed it with NFTs and WETH from the liquidity page."
        />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Collection</th>
                <th className="px-5 py-3 font-medium">Curve</th>
                <th className="px-5 py-3 text-right font-medium">Spot</th>
                <th className="px-5 py-3 text-right font-medium">Inventory</th>
                <th className="px-5 py-3 text-right font-medium">WETH</th>
                <th className="px-5 py-3 text-right font-medium">LP fee</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {pools.map((p) => (
                <tr key={p.address} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <CollectionThumb address={p.collection} />
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="numeric text-xs text-muted-foreground">
                          {p.address.slice(0, 10)}…{p.address.slice(-6)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={p.curve === 0 ? "primary" : "accent"}>
                      {p.curve === 0 ? "Linear" : "Exponential"}
                    </Badge>
                  </td>
                  <td className="numeric px-5 py-4 text-right">
                    {Number(formatEther(p.spotPrice)).toFixed(4)}
                  </td>
                  <td className="numeric px-5 py-4 text-right">{String(p.inventory)}</td>
                  <td className="numeric px-5 py-4 text-right">
                    {Number(formatEther(p.quoteReserves)).toFixed(3)}
                  </td>
                  <td className="numeric px-5 py-4 text-right">{(p.lpFeeBps / 100).toFixed(2)}%</td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      to="/dex"
                      search={{ pool: p.address }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                    >
                      Trade
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}

function CreatePool({
  initialCollection,
  onCreated,
}: {
  initialCollection?: string;
  onCreated: (pool: Address) => void;
}) {
  const { address, isConnected, chainId } = useAccount();
  const { addresses, deployed } = usePivah();
  const { collections } = useCollections();
  const { send, pending } = useTx();
  const approveNfts = useNftApproval();
  const approveErc20 = useErc20Approval();
  const publicClient = usePublicClient();

  const [collection, setCollection] = useState(initialCollection ?? "");
  const [curve, setCurve] = useState(0);
  const [deltaPct, setDeltaPct] = useState("1");
  const [fee, setFee] = useState("150");
  const [nftCount, setNftCount] = useState(0);
  const [touched, setTouched] = useState(false);
  const [weth, setWeth] = useState("0.1");
  const [step, setStep] = useState<string | null>(null);

  const owned = useOwnedTokens(isAddress(collection) ? (collection as Address) : undefined);

  useEffect(() => {
    if (!touched) setNftCount(owned.tokenIds.length);
  }, [owned.tokenIds.length, touched]);

  const tokenIds = owned.tokenIds.slice(0, nftCount);
  const wethAmount = parseEther(weth || "0");

  // The whole point: price comes FROM what you deposit, not the other way
  // around. Spot price = WETH you're putting in ÷ NFTs you're putting in —
  // exactly how a real AMM's initial price is set, e.g. Uniswap's first LP.
  const computedSpot = tokenIds.length > 0 ? wethAmount / BigInt(tokenIds.length) : 0n;

  const wethAllowed = useReadContract({
    address: deployed ? (addresses.poolFactory as Address) : undefined,
    abi: poolFactoryAbi,
    functionName: "quoteTokenAllowed",
    args: [addresses.weth],
    query: { enabled: deployed, refetchInterval: 15_000 },
  });
  const factoryOwner = useReadContract({
    address: deployed ? (addresses.poolFactory as Address) : undefined,
    abi: poolFactoryAbi,
    functionName: "owner",
    query: { enabled: deployed },
  });
  const isFactoryOwner = Boolean(
    address &&
    typeof factoryOwner.data === "string" &&
    address.toLowerCase() === factoryOwner.data.toLowerCase(),
  );

  const isSingle = collections.some(
    (c) => c.address.toLowerCase() === collection.trim().toLowerCase() && c.maxSupply === 1n,
  );

  const deltaWei = useMemo(() => {
    // Delta is entered as a % of the computed spot price, so it scales
    // sensibly whatever price the deposit ratio lands on — no more typing
    // a raw WETH delta before you even know what the price will be.
    const pct = (Number(deltaPct) || 0) / 100;
    if (curve === 1) return parseEther(String(1 + pct)); // exponential: 1 + pct, e.g. 1.05
    return (computedSpot * BigInt(Math.round(pct * 10_000))) / 10_000n; // linear: pct of spot
  }, [curve, deltaPct, computedSpot]);

  async function create() {
    if (!isAddress(collection) || !wethAllowed.data || !address || !publicClient) return;
    if (tokenIds.length === 0 || wethAmount === 0n) return;

    // Re-verify ownership right before submitting — same guard used
    // elsewhere, protects against a stale selection.
    const results = await Promise.all(
      tokenIds.map(async (id) => {
        try {
          const owner = await publicClient.readContract({
            address: collection as Address,
            abi: erc721Abi,
            functionName: "ownerOf",
            args: [id],
          });
          return (owner as string).toLowerCase() === address.toLowerCase() ? id : null;
        } catch {
          return null;
        }
      }),
    );
    const verified = results.filter((id): id is bigint => id !== null);
    if (verified.length === 0) {
      toast.error("None of the selected tokens are still in your wallet — refresh and try again");
      owned.refetch();
      return;
    }
    const spot = wethAmount / BigInt(verified.length);
    if (spot === 0n) {
      toast.error("WETH amount is too small for this many NFTs — increase it or select fewer");
      return;
    }

    setStep("Creating pool");
    const receipt = await send("Create pool", {
      address: addresses.poolFactory as Address,
      abi: poolFactoryAbi,
      functionName: "createPool",
      args: [collection as Address, addresses.weth, curve, deltaWei, Number(fee || "0")],
    });

    let pool: Address | null = null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: poolFactoryAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "PoolCreated") {
          pool = (decoded.args as { pool: Address }).pool;
          break;
        }
      } catch {
        /* log belongs to another contract */
      }
    }
    if (!pool) throw new Error("Pool was created, but its address could not be read");
    logActivity(address, "created_pool", {
      chainId,
      txHash: receipt.transactionHash,
      metadata: { pool, collection, curve, spotPrice: spot.toString() },
    });

    setStep("Depositing NFTs + WETH");
    await approveNfts(collection as Address, pool);
    const wethBalance = (await publicClient.readContract({
      address: addresses.weth,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    })) as bigint;
    if (wethBalance < wethAmount) {
      await send("Wrap ETH", {
        address: addresses.weth,
        abi: erc20Abi,
        functionName: "deposit",
        args: [],
        value: wethAmount - wethBalance,
      });
    }
    await approveErc20(addresses.weth, pool, wethAmount);
    await send("Seed pool", {
      address: pool,
      abi: poolAbi,
      functionName: "addLiquidity",
      args: [verified, wethAmount, 0n, address],
    });
    logActivity(address, "added_liquidity", {
      chainId,
      metadata: { pool, collection, nftCount: verified.length, initial: true },
    });

    setStep(null);
    onCreated(pool);
  }

  async function enableWeth() {
    await send("Enable WETH for pools", {
      address: addresses.poolFactory as Address,
      abi: poolFactoryAbi,
      functionName: "setQuoteToken",
      args: [addresses.weth, true],
    });
    await wethAllowed.refetch();
  }

  function selectPercent(pct: number) {
    setTouched(true);
    setNftCount(Math.ceil((owned.tokenIds.length * pct) / 100));
  }

  return (
    <Panel className="p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Collection address
          </label>
          <input
            value={collection}
            onChange={(e) => {
              setCollection(e.target.value);
              setTouched(false);
            }}
            placeholder="0x…"
            className="numeric mt-1.5 w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
          />
          {collections.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {collections
                .filter((c) => c.maxSupply > 1n)
                .map((c) => (
                  <button
                    key={c.address}
                    onClick={() => {
                      setCollection(c.address);
                      setTouched(false);
                    }}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {c.name || c.symbol}
                  </button>
                ))}
            </div>
          ) : null}
          {isSingle ? (
            <p className="mt-2 text-xs text-warning">
              This contract is a 1/1 NFT. Single NFTs keep their identity and can only be traded on
              the Marketplace — pools require a collection.
            </p>
          ) : null}
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Curve
          </label>
          <select
            value={curve}
            onChange={(e) => setCurve(Number(e.target.value))}
            className="mt-1.5 w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none"
          >
            <option value={0}>Linear</option>
            <option value={1}>Exponential</option>
          </select>
        </div>
        <Field label="Step size (% of starting price)" value={deltaPct} onChange={setDeltaPct} />
        <Field label="LP fee (bps)" value={fee} onChange={setFee} />
      </div>

      {isAddress(collection) && !isSingle ? (
        <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                NFTs to deposit
              </label>
              {owned.tokenIds.length > 0 ? (
                <span className="numeric text-xs text-muted-foreground">
                  you hold {owned.tokenIds.length}
                </span>
              ) : null}
            </div>
            <input
              type="number"
              min={0}
              max={owned.tokenIds.length}
              value={nftCount}
              onChange={(e) => {
                setTouched(true);
                setNftCount(Math.min(Math.max(0, Number(e.target.value)), owned.tokenIds.length));
              }}
              className="numeric mt-1.5 w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
            />
            {owned.tokenIds.length > 0 ? (
              <div className="mt-2 flex gap-1.5">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => selectPercent(pct)}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/60 hover:text-foreground"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                No tokens from this collection in your wallet yet.
              </p>
            )}
          </div>
          <Field label="WETH to deposit" value={weth} onChange={setWeth} />
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-primary/40 bg-primary/10 p-3.5 text-sm">
        <span className="text-muted-foreground">Starting price, set automatically</span>
        <span className="numeric ml-2 font-semibold text-foreground">
          {tokenIds.length > 0
            ? `${formatEther(computedSpot)} WETH / NFT`
            : "— deposit both sides first"}
        </span>
      </div>

      {deployed && wethAllowed.data === false ? (
        <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-semibold text-warning">DEX setup required</p>
          <p className="mt-1 text-muted-foreground">
            WETH is not enabled on this testnet pool factory, so pool creation is paused.
          </p>
          {isFactoryOwner ? (
            <button
              onClick={enableWeth}
              disabled={Boolean(pending)}
              className="mt-3 rounded-lg border border-warning/50 px-3 py-2 text-xs font-semibold text-warning disabled:opacity-40"
            >
              {pending ? "Confirming…" : "Enable WETH"}
            </button>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Connect the wallet that deployed the Pivah contracts to enable it.
            </p>
          )}
        </div>
      ) : null}

      <button
        onClick={create}
        disabled={
          !isConnected ||
          !deployed ||
          !wethAllowed.data ||
          !isAddress(collection) ||
          isSingle ||
          tokenIds.length === 0 ||
          wethAmount === 0n ||
          Boolean(pending) ||
          Boolean(step)
        }
        className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-40"
      >
        {pending || step ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        {step ?? pending ?? "Create pool"}
      </button>
    </Panel>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="numeric mt-1.5 w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
      />
    </div>
  );
}

function CollectionThumb({ address }: { address: Address }) {
  const { image } = useCollectionImage(address);
  return (
    <div className="size-9 shrink-0 overflow-hidden rounded-lg bg-background/60">
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : null}
    </div>
  );
}
