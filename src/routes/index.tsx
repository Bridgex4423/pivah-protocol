import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Repeat, Palette, Store, Coins } from "lucide-react";

import { PageHeader, Panel, StatCard, Badge, SectionTitle } from "@/components/ui/pivah";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { usePools, useListings } from "@/lib/pivah/hooks";
import { formatEther } from "viem";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pivah Protocol — NFT Liquidity Infrastructure on Base" },
      {
        name: "description",
        content:
          "Pivah makes NFTs trade like tokens. Create, mint, list, and trade NFTs against collection liquidity pools with a DEX-grade experience on Base.",
      },
      { property: "og:title", content: "Pivah Protocol — NFT Liquidity Infrastructure" },
      {
        property: "og:description",
        content:
          "NFT Creator Studio, Mint, Marketplace, DEX, liquidity pools and staking inside one protocol.",
      },
    ],
  }),
  component: Overview,
});

const modules = [
  {
    to: "/creator" as const,
    icon: Palette,
    title: "Creator Studio",
    body: "Deploy a collection in minutes — one shared image or unique generative traits, your call.",
  },
  {
    to: "/dex" as const,
    icon: Repeat,
    title: "Pivah DEX",
    body: "Buy, sell and swap NFTs instantly against collection liquidity pools priced by bonding curves.",
  },
  {
    to: "/marketplace" as const,
    icon: Store,
    title: "Marketplace",
    body: "Classic peer-to-peer listings when you want an exact price for one exact token.",
  },
  {
    to: "/stake" as const,
    icon: Coins,
    title: "Stake",
    body: "Stake NFTs from any collection to earn PIVAH continuously — no lock-up, unstake anytime.",
  },
];

function Overview() {
  const { pools } = usePools();
  const { listings } = useListings();
  const totalLiquidity = pools.reduce((sum, p) => sum + p.quoteReserves, 0n);
  const listedValue = listings.reduce((sum, l) => sum + l.price, 0n);
  const marketplaceCollections = new Set(listings.map((l) => l.collection)).size;

  return (
    <div className="space-y-8">
      <Panel className="relative overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-glow" />
        <div className="relative max-w-2xl">
          <Badge tone="primary">Base · Base Sepolia</Badge>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-5xl">
            Make NFTs trade <span className="text-brand-gradient">like tokens</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Traditional marketplaces make liquidity depend on finding one specific buyer. Pivah adds
            collection-level liquidity pools so any eligible NFT can be bought or sold instantly
            against on-chain inventory and WETH.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
            >
              Browse Marketplace <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/dex"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold transition-colors hover:bg-surface-raised"
            >
              Launch DEX
            </Link>
            <Link
              to="/creator/new"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold transition-colors hover:bg-surface-raised"
            >
              Mint NFTs
            </Link>
            <SocialLinks className="ml-1" />
          </div>
        </div>
      </Panel>

      <section>
        <SectionTitle title="Marketplace statistics" hint="Live" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Active listings" value={String(listings.length)} tone="primary" />
          <StatCard
            label="Listed value"
            value={`${Number(formatEther(listedValue)).toFixed(3)} WETH`}
            tone="accent"
          />
          <StatCard label="Collections" value={String(marketplaceCollections)} />
          <StatCard label="Protocol fee" value="0.5%" sub="set by FeeManager" tone="success" />
        </div>
      </section>

      <section>
        <SectionTitle title="DEX statistics" hint="Live · 24h figures pending event indexer" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Total pool liquidity"
            value={`${Number(formatEther(totalLiquidity)).toFixed(3)} WETH`}
            sub="NFT + WETH"
            tone="primary"
          />
          <StatCard label="24h DEX volume" value="—" tone="accent" />
          <StatCard label="Active pools" value={String(pools.length)} />
          <StatCard label="Protocol fees (24h)" value="—" tone="success" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Total liquidity and active pools are read live from the chain right now. 24h volume and
          fees need the event indexer described in the architecture doc — those stay blank rather
          than showing invented numbers.
        </p>
      </section>

      <section>
        <SectionTitle title="Modules" />
        <div className="grid gap-3 sm:grid-cols-2">
          {modules.map((m) => (
            <Link key={m.to} to={m.to} className="group">
              <Panel className="h-full p-5 transition-colors group-hover:border-primary/50">
                <div className="flex items-start gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                    <m.icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{m.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
                  </div>
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      </section>

      <Panel className="p-5">
        <SectionTitle title="Marketplace is not the DEX" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background/40 p-4">
            <Badge>Marketplace</Badge>
            <p className="mt-3 text-sm text-muted-foreground">
              &ldquo;I own NFT #431 and want exactly 2 ETH.&rdquo; The seller sets the price and
              waits for a buyer of that exact token.
            </p>
          </div>
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
            <Badge tone="primary">DEX</Badge>
            <p className="mt-3 text-sm text-muted-foreground">
              &ldquo;I want to sell my eligible collection NFT now.&rdquo; The pool quotes a price
              from its curve and settles immediately.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
