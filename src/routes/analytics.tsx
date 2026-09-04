import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Activity, Wallet, ArrowDownToLine } from "lucide-react";
import { useAccount } from "wagmi";

import {
  PageHeader,
  Panel,
  StatCard,
  SectionTitle,
  EmptyState,
  Badge,
} from "@/components/ui/pivah";
import { formatEth } from "@/lib/pivah/curve";
import {
  useCollections,
  useListings,
  usePools,
  usePivah,
  useFeeManagerBalance,
  useTx,
  type Address,
} from "@/lib/pivah/hooks";
import { feeManagerAbi } from "@/lib/pivah/abis";
import { useIsAdmin } from "@/lib/pivah/admin";

export const DESCRIPTION =
  "Protocol analytics: DEX volume, pool depth, fee revenue, mint activity and marketplace sales across Pivah on Base.";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Volume, Liquidity and Fees | Pivah" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Analytics — Volume, Liquidity and Fees | Pivah" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { pools, isLoading: poolsLoading } = usePools();
  const { collections, isLoading: collectionsLoading } = useCollections();
  const { listings, isLoading: listingsLoading } = useListings();

  const totalLiquidity = pools.reduce((sum, p) => sum + p.quoteReserves, 0n);
  const totalNftInventory = pools.reduce((sum, p) => sum + p.inventory, 0n);
  const listedValue = listings.reduce((sum, l) => sum + l.price, 0n);
  const isLoading = poolsLoading || collectionsLoading || listingsLoading;

  const metrics = [
    {
      label: "Total DEX liquidity",
      value: isLoading ? "…" : `${formatEth(totalLiquidity, 3)} WETH`,
      tone: "primary" as const,
    },
    {
      label: "NFTs in pools",
      value: isLoading ? "…" : String(totalNftInventory),
      tone: "accent" as const,
    },
    {
      label: "Marketplace listed value",
      value: isLoading ? "…" : `${formatEth(listedValue, 3)} WETH`,
      tone: "success" as const,
    },
    {
      label: "Active pools",
      value: isLoading ? "…" : String(pools.length),
      tone: "default" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Protocol" title="Analytics" description={DESCRIPTION} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <StatCard key={m.label} label={m.label} value={m.value} tone={m.tone} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="p-5">
          <SectionTitle title="Volume" hint="Last 30 days" />
          <div className="grid h-56 place-items-center rounded-xl border border-dashed border-border bg-background/40 text-center">
            <div>
              <BarChart3 className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold">No historical data yet</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Current liquidity and pool depth above are live on-chain reads. Time-series volume
                needs an event indexer watching Buy/Sell/Sold events over time — that's a separate
                infrastructure piece, not built yet.
              </p>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Collections</h2>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-xs text-muted-foreground">Deployed collections</span>
              <span className="numeric text-xs font-medium">
                {isLoading ? "…" : collections.length}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs text-muted-foreground">With an active DEX pool</span>
              <span className="numeric text-xs font-medium">{isLoading ? "…" : pools.length}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs text-muted-foreground">Active marketplace listings</span>
              <span className="numeric text-xs font-medium">
                {isLoading ? "…" : listings.length}
              </span>
            </div>
          </div>
        </Panel>
      </div>

      <section>
        <SectionTitle title="Pools by liquidity" hint="Live snapshot, not historical volume" />
        {pools.length === 0 ? (
          <EmptyState
            title="Nothing to rank yet"
            description="Once collections deploy pools, this table ranks them by liquidity depth."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...pools]
              .sort((a, b) => (b.quoteReserves > a.quoteReserves ? 1 : -1))
              .map((p) => (
                <Panel key={p.address} className="p-4">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="numeric mt-2 text-lg font-bold text-primary">
                    {formatEth(p.quoteReserves, 4)} WETH
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {String(p.inventory)} NFTs · {formatEth(p.spotPrice, 5)} WETH spot
                  </p>
                </Panel>
              ))}
          </div>
        )}
      </section>

      <FeeSweepPanel />
    </div>
  );
}

/**
 * Protocol fees accrue inside the FeeManager contract on every trade — they
 * don't move to the treasury automatically. sweep() is what pushes the
 * balance out. Restricted to admin wallets in the UI (see admin.ts) — not
 * because the contract requires it (sweep is intentionally callable by
 * anyone, the destination is fixed regardless of caller), but because
 * regular visitors don't need to see internal protocol mechanics.
 */
function FeeSweepPanel() {
  const isAdmin = useIsAdmin();
  const { address, isConnected } = useAccount();
  const { addresses } = usePivah();
  const { balance, isLoading, refetch } = useFeeManagerBalance();
  const { send, pending } = useTx();

  const hasBalance = balance > 0n;

  async function sweep() {
    if (!hasBalance) return;
    await send("Sweep fees to treasury", {
      address: addresses.feeManager as Address,
      abi: feeManagerAbi,
      functionName: "sweep",
      args: [addresses.weth as Address],
    });
    refetch();
  }

  if (!isAdmin) return null;

  return (
    <section>
      <SectionTitle title="Protocol fees" hint="Accrue in the FeeManager, then sweep to treasury" />
      <Panel className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <Wallet className="size-5 text-primary" />
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Unswept balance (WETH)
            </p>
            <p className="numeric text-xl font-bold">{isLoading ? "…" : formatEth(balance, 6)}</p>
          </div>
        </div>
        {!hasBalance && !isLoading ? (
          <Badge tone="muted">Nothing to sweep</Badge>
        ) : (
          <button
            onClick={sweep}
            disabled={!isConnected || !hasBalance || Boolean(pending)}
            className="flex items-center gap-2 rounded-xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowDownToLine className="size-4" />
            {pending || "Sweep to treasury"}
          </button>
        )}
      </Panel>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Anyone can trigger a sweep — the destination is fixed to the treasury address regardless of
        who calls it, so this never needs to be you specifically.
      </p>
    </section>
  );
}
