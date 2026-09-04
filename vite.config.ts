// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Lovable's hosted dev sandbox injects non-VITE_-prefixed env vars (Supabase
// service role key, OpenAI key, etc.) into the server process through their
// own infrastructure. That doesn't exist when running locally, so nothing
// was loading .env into process.env for server-side code. Do it explicitly
// here — this runs once, in the same Node process `vite dev`/`vite build`
// use, before any server code executes.
for (const [key, value] of Object.entries(loadEnv("", process.cwd(), ""))) {
  if (process.env[key] === undefined) process.env[key] = value;
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // This scaffold's default build target is Cloudflare Workers. Pivah is
  // hosted on Vercel, so pin the preset explicitly — Nitro's own platform
  // auto-detection would likely pick this correctly on Vercel's build
  // servers anyway, but an explicit preset removes any doubt and makes
  // local `npm run build` produce Vercel-shaped output for testing too.
  nitro: {
    preset: "vercel",
  },
  vite: {
    resolve: {
      alias: [
        // See src/lib/stubs/README.md — unused optional dep, broken shim.
        // Covers the bare specifier and every subpath import (e.g.
        // @x402/evm/exact/client) the SDK's dynamic-import helper probes.
        {
          find: /^@x402\/.*/,
          replacement: new URL("./src/lib/stubs/x402-evm.ts", import.meta.url).pathname,
        },
      ],
    },
  },
});
