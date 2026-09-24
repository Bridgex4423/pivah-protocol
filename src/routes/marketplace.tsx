import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ImageOff, Loader2, Tag } from "lucide-react";
import { formatEther, parseEther } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { toast } from "sonner";

import { PageHeader, Panel, StatCard, EmptyState, SectionTitle } from "@/components/ui/pivah";
import { Button } from "@/components/ui/button";
import { erc20Abi, erc721Abi, marketplaceAbi } from "@/lib/pivah/abis";
import { logActivity } from "@/lib/pivah/activity";
import { useStudioProjects } from "@/lib/pivah/studio";
import { DEFAULT_CHAIN_ID } from "@/lib/wagmi";
import {
  useCollections,
  useErc20Approval,
  useListings,
  useMarketplaceSalesStats,
  useNftApproval,
  useOwnedTokens,
  usePivah,
  useTokenImage,
  useTx,
  type Address,
} from "@/lib/pivah/hooks";

export const Route = createFileRoute("/marketplace")({
  validateSearch: (search: Record<string, unknown>): { collection?: string } =>
    typeof search["collection"] === "string" ? { collection: search["collection"] } : {},
  head: () => ({
    meta: [
      { title: "NFT Marketplace — Pivah Protocol" },
      {
        name: "description",
        content:
          "List and buy individual NFTs at exact prices. Pivah's peer-to-peer marketplace, separate from the collection liquidity DEX.",
      },
      { property: "og:title", content: "NFT Marketplace — Pivah Protocol" },
      {
        property: "og:description",
        content: "Peer-to-peer NFT listings with configurable protocol fees on Base.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketplacePage,
});

function MarketplacePage() {
  const { collection: collectionParam } = Route.useSearch();
  const { address, isConnected, chainId } = useAccount();
  const { addresses } = usePivah();
  const { listings, isLoading, refetch } = useListings();
  const {
    data: salesStats,
    isLoading: salesLoading,
    isError: salesError,
  } = useMarketplaceSalesStats();
  const { collections: allCollections } = useCollections();
  const { send, pending } = useTx();
  const approveErc20 = useErc20Approval();
  const publicClient = usePublicClient();
  const [showForm, setShowForm] = useState(Boolean(collectionParam));

  const volume = listings.reduce((a, l) => a + l.price, 0n);
  const collectionCount = new Set(listings.map((l) => l.collection)).size;

  // Grouped by collection so one large listing batch can't bury every other
  // seller's listings under it — the marketplace shows one summary card per
  // collection, and clicking in filters down to that collection's tokens.
  const nameByAddress = new Map(allCollections.map((c) => [c.address.toLowerCase(), c.name]));
  const groups = new Map<string, typeof listings>();
  for (const l of listings) {
    const key = l.collection.toLowerCase();
    const existing = groups.get(key);
    if (existing) existing.push(l);
    else groups.set(key, [l]);
  }
  const collectionGroups = Array.from(groups.entries()).map(([addr, group]) => ({
    address: addr,
    name: nameByAddress.get(addr) ?? "Collection",
    count: group.length,
    floor: group.reduce((min, l) => (l.price < min ? l.price : min), group[0]!.price),
    preview: group[0]!,
  }));

  const filteredListings = collectionParam
    ? listings.filter((l) => l.collection.toLowerCase() === collectionParam.toLowerCase())
    : listings;
  const viewingCollectionName = collectionParam
    ? (nameByAddress.get(collectionParam.toLowerCase()) ?? "Collection")
    : null;

  /** Wrap only the shortfall so an already-wrapped balance costs no extra
   *  tx — matches the DEX's existing behavior. Without this, a buyer
   *  holding only native ETH (the common case) has no way to complete a
   *  purchase, since listings settle in WETH, a separate ERC-20 token. */
  async function wrapIfNeeded(quoteToken: Address, amount: bigint) {
    if (quoteToken.toLowerCase() !== addresses.weth.toLowerCase()) return;
    if (!address || !publicClient) return;
    const balance = (await publicClient.readContract({
      address: quoteToken,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    })) as bigint;
    if (balance >= amount) return;
    await send("Wrap ETH", {
      address: quoteToken,
      abi: erc20Abi,
      functionName: "deposit",
      args: [],
      value: amount - balance,
    });
  }

  async function buy(id: bigint, price: bigint, quoteToken: Address) {
    const marketplace = addresses.marketplace as Address;
    await wrapIfNeeded(quoteToken, price);
    await approveErc20(quoteToken, marketplace, price);
    const receipt = await send("Buy listing", {
      address: marketplace,
      abi: marketplaceAbi,
      functionName: "buy",
      args: [id],
    });
    logActivity(address, "bought_marketplace", {
      chainId,
      txHash: receipt?.transactionHash,
      metadata: { listingId: String(id), price: price.toString() },
    });
    refetch();
  }

  async function cancel(id: bigint) {
    await send("Cancel listing", {
      address: addresses.marketplace as Address,
      abi: marketplaceAbi,
      functionName: "cancelListing",
      args: [id],
    });
    refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Marketplace"
        description="Individual NFT listings at seller-chosen prices. Use this when you want an exact price for one exact token — the DEX is for instant collection-level liquidity."
        actions={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            {showForm ? "Close" : "List an NFT"}
          </button>
        }
      />

      {showForm ? (
        <ListForm
          initialCollection={collectionParam}
          onListed={() => {
            setShowForm(false);
            refetch();
          }}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active listings" value={String(listings.length)} />
        <StatCard
          label="Listed value"
          value={`${Number(formatEther(volume)).toFixed(3)} WETH`}
          tone="accent"
        />
        <StatCard label="Collections" value={String(collectionCount)} />
        <StatCard label="Protocol fee" value="0.5%" sub="set by FeeManager" tone="primary" />
      </div>

      <div>
        <SectionTitle
          title="All-time sales"
          hint={
            salesLoading ? "Scanning chain history — can take a minute" : "Read live from the chain"
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="NFTs sold"
            value={salesLoading ? "…" : salesError ? "—" : String(salesStats?.count ?? 0)}
            {...(salesError ? { sub: "Couldn't load — retrying" } : {})}
            tone="success"
          />
          <StatCard
            label="Volume sold"
            value={
              salesLoading
                ? "…"
                : salesError
                  ? "—"
                  : `${Number(formatEther(salesStats?.volume ?? 0n)).toFixed(3)} WETH`
            }
            {...(salesError ? { sub: "Couldn't load — retrying" } : {})}
            tone="primary"
          />
        </div>
      </div>

      {isLoading ? (
        <Panel className="p-10 text-center text-sm text-muted-foreground">Loading listings…</Panel>
      ) : listings.length === 0 ? (
        <EmptyState
          title="No active listings"
          description="List an NFT to get started. Listing moves it into escrow — you get it back anytime by cancelling."
        />
      ) : collectionParam ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle
              title={viewingCollectionName ?? "Collection"}
              hint={`${filteredListings.length} listed`}
            />
            <Link
              to="/marketplace"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              ← All collections
            </Link>
          </div>
          {filteredListings.length === 0 ? (
            <EmptyState
              title="Nothing listed here right now"
              description="Every listing in this collection has sold or been cancelled."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredListings.map((l) => {
                const mine = address?.toLowerCase() === l.seller.toLowerCase();
                return (
                  <ListingCard
                    key={String(l.id)}
                    listing={l}
                    mine={mine}
                    pending={pending}
                    isConnected={isConnected}
                    onBuy={() => buy(l.id, l.price, l.quoteToken)}
                    onCancel={() => cancel(l.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collectionGroups.map((g) => (
            <CollectionGroupCard key={g.address} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionGroupCard({
  group,
}: {
  group: {
    address: string;
    name: string;
    count: number;
    floor: bigint;
    preview: ReturnType<typeof useListings>["listings"][number];
  };
}) {
  const { image } = useTokenImage(group.preview.collection, group.preview.tokenId);

  return (
    <Link
      to="/marketplace"
      search={{ collection: group.address }}
      className="block overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-primary/40"
    >
      <div className="aspect-square w-full bg-background/60">
        {image ? (
          <img src={image} alt={group.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="size-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="space-y-1 p-4">
        <p className="truncate text-sm font-semibold">{group.name}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{group.count} listed</span>
          <span className="numeric text-foreground">
            Floor {Number(formatEther(group.floor)).toFixed(4)} WETH
          </span>
        </div>
      </div>
    </Link>
  );
}

function ListingCard({
  listing: l,
  mine,
  pending,
  isConnected,
  onBuy,
  onCancel,
}: {
  listing: ReturnType<typeof useListings>["listings"][number];
  mine: boolean;
  pending: string | null;
  isConnected: boolean;
  onBuy: () => void;
  onCancel: () => void;
}) {
  const { image, isLoading } = useTokenImage(l.collection, l.tokenId);

  return (
    <Panel className="overflow-hidden p-0">
      <div className="aspect-square w-full bg-background/60">
        {image ? (
          <img
            src={image}
            alt={`Token #${String(l.tokenId)}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {isLoading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <ImageOff className="size-5 text-muted-foreground" />
            )}
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Tag className="size-3.5" />
          <span className="numeric truncate">
            {l.collection.slice(0, 8)}…{l.collection.slice(-4)}
          </span>
        </div>
        <p className="numeric mt-2 text-lg font-semibold">Token #{String(l.tokenId)}</p>
        <p className="numeric mt-1 text-sm text-muted-foreground">
          {Number(formatEther(l.price)).toFixed(5)} WETH
        </p>
        <button
          onClick={mine ? onCancel : onBuy}
          disabled={!isConnected || Boolean(pending)}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-40 ${
            mine
              ? "border border-border text-muted-foreground"
              : "bg-brand-gradient text-primary-foreground shadow-glow"
          }`}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {mine ? "Cancel listing" : "Buy now"}
        </button>
      </div>
    </Panel>
  );
}

function ListForm({
  onListed,
  initialCollection,
}: {
  onListed: () => void;
  initialCollection?: string | undefined;
}) {
  const { address, isConnected, chainId } = useAccount();
  const { addresses, deployed } = usePivah();
  // Scoped to only this wallet's own on-chain collections (not every
  // collection anyone has ever deployed on Pivah), then cross-referenced
  // against still-existing project records — deleting a project on the
  // Projects page removes it from this quick-pick list too, even though
  // the collection itself remains permanently real on-chain and can still
  // be pasted in manually by address if genuinely needed.
  const { collections: myCollections } = useCollections(true);
  const { data: myProjects = [] } = useStudioProjects(
    address?.toLowerCase(),
    chainId ?? DEFAULT_CHAIN_ID,
  );
  const keptAddresses = new Set(
    myProjects.map((p) => p.contract_address?.toLowerCase()).filter((a): a is string => Boolean(a)),
  );
  const collections = myCollections.filter((c) => keptAddresses.has(c.address.toLowerCase()));
  const { send, pending } = useTx();
  const approveNfts = useNftApproval();
  const publicClient = usePublicClient();

  const [collection, setCollection] = useState(initialCollection ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [price, setPrice] = useState("0.05");
  const [checking, setChecking] = useState(false);
  const [perTokenMode, setPerTokenMode] = useState(false);
  const [perTokenPrices, setPerTokenPrices] = useState<Record<string, string>>({});
  const [bulkBase, setBulkBase] = useState("0.05");
  const [bulkStep, setBulkStep] = useState("0");
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  const owned = useOwnedTokens(
    collection.startsWith("0x") && collection.length === 42 ? (collection as Address) : undefined,
  );

  const selectedIds = useMemo(
    () => owned.tokenIds.filter((t) => selected.has(String(t))),
    [owned.tokenIds, selected],
  );

  const valid = useMemo(() => {
    if (collection.length !== 42 || selectedIds.length === 0) return false;
    if (perTokenMode && selectedIds.length > 1) {
      return selectedIds.every((id) => Number(perTokenPrices[String(id)] || "0") > 0);
    }
    return Number(price) > 0;
  }, [collection, selectedIds, perTokenMode, perTokenPrices, price]);

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

  // Bulk-fill tools for pricing many NFTs at once — typing 100 individual
  // prices by hand isn't realistic for a founder listing a whole collection.
  function applyBulkFill() {
    const base = Number(bulkBase) || 0;
    const step = Number(bulkStep) || 0;
    setPerTokenPrices((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id, i) => {
        next[String(id)] = (base + i * step).toString();
      });
      return next;
    });
  }

  function applyPaste() {
    const values = pasteText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    setPerTokenPrices((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id, i) => {
        if (values[i]) next[String(id)] = values[i];
      });
      return next;
    });
    setShowPaste(false);
    setPasteText("");
  }

  async function list() {
    if (!address || !publicClient) return;

    // Re-verify ownership right before submitting, not from a cache that might
    // be a few seconds stale — one already-sold or already-pooled token in a
    // batch would otherwise revert the entire listBatch call for everyone else
    // in it.
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
    if (verified.length < selectedIds.length) {
      toast.message(
        `${selectedIds.length - verified.length} selected token(s) already moved — listing the remaining ${verified.length}`,
      );
    }

    const marketplace = addresses.marketplace as Address;
    await approveNfts(collection as Address, marketplace);
    if (verified.length === 1) {
      const onePrice = perTokenMode ? perTokenPrices[String(verified[0])] || price : price;
      const receipt = await send("List NFT", {
        address: marketplace,
        abi: marketplaceAbi,
        functionName: "list",
        args: [
          collection as Address,
          verified[0]!,
          addresses.weth,
          parseEther(onePrice || "0"),
          0n,
        ],
      });
      logActivity(address, "listed_marketplace", {
        chainId,
        txHash: receipt?.transactionHash,
        metadata: { collection, tokenIds: [verified[0]!.toString()], price: onePrice },
      });
    } else if (perTokenMode) {
      // Real measurement: listing costs ~185,000 gas/token (a full escrow
      // transfer plus a new listing record), meaningfully more than a
      // mint. 40 keeps well clear of the same class of RPC/wallet gas cap
      // that mint batches hit above 100.
      const LIST_BATCH_SIZE = 40;
      let done = 0;
      let lastReceipt: Awaited<ReturnType<typeof send>> | undefined;
      while (done < verified.length) {
        const chunkIds = verified.slice(done, done + LIST_BATCH_SIZE);
        const chunkPrices = chunkIds.map((id) => parseEther(perTokenPrices[String(id)] || "0"));
        const batchNumber = Math.floor(done / LIST_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(verified.length / LIST_BATCH_SIZE);
        lastReceipt = await send(
          totalBatches > 1
            ? `List batch ${batchNumber}/${totalBatches} at their own prices`
            : `List ${verified.length} NFTs at their own prices`,
          {
            address: marketplace,
            abi: marketplaceAbi,
            functionName: "listBatchWithPrices",
            args: [collection as Address, chunkIds, addresses.weth, chunkPrices, 0n],
          },
        );
        done += chunkIds.length;
      }
      logActivity(address, "listed_marketplace", {
        chainId,
        txHash: lastReceipt?.transactionHash,
        metadata: { collection, tokenIds: verified.map((v) => v.toString()) },
      });
    } else {
      const LIST_BATCH_SIZE = 40;
      let done = 0;
      let lastReceipt: Awaited<ReturnType<typeof send>> | undefined;
      while (done < verified.length) {
        const chunkIds = verified.slice(done, done + LIST_BATCH_SIZE);
        const batchNumber = Math.floor(done / LIST_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(verified.length / LIST_BATCH_SIZE);
        lastReceipt = await send(
          totalBatches > 1
            ? `List batch ${batchNumber}/${totalBatches}`
            : `List ${verified.length} NFTs`,
          {
            address: marketplace,
            abi: marketplaceAbi,
            functionName: "listBatch",
            args: [collection as Address, chunkIds, addresses.weth, parseEther(price || "0"), 0n],
          },
        );
        done += chunkIds.length;
      }
      logActivity(address, "listed_marketplace", {
        chainId,
        txHash: lastReceipt?.transactionHash,
        metadata: { collection, tokenIds: verified.map((v) => v.toString()), price },
      });
    }
    setSelected(new Set());
    setPerTokenPrices({});
    onListed();
  }

  return (
    <Panel className="p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <Label>Collection address</Label>
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
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between">
            <Label>Your tokens — select by % or pick individually</Label>
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
          ) : collection.length === 42 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No tokens from this collection in your wallet.
            </p>
          ) : null}
        </div>
        <div className="sm:col-span-3">
          <div className="flex items-center justify-between">
            <Label>Pricing</Label>
            {selectedIds.length > 1 ? (
              <button
                onClick={() => setPerTokenMode((v) => !v)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {perTokenMode ? "Use one price for all" : "Set a different price per NFT"}
              </button>
            ) : null}
          </div>

          {perTokenMode && selectedIds.length > 1 ? (
            <>
              <div className="mt-1.5 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-background/40 p-2.5">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Start price
                  </label>
                  <input
                    value={bulkBase}
                    onChange={(e) => setBulkBase(e.target.value)}
                    className="numeric mt-0.5 w-20 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/60"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    +Step per NFT
                  </label>
                  <input
                    value={bulkStep}
                    onChange={(e) => setBulkStep(e.target.value)}
                    className="numeric mt-0.5 w-20 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/60"
                  />
                </div>
                <Button type="button" variant="outline" onClick={applyBulkFill} className="mt-0">
                  Fill {selectedIds.length}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowPaste((v) => !v)}
                  className="ml-auto text-xs font-medium text-primary hover:underline"
                >
                  {showPaste ? "Hide paste" : "Paste a price list instead"}
                </button>
              </div>
              {showPaste ? (
                <div className="mt-1.5">
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={`One price per line or comma-separated, in token order (#${selectedIds[0]} first)\ne.g. from a rarity spreadsheet:\n0.08\n0.05\n0.12\n...`}
                    rows={3}
                    className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-xs outline-none focus:border-primary/60"
                  />
                  <Button type="button" variant="outline" onClick={applyPaste} className="mt-1.5">
                    Apply{" "}
                    {Math.min(
                      pasteText.split(/[\n,]+/).filter((s) => s.trim()).length,
                      selectedIds.length,
                    )}{" "}
                    prices
                  </Button>
                </div>
              ) : null}
              <div className="mt-1.5 grid max-h-52 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-border bg-background/40 p-2 sm:grid-cols-3">
                {selectedIds.map((id) => (
                  <div key={String(id)} className="flex items-center gap-1.5">
                    <span className="numeric shrink-0 text-xs text-muted-foreground">
                      #{String(id)}
                    </span>
                    <input
                      value={perTokenPrices[String(id)] ?? ""}
                      onChange={(e) =>
                        setPerTokenPrices((prev) => ({ ...prev, [String(id)]: e.target.value }))
                      }
                      placeholder="WETH"
                      className="numeric min-w-0 flex-1 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/60"
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price per NFT (WETH)"
              className="numeric mt-1.5 w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
            />
          )}
        </div>
        <div className="sm:col-span-3">
          <button
            onClick={list}
            disabled={!isConnected || !deployed || !valid || Boolean(pending) || checking}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-40"
          >
            {pending || checking ? <Loader2 className="size-4 animate-spin" /> : null}
            {checking
              ? "Verifying ownership…"
              : selectedIds.length > 1
                ? perTokenMode
                  ? `List ${selectedIds.length} NFTs at their own prices — one transaction`
                  : `List ${selectedIds.length} NFTs — one transaction`
                : "List NFT"}
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Listing moves your NFT into escrow — the marketplace holds it, so it can't also be staked or
        added to a DEX pool while listed. Cancel anytime to get it back, for the cost of gas.
        Selecting more than one token lists all of them in a single transaction — same price for
        every token by default, or switch to per-NFT pricing if some traits are worth more.
      </p>
    </Panel>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}
