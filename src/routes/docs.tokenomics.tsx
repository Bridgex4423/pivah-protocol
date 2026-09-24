import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";

import { PageHeader, Panel, Badge } from "@/components/ui/pivah";

export const DESCRIPTION =
  "PIVAH supply, allocation, vesting schedule and utility — with a full allocation chart and unlock timeline.";

export const Route = createFileRoute("/docs/tokenomics")({
  head: () => ({
    meta: [
      { title: "Tokenomics | Pivah Protocol" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Tokenomics | Pivah Protocol" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TokenomicsPage,
});

const allocation = [
  [
    "Treasury / DAO Reserve",
    "25%",
    "250,000,000",
    "0%",
    "Protocol development, grants, future governance",
  ],
  [
    "Staking Rewards Pool",
    "20%",
    "200,000,000",
    "0% (emission)",
    "Funds continuous NFT-staking emissions",
  ],
  [
    "Community & Ecosystem",
    "20%",
    "200,000,000",
    "0%",
    "Rewards for early participants, airdrops, growth incentives",
  ],
  [
    "Liquidity (DEX + Exchanges)",
    "15%",
    "150,000,000",
    "15%",
    "Seeds DEX pools and exchange listings at launch",
  ],
  ["Private / Public Sale", "10%", "100,000,000", "5%", "Early backers and public participants"],
  [
    "Team & Founders",
    "5%",
    "50,000,000",
    "0%",
    "12-month cliff, then linear vesting over 36 months",
  ],
  [
    "Advisors & Partners",
    "5%",
    "50,000,000",
    "0%",
    "6-month cliff, then linear vesting over 18 months",
  ],
];

const vesting = [
  [
    "Liquidity",
    "100% at TGE (15% of total supply) — needed to seed DEX pools and exchange listings from day one",
  ],
  ["Private/Public Sale", "50% at TGE (5% of total supply), remainder linear over 6 months"],
  [
    "Team & Founders",
    "0% at TGE; 12-month cliff, then linear release over 36 months (48 months total)",
  ],
  ["Advisors & Partners", "0% at TGE; 6-month cliff, then linear release over 18 months"],
  ["Community & Ecosystem", "0% at TGE, linear over 24 months as the ecosystem grows"],
  [
    "Treasury/DAO Reserve",
    "0% at TGE, released on a DAO-paced schedule over 36 months, not a lump sum",
  ],
  [
    "Staking Rewards",
    "No TGE unlock at all; released continuously by the staking contract's emission rate",
  ],
];

function TokenomicsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Docs"
        title="Tokenomics"
        description={DESCRIPTION}
        actions={
          <a
            href="/docs/Pivah-Tokenomics.pdf"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-raised"
          >
            <Download className="size-4" /> Download PDF
          </a>
        }
      />

      <Panel className="flex flex-wrap items-center gap-2 p-4">
        <Badge tone="success">Live on Base mainnet</Badge>
        <span className="text-xs text-muted-foreground">
          Finalized allocation, already operational — the PIVAH token and staking vault deployed on
          mainnet use exactly the figures below.
        </span>
      </Panel>

      <Panel className="space-y-5 p-5 sm:p-7">
        <section>
          <h2 className="text-lg font-bold">1. Supply</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            PIVAH has a fixed total supply of 1,000,000,000 (one billion) tokens, minted once at
            deployment. The token contract has no minting function — supply can never be inflated
            after launch, only distributed from what already exists.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">2. Allocation</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The distribution is designed around a deliberately low initial circulating supply —
            exactly 20% of total supply is liquid at the Token Generation Event (TGE), coming
            entirely from the Liquidity allocation and half of the Sale allocation. Every other
            category, including the team, is 0% unlocked at TGE.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-primary/15 text-left text-xs uppercase tracking-wider text-primary">
                  <th className="p-3 font-semibold">Category</th>
                  <th className="p-3 font-semibold">% Supply</th>
                  <th className="p-3 font-semibold">Tokens</th>
                  <th className="p-3 font-semibold">% at TGE</th>
                  <th className="p-3 font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {allocation.map((row, i) => (
                  <tr key={row[0]} className={i % 2 ? "bg-background/40" : ""}>
                    <td className="p-3 font-medium">{row[0]}</td>
                    <td className="numeric p-3">{row[1]}</td>
                    <td className="numeric p-3 text-muted-foreground">{row[2]}</td>
                    <td className="numeric p-3 text-muted-foreground">{row[3]}</td>
                    <td className="p-3 text-xs text-muted-foreground">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <img
            src="/docs/tokenomics-pie.png"
            alt="PIVAH token allocation pie chart"
            className="mx-auto mt-5 max-w-md rounded-xl"
          />
        </section>

        <section>
          <h2 className="text-lg font-bold">3. Vesting & Unlock Schedule</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
            {vesting.map(([label, desc]) => (
              <li key={label}>
                <span className="font-medium text-foreground">{label}</span> — {desc}
              </li>
            ))}
          </ul>
          <img
            src="/docs/tokenomics-unlock.png"
            alt="PIVAH supply unlock schedule over 48 months"
            className="mx-auto mt-5 max-w-2xl rounded-xl"
          />
          <p className="mt-3 text-xs italic leading-relaxed text-muted-foreground">
            Important: this schedule is illustrative. At mainnet, cliff and vesting enforcement
            should be implemented as on-chain vesting contracts — not manual transfers — so the
            schedule is independently verifiable by anyone.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">4. Utility</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              Staking rewards: staking any NFT — from any collection, on Pivah or elsewhere — earns
              continuous PIVAH emissions from the vault's reward pool.
            </li>
            <li>
              Planned: governance rights over treasury allocation and protocol parameters as the DAO
              framework comes online.
            </li>
            <li>
              Planned: fee discounts or revenue-sharing for stakers, sourced from DEX and
              Marketplace protocol fees.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold">5. Emission Mechanics</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The staking vault (PivahNftStakingVault.sol) pays out PIVAH at a fixed rate per second,
            split evenly across every currently staked NFT regardless of collection. The current
            rate is calibrated to a 20,000,000 PIVAH Year 1 budget — 2% of total supply, the
            smallest of the four years, deliberately conservative since liquidity is thinnest
            immediately after launch. Both the rate and the vault's funding are adjustable by the
            contract owner as the protocol matures.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">6. Disclaimer</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            PIVAH is a utility token for the Pivah Protocol ecosystem. All contracts described here
            — including the token and staking vault — are live on Base mainnet and independently
            audited. Public token distribution has not yet occurred; the full supply remains held in
            treasury pending a deliberate Token Generation Event. This document is for informational
            purposes only and does not constitute financial, legal, or investment advice, nor an
            offer or solicitation to buy or sell any asset. Figures are subject to change before any
            public token distribution.
          </p>
        </section>
      </Panel>
    </div>
  );
}
