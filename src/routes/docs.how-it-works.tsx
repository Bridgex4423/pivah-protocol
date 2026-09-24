import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Sparkles, Store, Repeat, Coins } from "lucide-react";
import type { ReactNode } from "react";

import { PageHeader, Panel, Badge } from "@/components/ui/pivah";

export const DESCRIPTION =
  "A practical, step-by-step guide to using Pivah — how minting, the Marketplace, the DEX, and staking actually work.";

export const Route = createFileRoute("/docs/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Pivah Works | Pivah Protocol" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "How Pivah Works | Pivah Protocol" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowItWorksPage,
});

function Section({
  icon: Icon,
  title,
  tagline,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  tagline: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Icon className="size-4.5" />
        </span>
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground">{tagline}</p>
        </div>
      </div>
      <div className="space-y-3 pl-12">{children}</div>
    </section>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span className="numeric mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-background/60 text-xs font-bold text-muted-foreground">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function HowItWorksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Docs"
        title="How Pivah Works"
        description={DESCRIPTION}
        actions={
          <a
            href="/docs/Pivah-How-It-Works.pdf"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-raised"
          >
            <Download className="size-4" /> Download PDF
          </a>
        }
      />

      <Panel className="flex flex-wrap items-center gap-2 p-4">
        <Badge tone="primary">Start here</Badge>
        <span className="text-xs text-muted-foreground">
          Four things you can do on Pivah, in the order most people use them: mint, list or buy on
          the Marketplace, trade instantly on the DEX, and stake for rewards.
        </span>
      </Panel>

      <Panel className="space-y-8 p-5 sm:p-7">
        <Section icon={Sparkles} title="1. Mint an NFT" tagline="Create something to trade">
          <Step
            n={1}
            title="Go to Mint NFTs"
            body="Choose Single NFT for one unique piece, or Collection for many items sharing one contract."
          />
          <Step
            n={2}
            title="Add your artwork"
            body="Upload one shared image for every token, or upload layered traits and let Pivah generate unique combinations with rarity weights."
          />
          <Step
            n={3}
            title="Fill in the details"
            body="Name, symbol, description, supply, and — for collections — how many to mint right away."
          />
          <Step
            n={4}
            title="Create & deploy"
            body="One click deploys your contract. Large mints (over 80 tokens) happen in a few small batches automatically, so no single transaction gets too big to confirm."
          />
          <p className="pt-1 text-xs text-muted-foreground">
            Once minted, a single NFT can be listed on the Marketplace. A collection can also be
            deposited into a DEX pool to trade instantly, like a token.
          </p>
        </Section>

        <Section icon={Store} title="2. Marketplace" tagline="List at a price, or buy at one">
          <Step
            n={1}
            title="To list: pick your NFT(s) and a price"
            body="One shared price for a batch, or a different price per token if some are rarer than others."
          />
          <Step
            n={2}
            title="Your NFT moves into escrow"
            body="From the moment it's listed, the NFT is held safely by the Marketplace contract — it can't be staked or pooled elsewhere at the same time, and you can cancel anytime to get it straight back."
          />
          <Step
            n={3}
            title="To buy: pick a listing and confirm"
            body="If you're paying with plain ETH, Pivah wraps just enough of it into WETH automatically first — you don't need to think about that step."
          />
          <Step
            n={4}
            title="Sale proceeds"
            body="If you're the seller, payment lands in your wallet as WETH the moment your item sells. Convert it to ETH anytime from your Portfolio page."
          />
        </Section>

        <Section
          icon={Repeat}
          title="3. Pivah DEX"
          tagline="Trade instantly, no waiting for a buyer"
        >
          <Step
            n={1}
            title="Find or create a pool"
            body="Each collection can have one or more liquidity pools. If none exists yet, the first liquidity provider sets it up — the starting price is derived automatically from their deposit, never typed in by hand."
          />
          <Step
            n={2}
            title="Buy or sell against the pool"
            body="No matching buyer needed — trade directly against the pool's inventory. Price moves a little with every trade, the same way a token's price does on any DEX."
          />
          <Step
            n={3}
            title="Add liquidity (optional)"
            body="Deposit NFTs and WETH together to earn a share of every trade's fee. Withdraw your share anytime."
          />
        </Section>

        <Section icon={Coins} title="4. Staking" tagline="Stake NFTs, earn PIVAH">
          <Step
            n={1}
            title="Stake any NFT"
            body="From any collection — not just ones minted on Pivah. No lock-up: unstake anytime."
          />
          <Step
            n={2}
            title="Earn continuously"
            body="Every staked NFT earns an equal share of PIVAH rewards, accruing in real time for as long as it's staked."
          />
          <Step
            n={3}
            title="Claim your rewards"
            body="Claim your accumulated PIVAH whenever you like, directly from the Stake page."
          />
        </Section>
      </Panel>

      <Panel className="p-5 text-xs leading-relaxed text-muted-foreground">
        Want the fuller picture — tokenomics, roadmap, or the technical whitepaper? See the rest of{" "}
        <Link to="/docs" className="text-primary hover:underline">
          Docs
        </Link>
        .
      </Panel>
    </div>
  );
}
