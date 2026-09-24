import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ProjectKind = "single" | "collection";

export interface StudioProject {
  id: string;
  creator_wallet: string;
  kind: string;
  name: string;
  symbol: string;
  description: string;
  image_path: string | null;
  max_supply: number;
  mint_price_eth: string;
  royalty_bps: number;
  contract_address: string | null;
  chain_id: number;
  created_at: string;
}

const BUCKET = "nft-assets";
// Fallback only for SSR/edge contexts where window isn't available. In the
// browser (where every collection is actually created) we always use the
// real page origin below, so minted NFTs point at wherever this app is
// actually hosted — not a stale preview URL.
const FALLBACK_METADATA_ORIGIN = "http://localhost:8080";

/** Public, contract-safe metadata base URI — ERC721 appends the token id.
 *  Whatever origin the app is running on when a collection is created is
 *  baked into every token's URI (via setBaseURI on-chain), so make sure
 *  you're on your real production domain — not localhost — before deploying
 *  a collection you intend to keep live. */
export function metadataBaseUri(projectId: string, origin?: string) {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : FALLBACK_METADATA_ORIGIN);
  return `${base}/api/public/nft/${projectId}/meta/`;
}

export function projectImageUrl(projectId: string) {
  return `/api/public/nft/${projectId}/image`;
}

export async function uploadProjectImage(projectId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${projectId}/artwork.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || "image/png" });
  if (error) throw new Error(error.message);
  return path;
}

export interface NewProjectInput {
  creator_wallet: string;
  kind: ProjectKind;
  name: string;
  symbol: string;
  description: string;
  max_supply: number;
  mint_price_eth: string;
  royalty_bps: number;
  chain_id: number;
}

export async function createProject(input: NewProjectInput) {
  const { data, error } = await supabase.from("nft_projects").insert(input).select().single();
  if (error) throw new Error(error.message);
  return data as StudioProject;
}

export async function updateProject(id: string, patch: Partial<StudioProject>) {
  const { error } = await supabase
    .from("nft_projects")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from("nft_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchProjects(wallet?: string, chainId?: number) {
  let q = supabase.from("nft_projects").select("*").order("created_at", { ascending: false });
  if (wallet) q = q.eq("creator_wallet", wallet.toLowerCase());
  if (chainId) q = q.eq("chain_id", chainId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as StudioProject[];
}

/** Scoped to both the connected wallet and the connected network when a
 *  wallet is connected — a collection created on testnet should never
 *  appear while browsing mainnet with the same wallet, or vice versa. With
 *  no wallet connected, this intentionally stays unfiltered (a public
 *  browse view), rather than showing nothing. */
export function useStudioProjects(wallet?: string, chainId?: number) {
  return useQuery({
    queryKey: ["nft_projects", wallet ?? "all", chainId ?? "all"],
    queryFn: () => fetchProjects(wallet, chainId),
    refetchInterval: 20_000,
  });
}
