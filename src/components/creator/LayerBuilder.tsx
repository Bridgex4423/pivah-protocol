import { useRef } from "react";
import { ImagePlus, Layers, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { SectionTitle } from "@/components/ui/pivah";
import { Button } from "@/components/ui/button";
import {
  hasTransparency,
  layerCombinations,
  type LayerInput,
  type TraitInput,
} from "@/lib/pivah/traits";

let seq = 0;
const uid = () => `l${Date.now().toString(36)}${(seq += 1)}`;

export function LayerBuilder({
  layers,
  onChange,
}: {
  layers: LayerInput[];
  onChange: (next: LayerInput[]) => void;
}) {
  const combos = layerCombinations(layers.filter((l) => l.traits.length > 0));

  function addLayer() {
    onChange([...layers, { id: uid(), name: `Layer ${layers.length + 1}`, traits: [] }]);
  }

  function update(id: string, patch: Partial<LayerInput>) {
    onChange(layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeLayer(id: string) {
    onChange(layers.filter((l) => l.id !== id));
  }

  function addTraits(layerId: string, files: FileList | null) {
    if (!files?.length) return;
    const layerIndex = layers.findIndex((l) => l.id === layerId);
    const next: TraitInput[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image`);
        continue;
      }
      next.push({
        id: uid(),
        name: file.name.replace(/\.[^.]+$/, ""),
        weight: 100,
        file,
        url: URL.createObjectURL(file),
      });
    }
    const layer = layers.find((l) => l.id === layerId);
    if (layer) update(layerId, { traits: [...layer.traits, ...next] });

    // Only the bottom-most layer is allowed to be fully opaque — everything
    // stacked above it needs transparency or it'll blot out every layer
    // underneath. Check in the background and flag anything that'll break.
    if (layerIndex > 0) {
      for (const trait of next) {
        hasTransparency(trait.file).then((transparent) => {
          if (transparent) return;
          updateTrait(layerId, trait.id, { opaque: true });
          toast.error(`"${trait.name}" has no transparent background`, {
            description: "It will completely cover every layer beneath it once stacked.",
          });
        });
      }
    }
  }

  function updateTrait(layerId: string, traitId: string, patch: Partial<TraitInput>) {
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;
    update(layerId, {
      traits: layer.traits.map((t) => (t.id === traitId ? { ...t, ...patch } : t)),
    });
  }

  function removeTrait(layerId: string, traitId: string) {
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;
    update(layerId, { traits: layer.traits.filter((t) => t.id !== traitId) });
  }

  return (
    <div>
      <SectionTitle
        title="Layers & traits"
        hint={
          layers.length === 0
            ? "optional — skip for identical items"
            : `${combos.toLocaleString()} possible combinations`
        }
      />

      <div className="space-y-3">
        {layers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-primary/50 bg-primary/5 px-5 py-6 text-center">
            <Layers className="mx-auto size-6 text-primary" />
            <p className="mt-2 text-sm font-semibold">Start with your bottom layer</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              Create a Background layer first, then upload all background trait images into it.
            </p>
            <Button type="button" onClick={addLayer} className="mt-4">
              <Plus /> Add first layer
            </Button>
          </div>
        ) : null}
        {layers.map((layer, index) => (
          <div key={layer.id} className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                #{index + 1}
              </span>
              <input
                value={layer.name}
                onChange={(e) => update(layer.id, { name: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-sm outline-none focus:border-primary/60"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeLayer(layer.id)}
                aria-label={`Remove ${layer.name}`}
                className="size-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {layer.traits.map((trait) => (
                <div
                  key={trait.id}
                  className="rounded-lg border border-border bg-surface-raised p-2"
                >
                  <img
                    src={trait.url}
                    alt={`${layer.name} trait ${trait.name}`}
                    className="h-16 w-full rounded object-contain"
                  />
                  {trait.opaque && index > 0 ? (
                    <div className="mt-1 flex items-center gap-1 text-[10px] leading-tight text-warning">
                      <TriangleAlert className="size-3 shrink-0" />
                      No transparency
                    </div>
                  ) : null}
                  <input
                    value={trait.name}
                    onChange={(e) => updateTrait(layer.id, trait.id, { name: e.target.value })}
                    className="mt-1.5 w-full rounded border border-border bg-background/60 px-1.5 py-1 text-[11px] outline-none"
                  />
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={trait.weight}
                      onChange={(e) =>
                        updateTrait(layer.id, trait.id, {
                          weight: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="numeric w-full rounded border border-border bg-background/60 px-1.5 py-1 text-[11px] outline-none"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeTrait(layer.id, trait.id)}
                      aria-label={`Remove trait ${trait.name}`}
                      className="size-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}

              <TraitUpload onFiles={(files) => addTraits(layer.id, files)} />
            </div>

            {index > 0 && layers[0]?.traits[0] && layer.traits[0] ? (
              <div className="mt-3 rounded-lg border border-dashed border-border bg-background/60 p-2">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Alignment guide — base layer faded behind, this layer's first trait on top
                </p>
                <div className="relative mx-auto aspect-square w-40 overflow-hidden rounded bg-black/20">
                  <img
                    src={layers[0].traits[0].url}
                    className="absolute inset-0 h-full w-full object-contain opacity-50"
                    alt=""
                  />
                  <img
                    src={layer.traits[0].url}
                    className="absolute inset-0 h-full w-full object-contain"
                    alt=""
                  />
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {layers.length > 0 ? (
        <Button type="button" variant="outline" onClick={addLayer} className="mt-3">
          <Plus className="size-4" /> Add layer
        </Button>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Layers stack bottom to top, so put Background first. Every trait except the base layer
        should be a transparent PNG. Images are fitted to the canvas without stretching and
        centered, so keep your subject centered and a similar scale across traits so accessories
        land in the same place on every base variant. The number next to each trait is its rarity
        weight — higher means it appears more often. Leave this empty to mint identical items from
        your single artwork.
      </p>
    </div>
  );
}

function TraitUpload({ onFiles }: { onFiles: (files: FileList | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => ref.current?.click()}
      className="h-full min-h-[110px] w-full flex-col gap-1 border-dashed p-2 text-xs text-muted-foreground"
    >
      <ImagePlus className="size-4" />
      Upload traits
      <input
        ref={ref}
        type="file"
        multiple
        accept="image/png,image/webp,image/jpeg"
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </Button>
  );
}
