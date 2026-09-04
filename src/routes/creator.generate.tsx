import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Play, AlertTriangle } from "lucide-react";

import { PageHeader, Panel, SectionTitle, Badge } from "@/components/ui/pivah";

export const Route = createFileRoute("/creator/generate")({
  head: () => ({
    meta: [
      { title: "NFT Generator — Pivah Creator Studio" },
      {
        name: "description",
        content:
          "Deterministic, seeded generative NFT output. Generate a small test batch or the full collection — maximum supply and generate-now are separate settings.",
      },
      { property: "og:title", content: "NFT Generator — Pivah Creator Studio" },
      {
        property: "og:description",
        content:
          "Seeded, batched, deterministic NFT generation with DNA hashing and metadata output.",
      },
    ],
  }),
  component: GeneratePage,
});

const POSSIBLE_COMBINATIONS = 540;

function GeneratePage() {
  const [maxSupply, setMaxSupply] = useState(10000);
  const [generateNow, setGenerateNow] = useState(3);
  const [batchSize, setBatchSize] = useState(50);
  const [width, setWidth] = useState(1000);
  const [height, setHeight] = useState(1000);
  const [seed, setSeed] = useState("pivah-genesis");
  const [allowDuplicates, setAllowDuplicates] = useState(false);

  const exceedsCombos = !allowDuplicates && generateNow > POSSIBLE_COMBINATIONS;
  const blocked = exceedsCombos || generateNow < 1;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Creator"
        title="NFT Generator"
        description="Generation is deterministic code, not AI. The same layers, weights and seed always reproduce the same sequence."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel className="p-5">
          <SectionTitle title="Generation settings" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Maximum supply"
              hint="The collection cap. Never changes per batch."
              value={maxSupply}
              onChange={setMaxSupply}
            />
            <Field
              label="Generate now"
              hint="How many to produce in THIS run."
              value={generateNow}
              onChange={setGenerateNow}
              highlight
            />
            <Field label="Batch size" value={batchSize} onChange={setBatchSize} />
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Seed
              </label>
              <input
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background/60 px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Deterministic. Same seed = same output.
              </p>
            </div>
            <Field label="Image width" value={width} onChange={setWidth} />
            <Field label="Image height" value={height} onChange={setHeight} />
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/40 p-3">
            <input
              type="checkbox"
              checked={allowDuplicates}
              onChange={(e) => setAllowDuplicates(e.target.checked)}
              className="mt-0.5 size-4 accent-[oklch(0.62_0.222_295)]"
            />
            <span className="text-sm">
              Allow duplicate DNA
              <span className="block text-xs text-muted-foreground">
                Off by default. With it off, you cannot generate more items than the number of
                unique trait combinations.
              </span>
            </span>
          </label>

          {exceedsCombos ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>
                You asked for {generateNow.toLocaleString()} items but only{" "}
                {POSSIBLE_COMBINATIONS.toLocaleString()} unique combinations exist. Add traits, or
                explicitly allow duplicates.
              </span>
            </div>
          ) : null}

          <button
            disabled={blocked}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="size-4" />
            Generate {generateNow.toLocaleString()} NFT
            {generateNow === 1 ? "" : "s"}
          </button>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5">
            <SectionTitle title="This run" />
            <dl className="space-y-2.5 text-sm">
              <Row k="Possible combinations" v={POSSIBLE_COMBINATIONS.toLocaleString()} />
              <Row k="Generating now" v={generateNow.toLocaleString()} />
              <Row k="Collection cap" v={maxSupply.toLocaleString()} />
              <Row
                k="Remaining after run"
                v={Math.max(0, maxSupply - generateNow).toLocaleString()}
              />
              <Row k="Batches" v={String(Math.ceil(generateNow / Math.max(1, batchSize)))} />
              <Row k="Canvas" v={`${width} × ${height}`} />
            </dl>
          </Panel>

          <Panel className="p-5">
            <SectionTitle title="Output per NFT" />
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {[
                "Edition number",
                "DNA + DNA hash",
                "Selected traits",
                "Name & description",
                "Image filename",
                "Metadata filename",
              ].map((i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primary" />
                  {i}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  highlight,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  highlight?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`mt-1.5 h-11 w-full rounded-xl border bg-background/60 px-3 text-sm outline-none focus:ring-2 focus:ring-ring/25 ${
          highlight ? "border-primary/60" : "border-border focus:border-primary/60"
        }`}
      />
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="numeric font-medium">{v}</dd>
    </div>
  );
}
