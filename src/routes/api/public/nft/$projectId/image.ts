import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/nft/$projectId/image")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: project } = await supabaseAdmin
          .from("nft_projects")
          .select("image_path")
          .eq("id", params.projectId)
          .maybeSingle();

        if (!project?.image_path) {
          return new Response("Not found", { status: 404 });
        }

        const { data, error } = await supabaseAdmin.storage
          .from("nft-assets")
          .download(project.image_path);

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
