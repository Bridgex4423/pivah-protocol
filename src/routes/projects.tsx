import { createFileRoute, Link } from "@tanstack/react-router";
import { Palette, Rocket, Copy, Check, Repeat, Store, Trash2, PlayCircle } from "lucide-react";
import { useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard, EmptyState, Panel, Badge } from "@/components/ui/pivah";
import { projectImageUrl, useStudioProjects, deleteProject } from "@/lib/pivah/studio";
import { DEFAULT_CHAIN_ID } from "@/lib/wagmi";
import { collectionAbi } from "@/lib/pivah/abis";
import { useTx, MINT_BATCH_SIZE, type Address } from "@/lib/pivah/hooks";

export const DESCRIPTION =
  "Your Creator Studio projects: single NFTs, collections, deploy status and where each one can trade.";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Creator Studio | Pivah" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Projects — Creator Studio | Pivah" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { address, chainId } = useAccount();
  const { data: projects = [], isLoading } = useStudioProjects(
    address?.toLowerCase(),
    chainId ?? DEFAULT_CHAIN_ID,
  );
  const queryClient = useQueryClient();
  const { send } = useTx();
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
    contract_address: string | null;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);

  // Real, on-chain mint counts for every deployed collection — this is the
  // only reliable source of truth for "how many are actually minted" after
  // a network hiccup or a failed batch. The database's own max_supply field
  // only ever records the *intended* total, never what really landed.
  const deployedCollections = projects.filter((p) => p.contract_address && p.kind !== "single");
  const { data: supplyReads } = useReadContracts({
    contracts: deployedCollections.map((p) => ({
      address: p.contract_address as Address,
      abi: collectionAbi,
      functionName: "totalSupply",
    })),
    query: { enabled: deployedCollections.length > 0, refetchInterval: 15_000 },
  });
  const remainingById = new Map<string, number>();
  deployedCollections.forEach((p, i) => {
    const minted = supplyReads?.[i]?.result as bigint | undefined;
    if (minted === undefined) return;
    const remaining = Math.max(0, p.max_supply - Number(minted));
    remainingById.set(p.id, remaining);
  });

  async function resumeMint(project: { id: string; contract_address: string | null }) {
    if (!project.contract_address || !address) return;
    const remaining = remainingById.get(project.id) ?? 0;
    if (remaining <= 0) return;
    setResumingId(project.id);
    const BATCH_SIZE = MINT_BATCH_SIZE;
    try {
      let done = 0;
      while (done < remaining) {
        const batch = Math.min(BATCH_SIZE, remaining - done);
        const batchNumber = Math.floor(done / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(remaining / BATCH_SIZE);
        await send(`Resume mint ${batchNumber}/${totalBatches}`, {
          address: project.contract_address as Address,
          abi: collectionAbi,
          functionName: "ownerMint",
          args: [address, BigInt(batch)],
        });
        done += batch;
      }
      toast.success("Minting complete");
      queryClient.invalidateQueries({ queryKey: ["readContracts"] });
    } catch {
      // useTx already surfaces a toast on failure — nothing further needed
      // here, and whatever did mint before the failure stays minted.
    } finally {
      setResumingId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteProject(pendingDelete.id);
      toast.success("Project deleted");
      queryClient.invalidateQueries({ queryKey: ["nft_projects"] });
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete this project");
    } finally {
      setDeleting(false);
    }
  }

  const deployed = projects.filter((p) => p.contract_address).length;
  const collections = projects.filter((p) => p.kind === "collection").length;
  const singles = projects.filter((p) => p.kind === "single").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Projects"
        description={DESCRIPTION}
        actions={
          <Link
            to="/creator/new"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            <Palette className="size-4" />
            New project
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Projects" value={String(projects.length)} tone="primary" />
        <StatCard label="Deployed" value={String(deployed)} tone="accent" />
        <StatCard label="Collections" value={String(collections)} />
        <StatCard label="Single NFTs" value={String(singles)} tone="success" />
      </div>

      {isLoading ? (
        <Panel className="p-8 text-center text-sm text-muted-foreground">Loading projects…</Panel>
      ) : projects.length === 0 ? (
        <EmptyState
          title={address ? "No projects yet" : "Connect your wallet"}
          description="Create a single 1/1 NFT or a collection. Pivah uploads the artwork, hosts the metadata and deploys the contract for you."
          action={
            <Link
              to="/creator/new"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm font-semibold"
            >
              <Palette className="size-4" />
              Start a project
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Panel key={p.id} className="overflow-hidden">
              <img
                src={projectImageUrl(p.id)}
                alt={`${p.name} artwork`}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">
                    {p.name} <span className="text-muted-foreground">{p.symbol}</span>
                  </p>
                  <Badge tone={p.kind === "single" ? "warning" : "success"}>
                    {p.kind === "single" ? "1/1" : "Collection"}
                  </Badge>
                </div>
                {p.contract_address ? (
                  <CopyableAddress address={p.contract_address} />
                ) : (
                  <p className="numeric truncate text-xs text-muted-foreground">Not deployed</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {p.kind === "single"
                    ? "Trades on the Marketplace only."
                    : `Supply ${p.max_supply} · ${p.mint_price_eth} ETH · DEX-poolable`}
                </p>
                {p.contract_address ? (
                  <div className="flex gap-2 pt-1">
                    {(remainingById.get(p.id) ?? 0) > 0 &&
                    p.creator_wallet === address?.toLowerCase() ? (
                      <button
                        onClick={() => resumeMint(p)}
                        disabled={resumingId === p.id}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-gradient px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <PlayCircle className="size-3.5" />
                        {resumingId === p.id
                          ? "Minting…"
                          : `Resume (${remainingById.get(p.id)} left)`}
                      </button>
                    ) : (
                      <>
                        {p.kind !== "single" ? (
                          <Link
                            to="/dex"
                            search={{ collection: p.contract_address }}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            <Repeat className="size-3.5" /> DEX
                          </Link>
                        ) : null}
                        <Link
                          to="/marketplace"
                          search={{ collection: p.contract_address }}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          <Store className="size-3.5" /> List
                        </Link>
                      </>
                    )}
                    {p.creator_wallet === address?.toLowerCase() ? (
                      <button
                        onClick={() => setPendingDelete(p)}
                        title="Remove from Pivah's records"
                        className="flex items-center justify-center rounded-lg border border-destructive/30 px-2.5 py-1.5 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                ) : p.creator_wallet === address?.toLowerCase() ? (
                  <button
                    onClick={() => setPendingDelete(p)}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                ) : null}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Panel className="w-full max-w-sm p-5">
            <p className="text-sm font-semibold">Remove "{pendingDelete.name}"?</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {pendingDelete.contract_address
                ? "This contract is genuinely live and permanent on Base — nothing can delete it from the blockchain, including this. This only removes it from Pivah's own records, so it stops showing up in your Projects list."
                : "This only removes it from Pivah's records — it was never deployed on-chain, so there's nothing else to undo. This can't be reversed."}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </Panel>
        </div>
      ) : null}

      <Panel className="flex items-start gap-3 p-4 text-xs leading-relaxed text-muted-foreground">
        <Rocket className="mt-0.5 size-4 shrink-0 text-accent" />
        Single NFTs keep their identity and trade peer-to-peer on the Marketplace. Collections can
        additionally be deposited into a DEX pool, where items lose their individual identity and
        trade instantly against a bonding curve like a token.
      </Panel>
    </div>
  );
}

function CopyableAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className="flex w-full items-center gap-1.5 rounded-lg border border-transparent px-0 py-0.5 text-left hover:border-border hover:bg-background/40 hover:px-1.5"
      title="Copy contract address"
    >
      <span className="numeric truncate text-xs text-muted-foreground">{address}</span>
      {copied ? (
        <Check className="size-3 shrink-0 text-success" />
      ) : (
        <Copy className="size-3 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}
