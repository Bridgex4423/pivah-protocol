import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/nft/$projectId/image/$tokenId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const tokenId = Number(params.tokenId.replace(/\.(png|jpg|jpeg|webp)$/i, ""));
        if (!Number.isFinite(tokenId)) return new Response("Not found", { status: 404 });

        const { data: token } = await supabaseAdmin
          .from("nft_tokens")
          .select("image_path")
          .eq("project_id", params.projectId)
          .eq("token_id", tokenId)
          .maybeSingle();

        if (!token?.image_path) return new Response("Not found", { status: 404 });

        const { data, error } = await supabaseAdmin.storage
          .from("nft-assets")
          .download(token.image_path);

        if (error || !data) return new Response("Not found", { status: 404 });

        return new Response(await data.arrayBuffer(), {
          headers: {
            "content-type": data.type || "image/png",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
