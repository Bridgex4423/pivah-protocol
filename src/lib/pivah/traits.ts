import { supabase } from "@/integrations/supabase/client";

/**
 * Generative layers: each layer is one slot (Background, Body, Eyes…) holding
 * weighted trait images. One trait per layer is picked per token, then all the
 * picked images are composited in layer order, bottom to top.
 */

export interface TraitInput {
  id: string;
  name: string;
  weight: number;
  file: File;
  url: string;
  /** Set after upload — true if the image has no transparent pixels at all. */
  opaque?: boolean;
}

export interface LayerInput {
  id: string;
  name: string;
  traits: TraitInput[];
}

export interface TokenPlan {
  tokenId: number;
  picks: { layer: string; trait: string; traitId: string }[];
}

const BUCKET = "nft-assets";
export const CANVAS_SIZE = 1000;

export function layerCombinations(layers: LayerInput[]) {
  return layers.reduce((acc, l) => (l.traits.length > 0 ? acc * BigInt(l.traits.length) : acc), 1n);
}

function pick(layer: LayerInput) {
  const total = layer.traits.reduce((s, t) => s + Math.max(0, t.weight), 0);
  let r = Math.random() * (total || 1);
  for (const t of layer.traits) {
    r -= Math.max(0, t.weight);
    if (r <= 0) return t;
  }
  return layer.traits[layer.traits.length - 1]!;
}

/** Unique weighted combinations, one per token id (ids start at 1). */
export function planTokens(layers: LayerInput[], count: number): TokenPlan[] {
  const usable = layers.filter((l) => l.traits.length > 0);
  const seen = new Set<string>();
  const plans: TokenPlan[] = [];
  const maxUnique = Number(
    layerCombinations(usable) > BigInt(count) ? BigInt(count) : layerCombinations(usable),
  );

  let guard = 0;
  while (plans.length < Math.min(count, maxUnique) && guard < count * 200) {
    guard += 1;
    const picks = usable.map((l) => {
      const t = pick(l);
      return { layer: l.name, trait: t.name, traitId: t.id };
    });
    const key = picks.map((p) => p.traitId).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    plans.push({ tokenId: plans.length + 1, picks });
  }
  return plans;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read a trait image"));
    img.src = url;
  });
}

/**
 * True if the image has at least some transparent pixels. Layers stack by
 * drawing each pick full-canvas on top of the last, so any trait above the
 * base layer that has NO transparency will completely blot out everything
 * beneath it — that's the #1 mistake that makes a "generated" collection
 * come out looking like just the top layer over and over.
 */
export async function hasTransparency(file: File): Promise<boolean> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return true; // fail open — don't block on an environment quirk
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      const alpha = data[i];
      if (alpha !== undefined && alpha < 250) return true;
    }
    return false;
  } catch {
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function composite(
  plan: TokenPlan,
  layers: LayerInput[],
  cache: Map<string, HTMLImageElement>,
) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser");

  for (const p of plan.picks) {
    const trait = layers.flatMap((l) => l.traits).find((t) => t.id === p.traitId);
    if (!trait) continue;
    let img = cache.get(trait.id);
    if (!img) {
      img = await loadImage(trait.url);
      cache.set(trait.id, img);
    }
    drawContained(ctx, img);
  }

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not render the artwork"))),
      "image/png",
    ),
  );
}

/**
 * Draws an image scaled to fit inside the canvas, preserving its aspect
 * ratio and centering it — never stretched/distorted. Every trait, whatever
 * its original dimensions, ends up on the exact same CANVAS_SIZE reference
 * frame, so as long as creators keep their subject centered and roughly the
 * same scale across layers, accessories line up on any base variant.
 */
function drawContained(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const scale = Math.min(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const x = (CANVAS_SIZE - w) / 2;
  const y = (CANVAS_SIZE - h) / 2;
  ctx.drawImage(img, x, y, w, h);
}

export interface PreviewItem {
  tokenId: number;
  url: string;
  picks: { layer: string; trait: string }[];
}

/**
 * Renders a handful of sample combinations entirely in the browser — no
 * Supabase upload, nothing on-chain. Lets a creator sanity-check that their
 * layers actually line up before committing to a deploy.
 */
export async function previewCombinations(layers: LayerInput[], count = 6): Promise<PreviewItem[]> {
  const usable = layers.filter((l) => l.traits.length > 0);
  if (usable.length === 0) return [];
  const plans = planTokens(usable, count);
  const cache = new Map<string, HTMLImageElement>();
  const out: PreviewItem[] = [];
  for (const plan of plans) {
    const blob = await composite(plan, usable, cache);
    out.push({
      tokenId: plan.tokenId,
      url: URL.createObjectURL(blob),
      picks: plan.picks.map((p) => ({ layer: p.layer, trait: p.trait })),
    });
  }
  return out;
}

export interface GenerateResult {
  coverPath: string;
  generated: number;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Failed after retries");
}

/**
 * Renders every planned token in the browser, uploads each PNG and records its
 * traits so the public metadata endpoint can serve a unique NFT per token id.
 * Uploads run a few at a time (not fully sequential, not all-at-once) and
 * each one retries on failure — a single dropped request on item 750 of 1000
 * doesn't throw away everything already uploaded before it.
 */
export async function generateAndStoreTokens(
  projectId: string,
  layers: LayerInput[],
  plans: TokenPlan[],
  onProgress?: (done: number, total: number) => void,
): Promise<GenerateResult> {
  const cache = new Map<string, HTMLImageElement>();
  const rows: {
    project_id: string;
    token_id: number;
    image_path: string;
    attributes: { trait_type: string; value: string }[];
  }[] = new Array(plans.length);

  const CONCURRENCY = 4;
  let cursor = 0;
  let done = 0;
  let firstError: Error | null = null;

  async function worker() {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= plans.length || firstError) return;
      const plan = plans[i]!;
      try {
        const blob = await withRetry(() => composite(plan, layers, cache));
        const path = `${projectId}/tokens/${plan.tokenId}.png`;
        await withRetry(async () => {
          const { error } = await supabase.storage
            .from(BUCKET)
            .upload(path, blob, { upsert: true, contentType: "image/png" });
          if (error) throw new Error(error.message);
        });
        rows[i] = {
          project_id: projectId,
          token_id: plan.tokenId,
          image_path: path,
          attributes: plan.picks.map((p) => ({ trait_type: p.layer, value: p.trait })),
        };
      } catch (err) {
        firstError = err instanceof Error ? err : new Error("Could not render an item");
        return;
      }
      done += 1;
      onProgress?.(done, plans.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, plans.length) }, worker));
  if (firstError) {
    throw new Error(
      `${(firstError as Error).message} — ${done}/${plans.length} items uploaded before this failed. Your project is saved; contact support to resume rather than starting over.`,
    );
  }

  const finalRows = rows.filter((r): r is NonNullable<typeof r> => Boolean(r));
  for (let i = 0; i < finalRows.length; i += 50) {
    await withRetry(async () => {
      const { error } = await supabase.from("nft_tokens").upsert(finalRows.slice(i, i + 50), {
        onConflict: "project_id,token_id",
      });
      if (error) throw new Error(error.message);
    });
  }

  return { coverPath: finalRows[0]?.image_path ?? "", generated: finalRows.length };
}
