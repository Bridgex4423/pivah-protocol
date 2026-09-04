import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GripVertical, Plus, Eye } from "lucide-react";

import { PageHeader, Panel, StatCard, Badge, SectionTitle } from "@/components/ui/pivah";

export const Route = createFileRoute("/creator/layers")({
  head: () => ({
    meta: [
      { title: "Layers & Traits — Pivah Creator Studio" },
      {
        name: "description",
        content:
          "Define layer order, add traits with rarity weights, and see possible combinations update live before you generate your Pivah collection.",
      },
      { property: "og:title", content: "Layers & Traits — Pivah Creator Studio" },
      {
        property: "og:description",
        content:
          "Layer ordering, weighted trait rarity, and combination maths for generative NFT collections.",
      },
    ],
  }),
  component: LayersPage,
});

interface Trait {
  id: string;
  name: string;
  weight: number;
  enabled: boolean;
}
interface Layer {
  id: string;
  name: string;
  traits: Trait[];
}

const seedLayers: Layer[] = [
  {
    id: "bg",
    name: "Background",
    traits: [
      { id: "bg1", name: "Purple", weight: 40, enabled: true },
      { id: "bg2", name: "Midnight", weight: 35, enabled: true },
      { id: "bg3", name: "Sunburst", weight: 25, enabled: true },
    ],
  },
  {
    id: "base",
    name: "Base Character",
    traits: [{ id: "b1", name: "Orangutan", weight: 100, enabled: true }],
  },
  {
    id: "cloth",
    name: "Clothing",
    traits: [
      { id: "c1", name: "Black Hoodie", weight: 30, enabled: true },
      { id: "c2", name: "Denim Jacket", weight: 25, enabled: true },
      { id: "c3", name: "Suit", weight: 10, enabled: true },
    ],
  },
  {
    id: "eyes",
    name: "Eyes",
    traits: [
      { id: "e1", name: "Laser Glasses", weight: 8, enabled: true },
      { id: "e2", name: "Calm", weight: 52, enabled: true },
      { id: "e3", name: "Shades", weight: 40, enabled: true },
    ],
  },
  {
    id: "head",
    name: "Headwear",
    traits: [
      { id: "h0", name: "None", weight: 55, enabled: true },
      { id: "h1", name: "Beanie", weight: 15, enabled: true },
      { id: "h2", name: "Crown", weight: 5, enabled: true },
      { id: "h3", name: "Cap", weight: 25, enabled: true },
    ],
  },
];

function LayersPage() {
  const [layers] = useState<Layer[]>(seedLayers);

  const { traitCount, combinations } = useMemo(() => {
    let traits = 0;
    let combos = 1n;
    for (const layer of layers) {
      const active = layer.traits.filter((t) => t.enabled);
      traits += active.length;
      if (active.length > 0) combos *= BigInt(active.length);
    }
    return { traitCount: traits, combinations: combos };
  }, [layers]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Creator"
        title="Layers & Traits"
        description="Layer order is render order, bottom to top. Every trait must be a transparent image at the full canvas size so it aligns with the base character."
        actions={
          <button className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">
            <Plus className="size-4" /> Add layer
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Layers" value={String(layers.length)} />
        <StatCard label="Traits" value={String(traitCount)} />
        <StatCard
          label="Possible combinations"
          value={combinations.toLocaleString()}
          tone="primary"
        />
        <StatCard label="Canvas" value="1000²" sub="pixels" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {layers.map((layer, index) => {
            const total = layer.traits
              .filter((t) => t.enabled)
              .reduce((sum, t) => sum + t.weight, 0);
            return (
              <Panel key={layer.id} className="p-4">
                <div className="flex items-center gap-3 pb-3">
                  <GripVertical className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">{layer.name}</h3>
                  <Badge>{`Order ${index + 1}`}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {layer.traits.length} traits
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {layer.traits.map((trait) => {
                    const pct = total ? (trait.weight / total) * 100 : 0;
                    return (
                      <li
                        key={trait.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2"
                      >
                        <span className="size-8 shrink-0 rounded-md border border-border bg-surface-raised" />
                        <span className="min-w-0 flex-1 truncate text-sm">{trait.name}</span>
                        <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
                          <div
                            className="h-full rounded-full bg-brand-gradient"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="numeric w-14 text-right text-xs text-muted-foreground">
                          {pct.toFixed(1)}%
                        </span>
                        <span className="numeric w-10 text-right text-xs">{trait.weight}</span>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            );
          })}
        </div>

        <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <Panel className="p-4">
            <SectionTitle title="Live composite preview" />
            <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-background/60">
              <div className="absolute inset-0 bg-glow" />
              <div className="absolute inset-0 grid place-items-center text-center text-xs text-muted-foreground">
                <span className="flex flex-col items-center gap-2">
                  <Eye className="size-5" />
                  Upload a base character to
                  <br />
                  preview the composite
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              The preview stacks selected traits over the base character in layer order, so
              alignment problems surface before generation — not after.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
