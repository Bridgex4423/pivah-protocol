import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";

import { PageHeader, Panel, Badge } from "@/components/ui/pivah";

export const DESCRIPTION =
  "Where Pivah Protocol stands today and what comes next, phase by phase — live on Base mainnet, independently audited, in active use.";

export const Route = createFileRoute("/docs/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap | Pivah Protocol" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Roadmap | Pivah Protocol" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoadmapPage,
});

const phases = [
  {
    title: "Phase 0 — Foundation",
    status: "Completed",
    tone: "success" as const,
    items: [
      "Creator Studio — deploy a collection with one shared image (any supply) or generate unique 1-of-1 NFTs from layered traits, with a live local preview before anything touches the chain",
      "Pivah DEX — bonding-curve liquidity pools per collection; starting price derived automatically from a pool's first NFT+WETH deposit",
      "Marketplace — peer-to-peer listings with escrow, single or batch listing, per-NFT pricing for collections where rarity should command different prices",
      "Staking — the PIVAH token and an NFT-staking vault that accepts any collection, from any origin",
    ],
  },
  {
    title: "Phase 1 — Protocol Hardening",
    status: "Completed",
    tone: "success" as const,
    items: [
      "Extensive real-world validation before mainnet — real collections, real pools, and real trades, with every early participant's activity tracked for the reward consideration that later shaped Phase 2's staking rollout",
      "UX friction fixed as found — automatic DEX pricing, marketplace escrow, and bulk NFT pricing tools all shipped in direct response to real usage",
      "Hardened the generative trait-collection pipeline: canvas alignment, transparency validation, visual alignment guides",
    ],
  },
  {
    title: "Phase 2 — Audit & Mainnet Launch",
    status: "Completed",
    tone: "success" as const,
    items: [
      "Independent, professional smart contract audit of every core contract by Web3Sentinel",
      "All audit findings addressed prior to launch",
      "Full mainnet deployment on Base — core protocol, PIVAH token, and NFT staking vault, all independently verified on BaseScan",
    ],
  },
  {
    title: "Phase 3 — Ecosystem Growth",
    status: "In progress",
    tone: "primary" as const,
    items: [
      "Active creator onboarding — collections from outside Pivah's own Creator Studio are already fully supported today",
      "Real trading activity across the Marketplace and DEX, with live NFT staking and reward accrual",
      "Exchange listing outreach for PIVAH in progress",
      "On-chain vesting contracts for team, advisor and community token allocations — not manual transfers",
      "Mobile-first refinements across Creator Studio, DEX and Marketplace",
      "Evaluate expansion beyond Base once mainnet usage patterns are understood",
      "Formal partnerships with complementary NFT and DeFi protocols",
    ],
  },
  {
    title: "Phase 4 — Decentralisation",
    status: "Planned",
    tone: "muted" as const,
    items: [
      "DAO governance framework covering treasury allocation and protocol parameters",
      "Progressive handover of Treasury/DAO Reserve control to token holders",
      "Protocol-owned liquidity strategy to reduce long-term reliance on external LPs",
    ],
  },
];

function RoadmapPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Docs"
        title="Roadmap"
        description={DESCRIPTION}
        actions={
          <a
            href="/docs/Pivah-Roadmap.pdf"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-raised"
          >
            <Download className="size-4" /> Download PDF
          </a>
        }
      />

      <Panel className="p-4 text-xs leading-relaxed text-muted-foreground">
        Timelines beyond today are indicative and will shift with security priorities and community
        feedback. Foundation, Protocol Hardening, and Audit & Mainnet Launch are complete — Pivah is
        live on Base mainnet and now focused on ecosystem growth.
      </Panel>

      <Panel className="p-4 sm:p-5">
        <img
          src="/docs/roadmap.png"
          alt="Pivah Protocol roadmap timeline"
          className="w-full rounded-xl"
        />
      </Panel>

      <div className="space-y-4">
        {phases.map((p) => (
          <Panel key={p.title} className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-bold">{p.title}</h2>
              <Badge tone={p.tone}>{p.status}</Badge>
            </div>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              {p.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <Panel className="p-5 text-xs leading-relaxed text-muted-foreground">
        Every contract now live on Base mainnet went through the same rigour before launch: audited
        independently, compiled, tested, and verified end to end — no change was treated as done
        until it was confirmed working against real transactions.
      </Panel>
    </div>
  );
}
