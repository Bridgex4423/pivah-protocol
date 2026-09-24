import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, PieChart, Map, BookOpenCheck } from "lucide-react";

import { PageHeader, Panel } from "@/components/ui/pivah";

export const DESCRIPTION =
  "How Pivah works, plus the whitepaper, tokenomics and roadmap — the full picture of the protocol, how PIVAH is allocated, and what's next.";

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "Docs — How It Works, Whitepaper, Tokenomics & Roadmap | Pivah" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Docs — Pivah Protocol" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DocsIndex,
});

const docs = [
  {
    to: "/docs/how-it-works" as const,
    icon: BookOpenCheck,
    title: "How Pivah Works",
    body: "A practical, step-by-step guide to minting, the Marketplace, the DEX, and staking — start here.",
    pdf: "/docs/Pivah-How-It-Works.pdf",
  },
  {
    to: "/docs/whitepaper" as const,
    icon: FileText,
    title: "Whitepaper",
    body: "What Pivah is, the problem it solves, and how Creator Studio, the DEX, Marketplace and Staking work together.",
    pdf: "/docs/Pivah-Whitepaper.pdf",
  },
  {
    to: "/docs/tokenomics" as const,
    icon: PieChart,
    title: "Tokenomics",
    body: "PIVAH's supply, allocation, vesting schedule and utility — with a full allocation chart and unlock timeline.",
    pdf: "/docs/Pivah-Tokenomics.pdf",
  },
  {
    to: "/docs/roadmap" as const,
    icon: Map,
    title: "Roadmap",
    body: "Where the protocol stands today and what comes next, phase by phase — live on mainnet, now focused on growth.",
    pdf: "/docs/Pivah-Roadmap.pdf",
  },
];

function DocsIndex() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Resources" title="Docs" description={DESCRIPTION} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {docs.map((d) => (
          <Panel key={d.to} className="flex flex-col p-5">
            <d.icon className="size-6 text-primary" />
            <h2 className="mt-3 text-base font-semibold">{d.title}</h2>
            <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">{d.body}</p>
            <div className="mt-4 flex items-center gap-2">
              <Link
                to={d.to}
                className="flex-1 rounded-xl bg-brand-gradient px-4 py-2.5 text-center text-xs font-semibold text-primary-foreground shadow-glow"
              >
                Read
              </Link>
              <a
                href={d.pdf}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                PDF
              </a>
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="p-5 text-xs leading-relaxed text-muted-foreground">
        Pivah Protocol is live on Base mainnet, with contracts independently audited by
        Web3Sentinel. Nothing here is investment advice or an offer of securities — see each
        document's disclaimer section for full detail.
      </Panel>
    </div>
  );
}
