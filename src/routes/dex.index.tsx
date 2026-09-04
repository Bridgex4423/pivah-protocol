import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDown, Search, Settings2, Info, Loader2, TrendingUp } from "lucide-react";
import { formatEther, isAddress } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Panel, Badge, EmptyState } from "@/components/ui/pivah";
import { poolAbi, routerAbi } from "@/lib/pivah/abis";
import { logActivity } from "@/lib/pivah/activity";
import {
  deadline,
  useCollections,
  useNftApproval,
  useOwnedTokens,
  usePivah,
  usePoolPriceHistory,
  usePools,
  useTx,
  type Address,
  type PoolSummary,
} from "@/lib/pivah/hooks";
import { withSlippage } from "@/lib/pivah/curve";

export const Route = createFileRoute("/dex/")({
  validateSearch: (search: Record<string, unknown>): { pool?: string; collection?: string } => ({
    ...(typeof search["pool"] === "string" ? { pool: search["pool"] } : {}),
    ...(typeof search["collection"] === "string" ? { collection: search["collection"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Pivah DEX — Instantly Buy, Sell and Swap NFTs" },
      {
        name: "description",
        content:
          "Trade NFTs against collection liquidity pools. Bonding-curve pricing, live quotes, slippage protection and instant settlement — no waiting for a buyer.",
      },
      { property: "og:title", content: "Pivah DEX — Instant NFT Liquidity" },
      {
        property: "og:description",
        content: "Buy, sell and swap NFTs against on-chain collection liquidity on Base.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DexPage,
});

type Mode = "buy" | "sell";

function DexPage() {
  const { pool: poolParam, collection: collectionParam } = Route.useSearch();
  const { pools, isLoading, refetch } = usePools();
  const [selected, setSelected] = useState<Address | null>(null);
  const [query, setQuery] = useState(collectionParam ?? "");

  const active = useMemo(
    () => pools.find((p) => p.address === (selected ?? poolParam)) ?? pools[0] ?? null,
    [pools, selected, poolParam],
  );

  const q = query.trim().toLowerCase();
  const filteredPools = useMemo(() => {
    if (!q) return pools;
    return pools.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.collection.toLowerCase() === q ||
        p.address.toLowerCase() === q,
    );
  }, [pools, q]);

  // A full, valid address with no pool yet — offer to create one directly,
  // even for a collection Pivah has never seen (no whitelist, anywhere).
  const pastedNoPool =
    isAddress(query.trim()) && !pools.some((p) => p.collection.toLowerCase() === q) && query.trim();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">DEX</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Swap</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Buy and sell NFTs instantly against collection liquidity. Pricing steps along the pool's
          bonding curve, and quotes come straight from the contract.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Paste a collection address, or search by name or pool address…"
          className="numeric w-full rounded-xl border border-border bg-background/60 py-3 pl-10 pr-4 text-sm outline-none focus:border-primary/60"
        />
      </div>

      {isLoading ? (
        <Panel className="p-10 text-center text-sm text-muted-foreground">Loading pools…</Panel>
      ) : pastedNoPool ? (
        <Panel className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <p className="text-sm font-semibold">No pool for this collection yet</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            This works for any ERC-721 collection, whether it was created through Pivah or not.
            Create the first pool and trading opens here instantly.
          </p>
          <Link
            to="/dex/pools"
            search={{ collection: query.trim(), create: true }}
            className="mt-1 inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            Create a pool
          </Link>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,460px)_1fr]">
          {active ? (
            <SwapCard pool={active} onDone={refetch} />
          ) : pools.length === 0 ? (
            <SwapPreview />
          ) : (
            <Panel className="p-10 text-center text-sm text-muted-foreground">
              No pool matches "{query}"
            </Panel>
          )}
          <div className="space-y-4">
            <PriceChart pool={active} />
            <Panel className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Select pool
                </p>
                {pools.length > 0 ? (
                  <span className="numeric text-xs text-muted-foreground">
                    {filteredPools.length} of {pools.length}
                  </span>
                ) : null}
              </div>
              {pools.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Nothing here yet — pools you or others create will show up in this list.
                </p>
              ) : filteredPools.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">No match for "{query}"</p>
              ) : (
                <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                  {filteredPools.map((p) => (
                    <button
                      key={p.address}
                      onClick={() => setSelected(p.address)}
                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${
                        active && p.address === active.address
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background/40"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        <p className="numeric text-xs text-muted-foreground">
                          {String(p.inventory)} NFTs ·{" "}
                          {Number(formatEther(p.quoteReserves)).toFixed(3)} WETH
                        </p>
                      </div>
                      {p.inventory === 0n && p.quoteReserves === 0n ? (
                        <Badge tone="warning">Empty</Badge>
                      ) : (
                        <Badge tone={p.curve === 0 ? "primary" : "accent"}>
                          {p.curve === 0 ? "Linear" : "Exp"}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}

      <PoolAvailability pools={pools} query={query} />
    </div>
  );
}

/** Shows, per collection, whether a tradable pool exists and how deep it is.
 *  Filters against the same search box above so this stays usable at any
 *  scale — with a handful of collections or several hundred. */
function PriceChart({ pool }: { pool: PoolSummary | null }) {
  const { data: history, isLoading } = usePoolPriceHistory(pool?.address);

  if (!pool) return null;

  const points = (history ?? []).map((p) => ({
    t: p.timestamp * 1000,
    price: Number(formatEther(p.price)),
  }));

  const first = points[0]?.price;
  const last = points[points.length - 1]?.price;
  const changePct = first && last && first > 0 ? ((last - first) / first) * 100 : null;

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Price · last 7 days
          </p>
        </div>
        {changePct !== null ? (
          <Badge tone={changePct >= 0 ? "success" : "warning"}>
            {changePct >= 0 ? "+" : ""}
            {changePct.toFixed(1)}%
          </Badge>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
          Reading trade history from chain…
        </div>
      ) : points.length < 2 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-1 text-center">
          <p className="text-xs text-muted-foreground">Not enough trades yet for a chart</p>
          <p className="numeric text-lg font-bold">{formatEther(pool.spotPrice)} WETH</p>
          <p className="text-xs text-muted-foreground">current spot price</p>
        </div>
      ) : (
        <div className="mt-3 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: "#0f0f16",
                  border: "1px solid rgba(124,58,237,0.35)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
                formatter={(value: number) => [`${value.toFixed(5)} WETH`, "Price"]}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#a78bfa"
                strokeWidth={2}
                fill="url(#priceFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

function PoolAvailability({ pools, query }: { pools: PoolSummary[]; query: string }) {
  const { collections, isLoading } = useCollections();
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      !q
        ? collections
        : collections.filter(
            (c) => c.name.toLowerCase().includes(q) || c.address.toLowerCase() === q,
          ),
    [collections, q],
  );

  if (isLoading || collections.length === 0) return null;

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pool availability
        </p>
        <p className="numeric text-xs text-muted-foreground">
          {pools.length} of {collections.length} collections have a pool
          {q ? ` · ${filtered.length} match "${query}"` : ""}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No collection matches "{query}"</p>
      ) : (
        <div className="mt-3 grid max-h-[32rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {filtered.map((c) => {
            const pool = pools.find((p) => p.collection.toLowerCase() === c.address.toLowerCase());
            const funded = pool && (pool.inventory > 0n || pool.quoteReserves > 0n);
            return (
              <div
                key={c.address}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="numeric text-xs text-muted-foreground">
                    {pool
                      ? `${String(pool.inventory)} NFTs · ${Number(
                          formatEther(pool.quoteReserves),
                        ).toFixed(3)} WETH`
                      : "No pool yet"}
                  </p>
                </div>
                {funded ? (
                  <Badge tone="success">Tradable</Badge>
                ) : pool ? (
                  <Link
                    to="/dex/liquidity"
                    search={{ pool: pool.address }}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold"
                  >
                    Add liquidity
                  </Link>
                ) : (
                  <Link
                    to="/dex/pools"
                    search={{ collection: c.address, create: true }}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold"
                  >
                    Create pool
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/**
 * Shows the real swap form's shape — Buy/Sell toggle, pay/receive fields,
 * fee breakdown — before any pool exists, so new visitors immediately see
 * what trading looks like on Pivah instead of just an empty-state message.
 * Fully static: no pool to read from yet, so nothing here is wired up.
 */
function SwapPreview() {
  const [mode, setMode] = useState<Mode>("buy");
  return (
    <Panel className="p-5 opacity-90">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-xl border border-border bg-background/50 p-1">
          {(["buy", "sell"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize ${
                mode === m ? "bg-brand-gradient text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <Settings2 className="size-4 text-muted-foreground" />
      </div>

      <div className="mt-4 space-y-2">
        <div className="rounded-2xl border border-border bg-background/50 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {mode === "buy" ? "You pay (ETH)" : "You sell (NFTs)"}
          </p>
          <p className="numeric mt-2 text-2xl font-semibold text-muted-foreground">0.00000</p>
        </div>
        <div className="flex justify-center">
          <div className="rounded-full border border-border bg-surface p-2">
            <ArrowDown className="size-4 text-muted-foreground" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-background/50 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {mode === "buy" ? "You receive (NFTs)" : "You receive (ETH)"}
          </p>
          <p className="numeric mt-2 text-2xl font-semibold text-muted-foreground">0</p>
          <p className="numeric mt-1 text-xs text-muted-foreground">max available: —</p>
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 rounded-xl border border-border bg-background/40 p-3 text-xs">
        <Row label="Spot price" value="— WETH" />
        <Row label="Fee" value="— WETH" />
        <Row label={mode === "buy" ? "Max input" : "Min output"} value="— WETH" />
      </dl>

      <Link
        to="/dex/pools"
        search={{ create: true }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow"
      >
        Create the first pool to start trading
      </Link>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
        This is exactly what trading will look like — create a pool and seed it with NFTs + WETH to
        bring it to life.
      </p>
    </Panel>
  );
}

function SwapCard({ pool, onDone }: { pool: PoolSummary; onDone: () => void }) {
  const { address, isConnected, chainId } = useAccount();
  const { addresses } = usePivah();
  const { send, pending } = useTx();
  const approveNfts = useNftApproval();
  const owned = useOwnedTokens(pool.collection);

  const [mode, setMode] = useState<Mode>("buy");
  const [count, setCount] = useState(1);
  const [slippageBps, setSlippageBps] = useState(50n);
  const [showSettings, setShowSettings] = useState(false);

  const poolInventory = useReadContract({
    address: pool.address,
    abi: poolAbi,
    functionName: "allInventory",
    query: { refetchInterval: 15_000 },
  });

  const quote = useReadContract({
    address: pool.address,
    abi: poolAbi,
    functionName: mode === "buy" ? "quoteBuy" : "quoteSell",
    args: [BigInt(Math.max(count, 1))],
    query: { refetchInterval: 10_000 },
  });

  const [total, lpFee, protocolFee] = (quote.data as readonly [bigint, bigint, bigint]) ?? [
    0n,
    0n,
    0n,
  ];

  const limit = withSlippage(total, slippageBps, mode === "buy" ? "max" : "min");

  const poolTokenIds = ((poolInventory.data as readonly bigint[]) ?? []).slice(0, count);
  const sellTokenIds = owned.tokenIds.slice(0, count);

  const maxCount = mode === "buy" ? Number(pool.inventory) : owned.tokenIds.length;

  async function trade() {
    if (!address) return;
    const router = addresses.router as Address;
    if (mode === "buy") {
      const receipt = await send("Buy NFTs", {
        address: router,
        abi: routerAbi,
        functionName: "buyWithETH",
        args: [pool.address, poolTokenIds, address, deadline()],
        value: limit,
      });
      logActivity(address, "swap_buy", {
        chainId,
        txHash: receipt?.transactionHash,
        metadata: { pool: pool.address, collection: pool.collection, count: poolTokenIds.length },
      });
    } else {
      await approveNfts(pool.collection, router);
      const receipt = await send("Sell NFTs", {
        address: router,
        abi: routerAbi,
        functionName: "sellForETH",
        args: [pool.address, sellTokenIds, limit, address, deadline()],
      });
      logActivity(address, "swap_sell", {
        chainId,
        txHash: receipt?.transactionHash,
        metadata: { pool: pool.address, collection: pool.collection, count: sellTokenIds.length },
      });
    }
    owned.refetch();
    void quote.refetch();
    void poolInventory.refetch();
    onDone();
  }

  const disabled =
    !isConnected ||
    Boolean(pending) ||
    count < 1 ||
    (mode === "buy" ? poolTokenIds.length < count : sellTokenIds.length < count);

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-xl border border-border bg-background/50 p-1">
          {(["buy", "sell"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize ${
                mode === m ? "bg-brand-gradient text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="rounded-lg border border-border p-2 text-muted-foreground"
          aria-label="Swap settings"
        >
          <Settings2 className="size-4" />
        </button>
      </div>

      {showSettings ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-background/40 p-3">
          <span className="text-xs text-muted-foreground">Slippage</span>
          {[10n, 50n, 100n, 300n].map((bps) => (
            <button
              key={String(bps)}
              onClick={() => setSlippageBps(bps)}
              className={`numeric rounded-lg px-2.5 py-1 text-xs ${
                slippageBps === bps ? "bg-primary/20 text-primary" : "text-muted-foreground"
              }`}
            >
              {Number(bps) / 100}%
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        <div className="rounded-2xl border border-border bg-background/50 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {mode === "buy" ? "You pay (ETH)" : "You sell (NFTs)"}
          </p>
          {mode === "buy" ? (
            <p className="numeric mt-2 text-2xl font-semibold">
              {Number(formatEther(total)).toFixed(5)}
            </p>
          ) : (
            <input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
              className="numeric mt-2 w-full bg-transparent text-2xl font-semibold outline-none"
            />
          )}
        </div>

        <div className="flex justify-center">
          <div className="rounded-full border border-border bg-surface p-2">
            <ArrowDown className="size-4 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/50 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {mode === "buy" ? "You receive (NFTs)" : "You receive (ETH)"}
          </p>
          {mode === "buy" ? (
            <input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
              className="numeric mt-2 w-full bg-transparent text-2xl font-semibold outline-none"
            />
          ) : (
            <p className="numeric mt-2 text-2xl font-semibold">
              {Number(formatEther(total)).toFixed(5)}
            </p>
          )}
          <p className="numeric mt-1 text-xs text-muted-foreground">max available: {maxCount}</p>
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 rounded-xl border border-border bg-background/40 p-3 text-xs">
        <Row label="Spot price" value={`${Number(formatEther(pool.spotPrice)).toFixed(5)} WETH`} />
        <Row label="Fee" value={`${Number(formatEther(lpFee + protocolFee)).toFixed(5)} WETH`} />
        <Row
          label={mode === "buy" ? "Max input" : "Min output"}
          value={`${Number(formatEther(limit)).toFixed(5)} WETH`}
        />
      </dl>

      <button
        onClick={trade}
        disabled={disabled}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-40"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {!isConnected ? "Connect wallet" : mode === "buy" ? "Buy from pool" : "Sell to pool"}
      </button>

      <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Quotes are read live from the pool contract; the transaction reverts if price moves past
          your slippage bound.
        </span>
      </div>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="numeric">{value}</dd>
    </div>
  );
}
