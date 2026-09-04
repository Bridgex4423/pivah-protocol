import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader, Panel, StatCard, Badge, SectionTitle } from "@/components/ui/pivah";

export const Route = createFileRoute("/creator/workspace")({
  head: () => ({
    meta: [
      { title: "Creator Workspace — Pivah Protocol" },
      {
        name: "description",
        content:
          "Track your Pivah collection project: layers, traits, possible combinations, generation status, IPFS CIDs and contract deployment state.",
      },
      { property: "og:title", content: "Creator Workspace — Pivah Protocol" },
      {
        property: "og:description",
        content: "One place to see project status from traits through to deployment.",
      },
    ],
  }),
  component: Workspace,
});

const stages = [
  { key: "Overview", done: true },
  { key: "Layers & Traits", done: false },
  { key: "Generate", done: false },
  { key: "Mint & Deploy", done: false },
  { key: "Launch", done: false },
];

function Workspace() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Creator"
        title="Workspace"
        description="No project loaded yet. Create a project to populate collection details, generation status and deployment state."
        actions={
          <Link
            to="/creator/new"
            className="rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            New project
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Layers" value="0" />
        <StatCard label="Traits" value="0" />
        <StatCard label="Possible combinations" value="0" tone="primary" />
        <StatCard label="Generated" value="0" tone="accent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel className="p-5">
          <SectionTitle title="Collection details" />
          <dl className="divide-y divide-border text-sm">
            {[
              ["Project name", "—"],
              ["Collection name", "—"],
              ["Symbol", "—"],
              ["Description", "—"],
              ["Max supply", "—"],
              ["Standard", "ERC-721"],
              ["Canvas", "1000 × 1000"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5">
            <SectionTitle title="Pipeline" />
            <ul className="space-y-2">
              {stages.map((s) => (
                <li
                  key={s.key}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5 text-sm"
                >
                  <span>{s.key}</span>
                  <Badge tone={s.done ? "success" : "muted"}>{s.done ? "Ready" : "Pending"}</Badge>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="p-5">
            <SectionTitle title="On-chain & storage" />
            <dl className="space-y-2 text-sm">
              {[
                ["Image CID", "Not uploaded"],
                ["Metadata CID", "Not uploaded"],
                ["Collection address", "Not deployed"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="numeric text-xs">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>

      <Panel className="p-5">
        <SectionTitle title="Quick actions" />
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { to: "/creator/layers" as const, label: "Manage layers & traits" },
            { to: "/creator/generate" as const, label: "Generate NFTs" },
            { to: "/projects" as const, label: "View my projects" },
          ].map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium transition-colors hover:border-primary/50"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
