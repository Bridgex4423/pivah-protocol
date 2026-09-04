import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Coins, Info, TrendingUp } from "lucide-react";
import { useAccount, usePublicClient } from "wagmi";
import { toast } from "sonner";

import {
  PageHeader,
  Panel,
  StatCard,
  Badge,
  EmptyState,
  SectionTitle,
} from "@/components/ui/pivah";
import { formatEth } from "@/lib/pivah/curve";
import {
  useCollections,
  useNftApproval,
  useOwnedTokens,
  usePivah,
  useStakingVault,
  useTx,
  type Address,
} from "@/lib/pivah/hooks";
import { erc721Abi, stakingVaultAbi } from "@/lib/pivah/abis";
import { logActivity } from "@/lib/pivah/activity";

export const DESCRIPTION =
  "Stake NFTs from any collection — Pivah-made or not — and earn PIVAH continuously. No lock-up, unstake anytime.";

export const Route = createFileRoute("/stake")({
  head: () => ({
    meta: [
      { title: "Stake NFTs — Earn PIVAH" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Stake NFTs — Earn PIVAH" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StakePage,
});

function StakePage() {
  const { address, isConnected, chainId } = useAccount();
  const { addresses, deployed: contractsDeployed } = usePivah();
  const { collections } = useCollections();
  const { vault, deployed, isLoading, refetch } = useStakingVault();
  const approveNfts = useNftApproval();
  const { send, pending } = useTx();
  const publicClient = usePublicClient();

  const [collection, setCollection] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);

  const owned = useOwnedTokens(
    collection.startsWith("0x") && collection.length === 42 ? (collection as Address) : undefined,
  );

  const selectedIds = useMemo(
    () => owned.tokenIds.filter((t) => selected.has(String(t))),
    [owned.tokenIds, selected],
  );

  function toggle(id: bigint) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectPercent(pct: number) {
    const n = Math.ceil((owned.tokenIds.length * pct) / 100);
    setSelected(new Set(owned.tokenIds.slice(0, n).map((t) => String(t))));
  }

  async function stakeSelected() {
    if (!address || !publicClient || !deployed) return;

    setChecking(true);
    let verified: bigint[];
    try {
      const results = await Promise.all(
        selectedIds.map(async (id) => {
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
      verified = results.filter((id): id is bigint => id !== null);
    } finally {
      setChecking(false);
    }
    if (verified.length === 0) {
      toast.error("None of the selected tokens are still in your wallet — refresh and try again");
      owned.refetch();
      return;
    }

    const vaultAddress = addresses.stakingVault as Address;
    await approveNfts(collection as Address, vaultAddress);
    if (verified.length === 1) {
      const receipt = await send("Stake NFT", {
        address: vaultAddress,
        abi: stakingVaultAbi,
        functionName: "stake",
        args: [collection as Address, verified[0]!],
      });
      logActivity(address, "staked_nft", {
        chainId,
        txHash: receipt?.transactionHash,
        metadata: { collection, tokenIds: [verified[0]!.toString()] },
      });
    } else {
      const receipt = await send(`Stake ${verified.length} NFTs`, {
        address: vaultAddress,
        abi: stakingVaultAbi,
        functionName: "stakeBatch",
        args: [collection as Address, verified],
      });
      logActivity(address, "staked_nft", {
        chainId,
        txHash: receipt?.transactionHash,
        metadata: { collection, tokenIds: verified.map((v) => v.toString()) },
      });
    }
    setSelected(new Set());
    owned.refetch();
    refetch();
  }

  async function unstakeOne(stakeId: bigint) {
    const receipt = await send("Unstake", {
      address: addresses.stakingVault as Address,
      abi: stakingVaultAbi,
      functionName: "unstake",
      args: [stakeId],
    });
    logActivity(address, "unstaked_nft", {
      chainId,
      txHash: receipt?.transactionHash,
      metadata: { stakeId: stakeId.toString() },
    });
    refetch();
  }

  async function unstakeAll() {
    if (vault.myStakes.length === 0) return;
    const receipt = await send(`Unstake ${vault.myStakes.length} NFTs`, {
      address: addresses.stakingVault as Address,
      abi: stakingVaultAbi,
      functionName: "unstakeBatch",
      args: [vault.myStakes.map((s) => s.stakeId)],
    });
    logActivity(address, "unstaked_nft", {
      chainId,
      txHash: receipt?.transactionHash,
      metadata: { count: vault.myStakes.length },
    });
    refetch();
  }

  async function claim() {
    if (!deployed || vault.userPending === 0n) return;
    const receipt = await send("Claim PIVAH", {
      address: addresses.stakingVault as Address,
      abi: stakingVaultAbi,
      functionName: "claim",
    });
    logActivity(address, "claimed_rewards", {
      chainId,
      txHash: receipt?.transactionHash,
      metadata: { amount: vault.userPending.toString() },
    });
    refetch();
  }

  if (!contractsDeployed) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Pivah" title="Stake" description={DESCRIPTION} />
        <EmptyState
          title="Contracts not deployed on this network"
          description="Switch to Base Sepolia, or deploy the protocol from contracts/ and paste the addresses into src/lib/pivah/addresses.ts."
        />
      </div>
    );
  }

  const ratePerDay = vault.rewardRatePerSecond * 86_400n;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pivah"
        title="Stake"
        description={DESCRIPTION}
        actions={!deployed ? <Badge tone="warning">Vault not deployed</Badge> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="NFTs staked (all users)"
          value={String(vault.totalStaked)}
          tone="primary"
        />
        <StatCard
          label="Emission rate"
          value={`${formatEth(ratePerDay, 2)} PIVAH/day`}
          tone="success"
        />
        <StatCard label="Your NFTs staked" value={String(vault.myStakes.length)} tone="accent" />
        <StatCard label="Claimable PIVAH" value={formatEth(vault.userPending, 4)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="p-4 sm:p-5">
          <SectionTitle title="Stake NFTs" hint="Any collection — Pivah-made or not" />
          <div className="mt-3">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Collection address
            </label>
            <input
              value={collection}
              onChange={(e) => {
                setCollection(e.target.value);
                setSelected(new Set());
              }}
              placeholder="0x…"
              className="numeric mt-1.5 w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
            />
            {collections.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {collections.map((c) => (
                  <button
                    key={c.address}
                    onClick={() => {
                      setCollection(c.address);
                      setSelected(new Set());
                    }}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {c.name || c.symbol}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {collection.length === 42 ? (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Your tokens — select by % or pick individually
                </label>
                {owned.tokenIds.length > 0 ? (
                  <button
                    onClick={() =>
                      setSelected(
                        selected.size === owned.tokenIds.length
                          ? new Set()
                          : new Set(owned.tokenIds.map((t) => String(t))),
                      )
                    }
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {selected.size === owned.tokenIds.length ? "Clear all" : "Select all"}
                  </button>
                ) : null}
              </div>
              {owned.tokenIds.length > 0 ? (
                <div className="mt-1.5 flex gap-1.5">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => selectPercent(pct)}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/60 hover:text-foreground"
                    >
                      {pct}%
                    </button>
                  ))}
                  <span className="self-center text-xs text-muted-foreground">
                    {selected.size} of {owned.tokenIds.length} selected
                  </span>
                </div>
              ) : null}
              {owned.isLoading ? (
                <p className="mt-2 text-xs text-muted-foreground">Loading your tokens…</p>
              ) : owned.tokenIds.length > 0 ? (
                <div className="mt-1.5 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-border bg-background/40 p-2">
                  {owned.tokenIds.map((t) => {
                    const on = selected.has(String(t));
                    return (
                      <button
                        key={String(t)}
                        onClick={() => toggle(t)}
                        className={`numeric rounded-lg border px-2 py-1 text-xs transition-colors ${
                          on
                            ? "border-primary bg-primary/20 text-foreground"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        #{String(t)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  No tokens from this collection in your wallet.
                </p>
              )}

              <button
                onClick={stakeSelected}
                disabled={
                  !isConnected ||
                  !deployed ||
                  selectedIds.length === 0 ||
                  Boolean(pending) ||
                  checking
                }
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-5 py-3.5 text-sm font-bold uppercase tracking-wide text-primary-foreground shadow-glow disabled:cursor-not-allowed disabled:opacity-40"
              >
                {checking
                  ? "Verifying ownership…"
                  : pending
                    ? pending
                    : selectedIds.length > 1
                      ? `Stake ${selectedIds.length} NFTs`
                      : "Stake NFT"}
              </button>
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Paste a collection address above, or pick one you've deployed through Pivah.
            </p>
          )}

          {vault.myStakes.length > 0 ? (
            <div className="mt-6 border-t border-border pt-5">
              <div className="flex items-center justify-between">
                <SectionTitle title="Currently staked" hint={`${vault.myStakes.length} NFTs`} />
                <button
                  onClick={unstakeAll}
                  disabled={Boolean(pending)}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-40"
                >
                  Unstake all
                </button>
              </div>
              <div className="mt-2 flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-border bg-background/40 p-2">
                {vault.myStakes.map((s) => (
                  <button
                    key={String(s.stakeId)}
                    onClick={() => unstakeOne(s.stakeId)}
                    disabled={Boolean(pending)}
                    className="numeric flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:border-destructive/60 hover:text-destructive disabled:opacity-40"
                    title="Click to unstake"
                  >
                    {s.collection.slice(0, 6)}… #{String(s.tokenId)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-background/50 p-3.5 text-sm">
            <span className="text-muted-foreground">Claimable PIVAH</span>
            <span className="numeric font-medium">{formatEth(vault.userPending, 6)}</span>
          </div>
          <button
            onClick={claim}
            disabled={!deployed || vault.userPending === 0n || Boolean(pending)}
            className="mt-3 w-full rounded-xl border border-border bg-surface-raised px-5 py-3 text-sm font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
          >
            Claim
          </button>
          {isLoading ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">Loading vault…</p>
          ) : null}
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5">
            <div className="flex items-center gap-2">
              <Coins className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">How rewards work</h2>
            </div>
            <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted-foreground">
              <li>Every staked NFT is one equal share — collection doesn't matter.</li>
              <li>PIVAH streams continuously at a fixed rate, split across all staked NFTs.</li>
              <li>No lock-up — unstake any NFT anytime, rewards keep accruing until you do.</li>
            </ul>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-success" />
              <h2 className="text-sm font-semibold">Accounting</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Same O(1) accumulator design used across Pivah — exact rewards no matter how many
              people stake, no gas-heavy loops on claim.
            </p>
          </Panel>

          {!deployed ? (
            <Panel className="flex items-start gap-2 p-4 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-warning" />
              Staking activates once the vault is deployed. Numbers above are placeholders until
              then.
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
