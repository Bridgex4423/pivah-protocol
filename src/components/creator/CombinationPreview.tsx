import { useState } from "react";
import { Loader2, ShieldCheck, Shuffle } from "lucide-react";
import { toast } from "sonner";

import { SectionTitle } from "@/components/ui/pivah";
import { Button } from "@/components/ui/button";
import { previewCombinations, type LayerInput, type PreviewItem } from "@/lib/pivah/traits";

export function CombinationPreview({ layers }: { layers: LayerInput[] }) {
  const [items, setItems] = useState<PreviewItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  const usable = layers.filter((l) => l.traits.length > 0);
  const ready = usable.length > 0 && usable.every((l) => l.traits.length > 0);

  async function run() {
    if (items) items.forEach((i) => URL.revokeObjectURL(i.url));
    setLoading(true);
    try {
      const next = await previewCombinations(layers, 6);
      setItems(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not render a preview");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle
          title="Preview combinations"
          hint="renders locally — nothing is uploaded or on-chain yet"
        />
        <Button type="button" variant="outline" onClick={run} disabled={loading} className="mt-0">
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : items ? (
            <Shuffle className="size-3.5" />
          ) : (
            <ShieldCheck className="size-3.5" />
          )}
          {loading ? "Rendering…" : items ? "Shuffle" : "Preview 6 combinations"}
        </Button>
      </div>

      {items && items.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.tokenId}
              className="rounded-lg border border-border bg-surface-raised p-2"
            >
              <img
                src={item.url}
                alt={`Preview combination ${item.tokenId}`}
                className="aspect-square w-full rounded object-cover"
              />
              <p className="mt-1.5 line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                {item.picks.map((p) => p.trait).join(" · ")}
              </p>
            </div>
          ))}
        </div>
      ) : items && items.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Not enough traits yet to render a combination.
        </p>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Check that every accessory lines up on every base variant before you deploy — the contract
        and metadata are only written once you click Create & deploy.
      </p>
    </div>
  );
}
