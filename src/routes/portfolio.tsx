import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet, Droplets, Images, Coins, ArrowDownToLine } from "lucide-react";
import { useAccount } from "wagmi";
import { toast } from "sonner";

import {
  PageHeader,
  Panel,
  StatCard,
  EmptyState,
  SectionTitle,
  Badge,
} from "@/components/ui/pivah";
import { formatEth } from "@/lib/pivah/curve";
import { usePivah, usePortfolio, useWethBalance, useTx, type Address } from "@/lib/pivah/hooks";
import { erc20Abi } from "@/lib/pivah/abis";

export const DESCRIPTION =
  "Every Pivah position in one place: NFTs held, LP shares per collection pool, staked PIVAH and unclaimed fees.";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — Your NFTs, LP and Stake | Pivah" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Portfolio — Your NFTs, LP and Stake | Pivah" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const { isConnected } = useAccount();
  const { deployed } = usePivah();
  const { heldCollections, lpPositions, nftsHeld, nftsStaked, pendingRewards, isLoading } =
    usePortfolio();

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Account" title="Portfolio" description={DESCRIPTION} />
        <EmptyState
          title="Connect a wallet"
          description="Your NFTs, LP shares and staked NFTs will show up here — read directly from chain, nothing custodied."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Portfolio"
        description={DESCRIPTION}
        actions={
          !deployed ? (
            <Badge tone="warning">Contracts not deployed on this network</Badge>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="NFTs held"
          value={isLoading ? "…" : String(nftsHeld)}
          sub={`across ${heldCollections.length} collection${heldCollections.length === 1 ? "" : "s"}`}
          tone="accent"
        />
        <StatCard
          label="LP positions"
          value={isLoading ? "…" : String(lpPositions.length)}
          tone="success"
        />
        <StatCard label="NFTs staked" value={isLoading ? "…" : String(nftsStaked)} />
        <StatCard
          label="Claimable PIVAH"
          value={isLoading ? "…" : formatEth(pendingRewards, 4)}
          tone="primary"
        />
      </div>

      <WethBalancePanel />

      <section>
        <SectionTitle title="NFTs" hint="Across all Pivah collections" />
        {heldCollections.length === 0 ? (
          <EmptyState
            title="No NFTs found"
            description="Anything you own from a Pivah pool's collection can be sold instantly into that pool."
            action={
              <Link
                to="/dex"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
              >
                <Images className="size-4" />
                Open the DEX
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {heldCollections.map((c) => (
              <Panel key={c.address} className="p-4">
                <p className="numeric text-xs text-muted-foreground">
                  {c.address.slice(0, 8)}…{c.address.slice(-4)}
                </p>
                <p className="mt-1 text-base font-semibold">{c.name}</p>
                <p className="numeric mt-2 text-2xl font-bold text-primary">{String(c.balance)}</p>
                <p className="text-xs text-muted-foreground">
                  token{c.balance === 1n ? "" : "s"} held
                </p>
                <Link
                  to="/marketplace"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-surface-raised"
                >
                  List on Marketplace
                </Link>
              </Panel>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle title="Liquidity positions" hint="LP shares appreciate as fees accrue" />
        {lpPositions.length === 0 ? (
          <EmptyState
            title="No LP positions"
            description="Deposit NFTs and WETH into a collection pool to earn a cut of every trade on both sides of the book."
            action={
              <Link
                to="/dex/liquidity"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm font-semibold"
              >
                <Droplets className="size-4" />
                Add liquidity
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lpPositions.map((p) => (
              <Panel key={p.address} className="p-4">
                <p className="text-base font-semibold">{p.name}</p>
                <p className="numeric text-xs text-muted-foreground">
                  {p.address.slice(0, 8)}…{p.address.slice(-4)}
                </p>
                <p className="numeric mt-2 text-lg font-semibold text-success">
                  {formatEth(p.lpBalance, 4)} LP
                </p>
                <Link
                  to="/dex/liquidity"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-surface-raised"
                >
                  Manage
                </Link>
              </Panel>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle title="Staking" />
        {nftsStaked === 0 && pendingRewards === 0n ? (
          <EmptyState
            title="Nothing staked"
            description="Stake NFTs from any collection to earn PIVAH continuously — no lock-up, unstake anytime."
            action={
              <Link
                to="/stake"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm font-semibold"
              >
                <Coins className="size-4" />
                Go to staking
              </Link>
            }
          />
        ) : (
          <Panel className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <p className="numeric text-xl font-bold">
                {nftsStaked} NFT{nftsStaked === 1 ? "" : "s"} staked
              </p>
              <p className="text-xs text-muted-foreground">
                {formatEth(pendingRewards, 4)} PIVAH claimable
              </p>
            </div>
            <Link
              to="/stake"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              Manage stake
            </Link>
          </Panel>
        )}
      </section>

      <Panel className="flex items-start gap-3 p-4 text-xs leading-relaxed text-muted-foreground">
        <Wallet className="mt-0.5 size-4 shrink-0 text-primary" />
        Portfolio data is read directly from chain — Pivah never custodies your assets.
      </Panel>
    </div>
  );
}

/** Marketplace sale proceeds land as WETH automatically — the seller never
 *  signs a transaction at the moment of sale (the buyer's transaction is
 *  what delivers it), so unlike buying, there's no single moment to
 *  auto-convert. This gives sellers a one-click way to do it themselves
 *  whenever they check their portfolio, without needing to understand
 *  WETH or find the token contract on BaseScan. */
function WethBalancePanel() {
  const { addresses } = usePivah();
  const { balance, isLoading, refetch } = useWethBalance();
  const { send, pending } = useTx();
  const hasBalance = balance > 0n;

  async function convert() {
    if (!hasBalance) return;
    await send("Convert WETH to ETH", {
      address: addresses.weth as Address,
      abi: erc20Abi,
      functionName: "withdraw",
      args: [balance],
    });
    toast.success("Converted to ETH");
    refetch();
  }

  if (!isLoading && !hasBalance) return null;

  return (
    <Panel className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex items-center gap-3">
        <ArrowDownToLine className="size-5 text-primary" />
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">WETH balance</p>
          <p className="numeric text-xl font-bold">{isLoading ? "…" : formatEth(balance, 6)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Marketplace sale proceeds land here as WETH — convert anytime.
          </p>
        </div>
      </div>
      {hasBalance ? (
        <button
          onClick={convert}
          disabled={Boolean(pending)}
          className="flex items-center gap-2 rounded-xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowDownToLine className="size-4" />
          {pending || "Convert to ETH"}
        </button>
      ) : null}
    </Panel>
  );
}
