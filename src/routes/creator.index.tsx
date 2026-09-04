import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";

import { PageHeader, Panel, SectionTitle, Badge } from "@/components/ui/pivah";

export const Route = createFileRoute("/creator/")({
  head: () => ({
    meta: [
      { title: "Creator Studio — Pivah Protocol" },
      {
        name: "description",
        content:
          "Build layer-based generative NFT collections: base character, layers, traits, weighted rarity, live composite preview, IPFS upload and contract deployment.",
      },
      { property: "og:title", content: "Creator Studio — Pivah Protocol" },
      {
        property: "og:description",
        content:
          "Layer-based generative NFT collection creation, from traits to deployed contract.",
      },
    ],
  }),
  component: CreatorStudio,
});

const steps = [
  { title: "Create Project", body: "Name, symbol, description, max supply, standard." },
  { title: "Base Character", body: "The character every overlay trait aligns to." },
  { title: "Layers", body: "Background, body, eyes, mouth, headwear, accessories." },
  { title: "Traits", body: "Transparent, canvas-sized PNG/WebP per trait." },
  { title: "Rarity", body: "Per-trait weights drive selection probability." },
  { title: "Preview", body: "Live composite over the base character." },
  { title: "Generate", body: "Deterministic seeded generation, batch by batch." },
  { title: "IPFS", body: "Image CID, then metadata CID." },
  { title: "Deploy", body: "Collection contract via PivahCollectionFactory." },
  { title: "Launch", body: "Public mint, marketplace listing, or a DEX pool." },
];

function CreatorStudio() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Creator"
        title="Creator Studio"
        description="Creation is not minting. This module takes you from an empty project to a deployed, tradable collection — with correct layer alignment enforced along the way."
        actions={
          <Link
            to="/creator/new"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            New project <ArrowRight className="size-4" />
          </Link>
        }
      />

      <section>
        <SectionTitle title="Workflow" />
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Panel className="h-full p-4">
                <div className="flex items-center gap-2">
                  <span className="numeric text-xs text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-sm font-semibold">{s.title}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </Panel>
            </li>
          ))}
        </ol>
      </section>

      <Panel className="border-warning/40 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning">
            !
          </span>
          <div>
            <h3 className="text-sm font-semibold">Trait assets must be overlays</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Every trait file must be a transparent image at the full canvas size (e.g.
              1000&times;1000) with the artwork positioned exactly where it sits on the base
              character. A cropped image of just a hat, or a complete piece of finished artwork,
              will composite incorrectly. Pivah validates dimensions and transparency at upload
              time.
            </p>
          </div>
        </div>
      </Panel>

      <section>
        <SectionTitle title="Jump to" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              to: "/creator/new" as const,
              label: "New project",
              body: "Single 1/1 NFT or a full collection, deployed in one flow.",
            },
            {
              to: "/creator/workspace" as const,
              label: "Workspace",
              body: "Project status and quick actions.",
            },
            {
              to: "/creator/layers" as const,
              label: "Layers & Traits",
              body: "Define layer order and trait weights.",
            },
          ].map((l) => (
            <Link key={l.to} to={l.to}>
              <Panel className="h-full p-4 transition-colors hover:border-primary/50">
                <h3 className="text-sm font-semibold">{l.label}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{l.body}</p>
              </Panel>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
