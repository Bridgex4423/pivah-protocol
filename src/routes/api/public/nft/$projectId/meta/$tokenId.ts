import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/nft/$projectId/meta/$tokenId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: project } = await supabaseAdmin
          .from("nft_projects")
          .select("*")
          .eq("id", params.projectId)
          .maybeSingle();

        if (!project) return new Response("Not found", { status: 404 });

        const origin = new URL(request.url).origin;
        const tokenId = params.tokenId.replace(/\.json$/i, "");
        const isSingle = project.kind === "single";

        // Generative collections store one row per token with its own artwork
        // and traits; plain collections fall back to the shared project image.
        const { data: token } = await supabaseAdmin
          .from("nft_tokens")
          .select("token_id, image_path, attributes")
          .eq("project_id", project.id)
          .eq("token_id", Number(tokenId))
          .maybeSingle();

        const body = {
          name: isSingle ? project.name : `${project.name} #${tokenId}`,
          description: project.description,
          image: token
            ? `${origin}/api/public/nft/${project.id}/image/${tokenId}`
            : `${origin}/api/public/nft/${project.id}/image`,
          external_url: `${origin}/mint`,
          attributes: token
            ? Array.isArray(token.attributes)
              ? token.attributes
              : []
            : Array.isArray(project.attributes)
              ? project.attributes
              : [],
        };

        return new Response(JSON.stringify(body), {
          headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
            "cache-control": "public, max-age=60",
          },
        });
      },
    },
  },
});
