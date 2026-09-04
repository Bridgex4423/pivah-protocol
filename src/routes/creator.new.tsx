import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, ImagePlus, Layers3, Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { decodeEventLog } from "viem";
import { useAccount } from "wagmi";

import { PageHeader, Panel, SectionTitle, Badge } from "@/components/ui/pivah";
import { Button } from "@/components/ui/button";
import { LayerBuilder } from "@/components/creator/LayerBuilder";
import { CombinationPreview } from "@/components/creator/CombinationPreview";
import { collectionAbi, collectionFactoryAbi } from "@/lib/pivah/abis";
import { usePivah, useTx, MINT_BATCH_SIZE, type Address } from "@/lib/pivah/hooks";
import { logActivity } from "@/lib/pivah/activity";
import {
  createProject,
  metadataBaseUri,
  updateProject,
  uploadProjectImage,
  type ProjectKind,
} from "@/lib/pivah/studio";
import {
  generateAndStoreTokens,
  layerCombinations,
  planTokens,
  type LayerInput,
} from "@/lib/pivah/traits";

export const DESCRIPTION =
  "Create a single 1/1 NFT or a full generative collection: upload artwork or trait layers, Pivah renders every item, hosts the metadata and deploys your ERC-721 on Base.";

export const Route = createFileRoute("/creator/new")({
  head: () => ({
    meta: [
      { title: "New Project — Create an NFT or Collection | Pivah" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "New Project — Creator Studio | Pivah" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewProjectPage,
});

interface Result {
  projectId: string;
  contract: Address;
  baseUri: string;
  kind: ProjectKind;
  generated: number;
}

/** Rough wall-clock estimate for rendering N items at ~4 concurrent uploads. */
function renderEstimateMinutes(count: number) {
  const secondsPerItem = 1.2;
  const concurrency = 4;
  return Math.max(1, Math.round((count * secondsPerItem) / concurrency / 60));
}

function NewProjectPage() {
  const { address, isConnected, chainId } = useAccount();
  const { addresses, deployed } = usePivah();
  const { send, pending } = useTx();

  const [kind, setKind] = useState<ProjectKind>("collection");
  const [artworkMode, setArtworkMode] = useState<"shared" | "layers">("shared");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerInput[]>([]);
  const [step, setStep] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [form, setForm] = useState({
    name: "",
    symbol: "",
    description: "",
    maxSupply: "1000",
    initialMint: "10",
    royaltyBps: "500",
  });

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const usableLayers = layers.filter((l) => l.traits.length > 0);
  const generative = kind === "collection" && usableLayers.length > 0;
  const combos = layerCombinations(usableLayers);

  function pickFile(f: File | null) {
    if (f && !f.type.startsWith("image/")) {
      toast.error("Choose a PNG, JPG, WEBP or GIF image");
      return;
    }
    if (f && f.size > 10 * 1024 * 1024) {
      toast.error("Artwork must be 10 MB or smaller");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function pickCoverFile(f: File | null) {
    if (f && !f.type.startsWith("image/")) {
      toast.error("Choose a PNG, JPG, WEBP or GIF image");
      return;
    }
    if (f && f.size > 10 * 1024 * 1024) {
      toast.error("Cover artwork must be 10 MB or smaller");
      return;
    }
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(f);
    setCoverPreview(f ? URL.createObjectURL(f) : null);
  }

  const busy = Boolean(pending) || Boolean(step);
  const canSubmit =
    isConnected &&
    deployed &&
    (file || generative) &&
    form.name.trim() &&
    form.symbol.trim() &&
    !busy;

  async function launch() {
    if (!address || (!file && !generative)) return;
    try {
      setStep("Saving project");
      const supply = kind === "single" ? 1 : Math.max(1, Number(form.maxSupply || "1"));
      const initialMint =
        kind === "single" ? 1 : Math.min(supply, Math.max(0, Number(form.initialMint || "0")));
      const project = await createProject({
        creator_wallet: address.toLowerCase(),
        kind,
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        description: form.description.trim(),
        max_supply: supply,
        mint_price_eth: "0",
        royalty_bps: Number(form.royaltyBps || "0"),
        chain_id: chainId ?? 84532,
      });

      let generated = 0;
      if (generative) {
        const target = supply;
        const plans = planTokens(usableLayers, target);
        if (plans.length < target) {
          toast.message(`Only ${plans.length} unique combinations are possible from your traits`);
        }
        setStep(`Rendering artwork 0/${plans.length}`);
        const out = await generateAndStoreTokens(project.id, usableLayers, plans, (done, total) =>
          setStep(`Rendering artwork ${done}/${total}`),
        );
        generated = out.generated;
        await updateProject(project.id, { image_path: out.coverPath });
      } else if (file) {
        setStep("Uploading artwork");
        const path = await uploadProjectImage(project.id, file);
        await updateProject(project.id, { image_path: path });
      }

      // A creator-chosen cover always wins as the collection's listing image
      // on Marketplace/DEX/Projects, even when layers already picked one.
      if (kind === "collection" && coverFile) {
        setStep("Uploading cover artwork");
        const coverPath = await uploadProjectImage(`${project.id}/cover`, coverFile);
        await updateProject(project.id, { image_path: coverPath });
      }

      const baseUri = metadataBaseUri(project.id);
      setStep("Deploying contract");
      const receipt = await send("Deploy contract", {
        address: addresses.collectionFactory as Address,
        abi: collectionFactoryAbi,
        functionName: "deploy",
        args: [
          form.name.trim(),
          form.symbol.trim().toUpperCase(),
          baseUri,
          BigInt(supply),
          0n,
          0n,
          address,
          BigInt(form.royaltyBps || "0"),
        ],
      });

      let contract: Address | null = null;
      for (const log of receipt?.logs ?? []) {
        try {
          const decoded = decodeEventLog({
            abi: collectionFactoryAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "CollectionDeployed") {
            contract = (decoded.args as { collection: Address }).collection;
            break;
          }
        } catch {
          /* not our event */
        }
      }

      if (!contract) throw new Error("Could not read the deployed contract address");
      await updateProject(project.id, { contract_address: contract });
      logActivity(address, "created_collection", {
        chainId,
        txHash: receipt?.transactionHash,
        metadata: { contract, kind, name: form.name.trim(), maxSupply: supply },
      });

      if (initialMint > 0) {
        // Minting hundreds of tokens in one transaction can push gas high
        // enough that wallets fail to estimate it or flag it as risky —
        // splitting into smaller batches keeps each transaction predictable
        // and avoids that failure mode entirely. See MINT_BATCH_SIZE in
        // hooks.ts for the reasoning behind the exact number.
        const BATCH_SIZE = MINT_BATCH_SIZE;
        let minted = 0;
        let lastMintReceipt: Awaited<ReturnType<typeof send>> | undefined;
        while (minted < initialMint) {
          const batch = Math.min(BATCH_SIZE, initialMint - minted);
          const batchNumber = Math.floor(minted / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(initialMint / BATCH_SIZE);
          setStep(
            kind === "single"
              ? "Minting your 1/1"
              : totalBatches > 1
                ? `Minting batch ${batchNumber}/${totalBatches} (${minted + batch}/${initialMint})`
                : `Minting ${initialMint} NFTs`,
          );
          lastMintReceipt = await send(
            kind === "single" ? "Mint 1/1" : `Mint batch ${batchNumber}/${totalBatches}`,
            {
              address: contract,
              abi: collectionAbi,
              functionName: "ownerMint",
              args: [address, BigInt(batch)],
            },
          );
          minted += batch;
        }
        logActivity(address, "owner_minted", {
          chainId,
          txHash: lastMintReceipt?.transactionHash,
          metadata: { contract, count: initialMint },
        });
      }

      setResult({ projectId: project.id, contract, baseUri, kind, generated });
      toast.success(kind === "single" ? "NFT minted" : "Collection deployed");
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : "Failed";
      toast.error(message);
    } finally {
      setStep(null);
    }
  }

  if (result) return <Success result={result} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Creator Studio" title="New project" description={DESCRIPTION} />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Panel className="p-5">
            <SectionTitle title="What are you creating?" />
            <div className="grid gap-3 sm:grid-cols-2">
              <KindCard
                active={kind === "single"}
                onClick={() => {
                  setKind("single");
                  setArtworkMode("shared");
                }}
                title="Single NFT (1/1)"
                detail="One unique piece. Tradable on the Pivah Marketplace only — a 1/1 cannot be pooled on the DEX."
              />
              <KindCard
                active={kind === "collection"}
                onClick={() => setKind("collection")}
                title="Collection"
                detail="Many items sharing one contract. Can be listed on the Marketplace and pooled on the DEX to trade like a token."
              />
            </div>
          </Panel>

          {kind === "collection" ? (
            <Panel className="p-5">
              <SectionTitle title="Collection artwork" hint="Choose one method" />
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setArtworkMode("shared")}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                    artworkMode === "shared"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/40"
                  }`}
                >
                  <ImagePlus className="mt-0.5 size-5 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-semibold">Use one shared artwork</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      Every NFT uses the same image, with a different token number. Simplest — zero
                      setup, works immediately.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setArtworkMode("layers")}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                    artworkMode === "layers"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/40"
                  }`}
                >
                  <Layers3 className="mt-0.5 size-5 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-semibold">
                      Generate with layers & traits
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      Upload backgrounds, bodies, eyes and other traits — Pivah generates a unique
                      combination for every NFT, with rarity weights.
                    </span>
                  </span>
                </button>
              </div>
              {artworkMode === "layers" ? (
                <p className="mt-3 rounded-lg border border-primary/40 bg-primary/10 p-3 text-xs leading-relaxed text-muted-foreground">
                  Every trait above your base layer needs a transparent background — the app flags
                  any upload that isn't as soon as you add it. Use the alignment guide under each
                  layer while uploading, then always check "Preview combinations" below before
                  deploying — it renders real samples locally, nothing is on-chain until you
                  actually deploy.
                </p>
              ) : null}
              {artworkMode === "layers" ? (
                <div className="mt-5 space-y-5 border-t border-border pt-5">
                  <LayerBuilder layers={layers} onChange={setLayers} />
                  {generative
                    ? (() => {
                        const willRender = Math.min(
                          Number(form.maxSupply || "0") || 0,
                          combos > BigInt(Number.MAX_SAFE_INTEGER)
                            ? Number.MAX_SAFE_INTEGER
                            : Number(combos),
                        );
                        const eta = renderEstimateMinutes(willRender);
                        return (
                          <>
                            <p className="mt-3 rounded-lg border border-primary/40 bg-primary/10 p-3 text-xs text-muted-foreground">
                              Pivah will render{" "}
                              <span className="numeric font-semibold text-foreground">
                                {willRender.toLocaleString()}
                              </span>{" "}
                              unique items from {combos.toLocaleString()} possible combinations,
                              each with its own artwork and traits — no supply cap, this can go as
                              high as you want.
                              {eta > 2 ? (
                                <>
                                  {" "}
                                  At this size, expect roughly{" "}
                                  <span className="numeric font-semibold text-foreground">
                                    {eta}
                                  </span>{" "}
                                  min — keep this tab open and your connection stable until it
                                  finishes.
                                </>
                              ) : null}
                            </p>
                            <CombinationPreview layers={layers} />
                          </>
                        );
                      })()
                    : null}
                </div>
              ) : null}
            </Panel>
          ) : null}

          <Panel className="p-5">
            <SectionTitle title="Details" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Name"
                placeholder="Orangutan World"
                value={form.name}
                onChange={set("name")}
              />
              <Field
                label="Symbol"
                placeholder="ORG"
                value={form.symbol}
                onChange={set("symbol")}
              />
              <div className="sm:col-span-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => set("description")(e.target.value)}
                  rows={3}
                  placeholder="What is this project about?"
                  className="mt-1.5 w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60"
                />
              </div>
              {kind === "collection" ? (
                <>
                  <Field
                    label="Maximum supply"
                    value={form.maxSupply}
                    onChange={set("maxSupply")}
                    mono
                    placeholder="1000"
                  />
                  <Field
                    label="NFTs to mint now"
                    value={form.initialMint}
                    onChange={set("initialMint")}
                    mono
                    placeholder="10"
                  />
                </>
              ) : null}
              <Field
                label="Royalty (bps, 500 = 5%)"
                value={form.royaltyBps}
                onChange={set("royaltyBps")}
                mono
                placeholder="500"
              />
            </div>
            {kind === "collection" ? (
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                There's no fixed sale price here — mint your supply to your own wallet, then set the
                price by seeding a DEX pool (continuous, trade-like-a-token pricing) or by listing
                items individually on the Marketplace at whatever price you choose.
              </p>
            ) : null}
          </Panel>
        </div>

        <div className="space-y-4">
          {kind === "single" || artworkMode === "shared" ? (
            <Panel className="p-5">
              <SectionTitle title="Artwork" hint={generative ? "optional" : "required"} />
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/40 p-6 text-center">
                {preview ? (
                  <img
                    src={preview}
                    alt="Artwork preview"
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                ) : (
                  <>
                    <ImagePlus className="size-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Click to upload PNG, JPG, WEBP or GIF
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {generative
                  ? "You added trait layers, so each NFT gets its own generated artwork — this single image is ignored."
                  : "Pivah stores the artwork and serves your token metadata automatically, so you never have to create a metadata base URI by hand."}
              </p>
            </Panel>
          ) : (
            <Panel className="p-5">
              <SectionTitle title="Collection cover artwork" hint="optional" />
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/40 p-6 text-center">
                {coverPreview ? (
                  <img
                    src={coverPreview}
                    alt="Cover artwork preview"
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                ) : (
                  <>
                    <ImagePlus className="size-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Upload a hero image for this collection
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => pickCoverFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {coverPreview
                  ? "This is what shows up on the Marketplace, DEX and Projects listings for the whole collection — separate from each individual NFT's generated artwork."
                  : "Skip this and Pivah uses your first generated combination as the cover instead. Upload one here if you want a specific hero shot — a mascot pose, key art, or your main character front and centre — representing the collection."}
              </p>
              <div className="mt-4 rounded-xl border border-dashed border-border bg-background/40 p-4 text-center">
                <Layers3 className="mx-auto size-6 text-primary" />
                <p className="mt-2 text-xs font-semibold">Individual NFT artwork</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Comes from your layer traits below — add at least one trait to every layer.
                </p>
              </div>
            </Panel>
          )}

          <Button
            onClick={launch}
            disabled={!canSubmit}
            className="h-auto w-full rounded-xl bg-brand-gradient px-5 py-3.5 text-sm font-semibold shadow-glow"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
            {!isConnected
              ? "Connect wallet"
              : step
                ? step
                : kind === "single"
                  ? "Create & mint NFT"
                  : "Create & deploy collection"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Success({ result }: { result: Result }) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Creator Studio"
        title={result.kind === "single" ? "Your NFT is live" : "Your collection is live"}
        description="The contract and NFTs are live on Base Sepolia, and their metadata is served by Pivah."
      />
      <Panel className="space-y-4 p-5">
        <div className="flex items-center gap-2 text-success">
          <CheckCircle2 className="size-5" />
          <span className="text-sm font-semibold">Deployment confirmed</span>
        </div>
        <Row label="Contract" value={result.contract} />
        <Row label="Metadata base URI" value={result.baseUri} />
        {result.generated > 0 ? (
          <Row label="Unique items generated" value={String(result.generated)} />
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2">
          {result.kind === "collection" ? (
            <>
              <Link
                to="/dex/pools"
                search={{ collection: result.contract, create: true }}
                className="rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
              >
                Create DEX pool
              </Link>
              <Link
                to="/marketplace"
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
              >
                List on Marketplace
              </Link>
              <Link
                to="/projects"
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
              >
                View my projects
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/marketplace"
                className="rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
              >
                List on Marketplace
              </Link>
              <Badge tone="warning">1/1 NFTs trade on the Marketplace only</Badge>
            </>
          )}
          <Link
            to="/projects"
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
          >
            My projects
          </Link>
        </div>
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="numeric mt-1 break-all text-xs">{value}</p>
    </div>
  );
}

function KindCard({
  active,
  onClick,
  title,
  detail,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-colors ${
        active ? "border-primary bg-primary/10" : "border-border bg-background/40"
      }`}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </button>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  mono,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60 ${
          mono ? "numeric" : ""
        }`}
      />
    </div>
  );
}
