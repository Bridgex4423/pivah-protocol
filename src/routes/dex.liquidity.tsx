import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { formatEther, parseEther } from "viem";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { toast } from "sonner";

import { PageHeader, Panel, Badge, StatCard, EmptyState } from "@/components/ui/pivah";
import { erc20Abi, erc721Abi, poolAbi } from "@/lib/pivah/abis";
import { logActivity } from "@/lib/pivah/activity";
import {
  useErc20Approval,
  useNftApproval,
  useOwnedTokens,
  usePivah,
  usePools,
  useTx,
  type Address,
  type PoolSummary,
} from "@/lib/pivah/hooks";

export const DESCRIPTION =
  "Deposit NFTs and WETH into a collection pool to earn trading fees, or withdraw your share at any time. Works like a PancakeSwap pair — one side is just non-fungible.";

export const Route = createFileRoute("/dex/liquidity")({
  validateSearch: (search: Record<string, unknown>): { pool?: string } =>
    typeof search["pool"] === "string" ? { pool: search["pool"] } : {},
  head: () => ({
    meta: [
      { title: "Add & Withdraw Liquidity — Pivah DEX" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Add & Withdraw Liquidity — Pivah DEX" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiquidityPage,
});

function LiquidityPage() {
  const search = Route.useSearch();
  const { pools, isLoading, refetch } = usePools();
  const [selected, setSelected] = useState<Address | null>(
    search.pool?.startsWith("0x") ? (search.pool as Address) : null,
  );

  const active = useMemo(
    () => pools.find((p) => p.address === selected) ?? pools[0] ?? null,
    [pools, selected],
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="DEX" title="Liquidity" description={DESCRIPTION} />

      {isLoading ? (
        <Panel className="p-10 text-center text-sm text-muted-foreground">Loading pools…</Panel>
      ) : !active ? (
        <EmptyState
          title="No pools to provide liquidity to"
          description="Create a pool first from the Pools page, then come back to seed it with NFTs and WETH."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,420px)]">
          <div className="space-y-4">
            <Panel className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Select pool
              </p>
              <div className="mt-3 space-y-2">
                {pools.map((p) => (
                  <button
                    key={p.address}
                    onClick={() => setSelected(p.address)}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${
                      p.address === active.address
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
                    <Badge tone={p.curve === 0 ? "primary" : "accent"}>
                      {p.curve === 0 ? "Linear" : "Exp"}
                    </Badge>
                  </button>
                ))}
              </div>
            </Panel>
            <PoolStats pool={active} />
          </div>
          <LiquidityCard pool={active} onDone={refetch} />
        </div>
      )}
    </div>
  );
}

function PoolStats({ pool }: { pool: PoolSummary }) {
  const totalSupply = useReadContract({
    address: pool.address,
    abi: poolAbi,
    functionName: "totalSupply",
    query: { refetchInterval: 15_000 },
  });
  const sharePrice = useReadContract({
    address: pool.address,
    abi: poolAbi,
    functionName: "sharePrice",
    query: { refetchInterval: 15_000 },
  });

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Inventory" value={String(pool.inventory)} />
      <StatCard
        label="WETH reserves"
        value={Number(formatEther(pool.quoteReserves)).toFixed(3)}
        tone="accent"
      />
      <StatCard
        label="LP shares"
        value={Number(formatEther((totalSupply.data as bigint) ?? 0n)).toFixed(3)}
      />
      <StatCard
        label="Share price"
        value={Number(formatEther((sharePrice.data as bigint) ?? 0n)).toFixed(5)}
        tone="primary"
      />
    </div>
  );
}

function LiquidityCard({ pool, onDone }: { pool: PoolSummary; onDone: () => void }) {
  const { address, isConnected, chainId } = useAccount();
  const { addresses } = usePivah();
  const { send, pending } = useTx();
  const publicClient = usePublicClient();
  const approveNfts = useNftApproval();
  const approveErc20 = useErc20Approval();
  const owned = useOwnedTokens(pool.collection);

  const [tab, setTab] = useState<"add" | "withdraw">("add");
  const [nftCount, setNftCount] = useState(0);
  const [touched, setTouched] = useState(false);
  const [weth, setWeth] = useState("0");
  const [sharesPct, setSharesPct] = useState(50);
  const [checking, setChecking] = useState(false);

  const totalSupply = useReadContract({
    address: pool.address,
    abi: poolAbi,
    functionName: "totalSupply",
    query: { refetchInterval: 15_000 },
  });
  const isVirginPool = totalSupply.data === 0n;

  // Seeding a pool only works if the NFTs actually move, so default the deposit
  // to everything the creator holds until they change it themselves.
  useEffect(() => {
    if (!touched) setNftCount(owned.tokenIds.length);
  }, [owned.tokenIds.length, touched]);

  const shares = useReadContract({
    address: pool.address,
    abi: poolAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });

  const userShares = (shares.data as bigint) ?? 0n;
  const wethAmount = parseEther(weth || "0");
  const tokenIds = owned.tokenIds.slice(0, nftCount);
  const needsBothSides = isVirginPool && (tokenIds.length === 0 || wethAmount === 0n);

  function selectPercent(pct: number) {
    setTouched(true);
    setNftCount(Math.ceil((owned.tokenIds.length * pct) / 100));
  }

  async function addLiquidity() {
    if (!address || !publicClient) return;
    if (needsBothSides) {
      toast.error(
        "First deposit into this pool needs both NFTs and WETH — that ratio sets the starting price",
      );
      return;
    }
    if (touched && tokenIds.length !== nftCount) {
      toast.error("NFT list hasn't finished loading — wait a moment and try again");
      return;
    }

    // Re-verify ownership right before submitting — the wallet's token list
    // can go stale between page load and click (e.g. one of these was just
    // sold or listed elsewhere), and a single invalid id reverts the whole
    // deposit.
    setChecking(true);
    let verified: bigint[];
    try {
      const results = await Promise.all(
        tokenIds.map(async (id) => {
          try {
            const owner = await publicClient.readContract({
              address: pool.collection,
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
      verified = results.filter((id): id is bigint => id !== null);
    } finally {
      setChecking(false);
    }
    if (verified.length < tokenIds.length && tokenIds.length > 0) {
      toast.message(
        `${tokenIds.length - verified.length} selected token(s) already moved — depositing the remaining ${verified.length}`,
      );
    }

    if (verified.length > 0) await approveNfts(pool.collection, pool.address);
    if (wethAmount > 0n) {
      await wrapIfNeeded(wethAmount);
      await approveErc20(pool.quoteToken, pool.address, wethAmount);
    }
    const receipt = await send("Add liquidity", {
      address: pool.address,
      abi: poolAbi,
      functionName: "addLiquidity",
      args: [verified, wethAmount, 0n, address],
    });
    logActivity(address, "added_liquidity", {
      chainId,
      txHash: receipt?.transactionHash,
      metadata: { pool: pool.address, collection: pool.collection, nftCount: verified.length },
    });
    toast.success(
      `Deposited ${verified.length} NFT${verified.length === 1 ? "" : "s"}${
        wethAmount > 0n ? ` + ${formatEther(wethAmount)} WETH` : ""
      }`,
    );
    setTouched(false);
    finish();
  }

  /** Wrap only the shortfall so an already-wrapped balance costs no extra tx. */
  async function wrapIfNeeded(amount: bigint) {
    if (pool.quoteToken.toLowerCase() !== addresses.weth.toLowerCase()) return;
    if (!address || !publicClient) return;
    const balance = (await publicClient.readContract({
      address: pool.quoteToken,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    })) as bigint;
    if (balance >= amount) return;
    await send("Wrap ETH", {
      address: pool.quoteToken,
      abi: erc20Abi,
      functionName: "deposit",
      args: [],
      value: amount - balance,
    });
  }

  async function withdraw() {
    if (!address) return;
    const amount = (userShares * BigInt(sharesPct)) / 100n;
    const receipt = await send("Withdraw liquidity", {
      address: pool.address,
      abi: poolAbi,
      functionName: "removeLiquidity",
      args: [amount, 0n, 0n, address],
    });
    logActivity(address, "removed_liquidity", {
      chainId,
      txHash: receipt?.transactionHash,
      metadata: { pool: pool.address, sharesPct },
    });
    finish();
  }

  function finish() {
    void shares.refetch();
    owned.refetch();
    onDone();
  }

  return (
    <Panel className="p-5">
      <div className="inline-flex rounded-xl border border-border bg-background/50 p-1">
        {(
          [
            ["add", "Add"],
            ["withdraw", "Withdraw"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${
              tab === key ? "bg-brand-gradient text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "add" ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-border bg-background/50 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              NFTs to deposit
            </p>
            <input
              type="number"
              min={0}
              max={owned.tokenIds.length}
              value={nftCount}
              onChange={(e) => {
                setTouched(true);
                setNftCount(Math.min(Math.max(0, Number(e.target.value)), owned.tokenIds.length));
              }}
              className="numeric mt-2 w-full bg-transparent text-2xl font-semibold outline-none"
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
            ) : null}
            <p className="numeric mt-2 text-xs text-muted-foreground">
              you hold {owned.tokenIds.length} from this collection
              {tokenIds.length > 0
                ? ` · depositing #${tokenIds.map((t) => String(t)).join(", #")}`
                : ""}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background/50 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              WETH to deposit
            </p>
            <input
              value={weth}
              onChange={(e) => setWeth(e.target.value)}
              className="numeric mt-2 w-full bg-transparent text-2xl font-semibold outline-none"
            />
          </div>

          {isVirginPool ? (
            <p className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
              This pool has no liquidity yet. Your first deposit sets the starting price — WETH ÷
              NFTs, exactly like a real AMM — so it needs both sides together, not just one.
            </p>
          ) : null}

          <button
            onClick={addLiquidity}
            disabled={
              !isConnected ||
              Boolean(pending) ||
              owned.isLoading ||
              checking ||
              needsBothSides ||
              (nftCount === 0 && wethAmount === 0n)
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-40"
          >
            {pending || checking ? <Loader2 className="size-4 animate-spin" /> : null}
            {!isConnected
              ? "Connect wallet"
              : owned.isLoading
                ? "Loading your NFTs…"
                : checking
                  ? "Verifying ownership…"
                  : needsBothSides
                    ? "Add both NFTs and WETH"
                    : "Add liquidity"}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-border bg-background/50 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Withdraw</p>
              <p className="numeric text-2xl font-semibold">{sharesPct}%</p>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={sharesPct}
              onChange={(e) => setSharesPct(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--primary)]"
            />
            <p className="numeric mt-2 text-xs text-muted-foreground">
              your shares: {Number(formatEther(userShares)).toFixed(5)}
            </p>
          </div>

          <button
            onClick={withdraw}
            disabled={!isConnected || Boolean(pending) || userShares === 0n}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-raised px-5 py-3.5 text-sm font-semibold disabled:opacity-40"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {userShares === 0n ? "No liquidity position" : "Withdraw liquidity"}
          </button>
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Adding liquidity approves the pool for your NFTs and wraps ETH into WETH when needed.
          Withdrawals return both sides pro rata.
        </span>
      </div>
    </Panel>
  );
}
