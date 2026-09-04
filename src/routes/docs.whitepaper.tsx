import { createFileRoute, Link } from "@tanstack/react-router";
import { Download } from "lucide-react";

import { PageHeader, Panel, Badge } from "@/components/ui/pivah";

export const DESCRIPTION =
  "Pivah Protocol whitepaper — the problem, the solution, and how Creator Studio, the DEX, Marketplace and Staking work together.";

export const Route = createFileRoute("/docs/whitepaper")({
  head: () => ({
    meta: [
      { title: "Whitepaper | Pivah Protocol" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Whitepaper | Pivah Protocol" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WhitepaperPage,
});

const pillars = [
  [
    "Creator Studio",
    "Deploy an ERC-721 collection — one shared image at any supply, or unique 1-of-1 NFTs generated from layered traits with rarity weights.",
  ],
  [
    "Pivah DEX",
    "Bonding-curve liquidity pools per collection. Deposit NFTs + WETH, price is derived from that ratio, then every buy/sell steps price automatically — no order book, no waiting for a matching buyer.",
  ],
  [
    "Marketplace",
    "Peer-to-peer listings at a chosen price, with the NFT held in escrow from the moment it's listed until sold or the listing is cancelled.",
  ],
  [
    "Staking",
    "Stake any NFT, from any collection, and earn PIVAH continuously from a shared reward pool.",
  ],
];

function WhitepaperPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Docs"
        title="Whitepaper"
        description={DESCRIPTION}
        actions={
          <a
            href="/docs/Pivah-Whitepaper.pdf"
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
          Contracts independently audited by Web3Sentinel. This document does not constitute
          financial, legal, or investment advice.
        </span>
      </Panel>

      <Panel className="space-y-5 p-5 sm:p-7">
        <section>
          <h2 className="text-lg font-bold">Abstract</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Pivah Protocol gives NFT collections the same liquidity mechanics that tokens have taken
            for granted since Uniswap: continuous, automated, on-chain price discovery — without
            needing a matching buyer to show up. A creator deploys a collection, seeds a
            bonding-curve pool with their NFTs and WETH, and from that moment any of those NFTs can
            be bought or sold instantly against the pool at a price the market moves in real time.
            Alongside the DEX, Pivah provides a full Creator Studio for minting, a peer-to-peer
            Marketplace for fixed-price sales, and a staking system that rewards NFT holders — from
            any collection, not only Pivah's own — with PIVAH. Every mechanism described here is
            live on Base mainnet today, with real users minting, trading, listing, and staking
            through the protocol, and with every contract independently audited.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">1. The Problem</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            NFT liquidity today mostly means one thing: list an item and wait. A marketplace listing
            is a static price sitting idle until exactly one buyer decides it's worth exactly that
            much. There is no depth, no continuous price signal, and no way to exit a position
            quickly without accepting whatever the highest current bid happens to be — if there is
            one at all. Fungible tokens solved this problem years ago with automated market makers;
            NFTs, being non-fungible by definition, were structurally excluded from that solution.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Separately, launching a collection has traditionally meant choosing one narrow model:
            either a single generative art drop with a fixed mint price, or nothing. Founders who
            want a token-like supply model — pick any total supply, no fixed sale price, let the
            market decide value after launch — have had no clean tooling for that.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">2. The Pivah Solution</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Pivah treats an NFT collection the way a token launch treats a token: the founder
            decides supply and mints to their own wallet, then price discovery happens entirely in
            the open market — through a DEX pool, a marketplace listing, or both. Four components
            work together to make that possible:
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            {pillars.map(([name, desc], i) => (
              <div
                key={name}
                className={`grid grid-cols-[8rem_1fr] gap-3 p-3.5 text-sm sm:grid-cols-[10rem_1fr] ${i % 2 ? "bg-background/40" : ""}`}
              >
                <p className="font-semibold text-primary">{name}</p>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold">3. Protocol Architecture</h2>

          <h3 className="mt-4 text-sm font-bold text-primary">3.1 Creator Studio</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Two paths to a collection, matched to what a creator actually has ready. Shared artwork
            — every token points at one image, any supply, zero setup; this scales cleanly to
            thousands of tokens with no per-item rendering cost. Generative traits — upload layered
            artwork with rarity weights; Pivah composites unique combinations client-side, with a
            live preview before anything is deployed and a visual alignment guide so accessory art
            lines up correctly. Either way, the founder mints their chosen supply to their own
            wallet at zero cost — no fixed public sale price is set.
          </p>

          <h3 className="mt-4 text-sm font-bold text-primary">3.2 Pivah DEX</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            A pool's starting price is never typed in by a founder — it is derived automatically
            from the ratio of the very first NFT + WETH deposit, exactly the way a Uniswap pair's
            price comes from its first liquidity deposit. Linear curves move price by a fixed WETH
            amount per trade; exponential curves move it by a fixed percentage. Liquidity providers
            earn a share of every trade's LP fee; a separate protocol fee routes to the treasury.
          </p>

          <h3 className="mt-4 text-sm font-bold text-primary">3.3 Marketplace</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Listing an NFT moves it into escrow immediately — the same custody model the DEX pools
            and staking vault use — so a listed NFT cannot simultaneously be staked or pooled
            elsewhere. Founders listing large collections can price every token identically or
            assign a distinct price per token using bulk pricing tools, rather than typing hundreds
            of individual values. Creator royalties (ERC-2981) are honoured automatically, capped at
            10%.
          </p>

          <h3 className="mt-4 text-sm font-bold text-primary">3.4 Staking</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            The staking vault accepts NFTs from any ERC-721 collection, with no whitelist. Every
            staked NFT is one equal share of a fixed per-second PIVAH emission, regardless of which
            collection it comes from. No lock-up — unstake any NFT at any time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">4. The PIVAH Token</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            PIVAH has a fixed supply of 1,000,000,000 minted once — the token contract has no mint
            function, so supply can never expand after launch. Today, PIVAH's core utility is the
            staking reward described above; governance rights are intended to follow. Full
            allocation, vesting and emission detail is in the{" "}
            <Link to="/docs/tokenomics" className="text-primary hover:underline">
              Tokenomics
            </Link>{" "}
            document.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">5. Security & Trust Model</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              Custodial where it matters: DEX pools, staking, and marketplace listings all hold
              assets in the contract itself while active, not just an approval.
            </li>
            <li>
              No admin backdoors on core trading logic — pool pricing is purely a function of
              deposits and trades.
            </li>
            <li>
              Live on Base mainnet, with every core contract independently audited by Web3Sentinel
              and verified source code publicly readable on BaseScan.
            </li>
            <li>
              Real usage, not a simulation: live trading, listings, and staking activity is
              happening on mainnet today, verifiable directly on-chain.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold">6. Roadmap</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The core protocol, audit, and mainnet deployment are complete. Pivah is now focused on
            ecosystem growth — deeper liquidity, more creators, and progressive decentralisation.
            Full detail is in the{" "}
            <Link to="/docs/roadmap" className="text-primary hover:underline">
              Roadmap
            </Link>{" "}
            document.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">7. Governance</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            At present, Pivah Protocol's contracts are controlled by its founding team. The
            roadmap's final phase is an explicit, deliberate handover: a DAO framework governing
            treasury allocation and protocol parameters, with control progressively transferred to
            PIVAH holders.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">8. Risks & Disclaimers</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Pivah Protocol's contracts have been independently audited and are live on Base mainnet.
            An audit reduces but does not eliminate risk: smart contracts — audited or not — carry
            an inherent risk of bugs, exploits, or unexpected behaviour. Cryptocurrency and NFT
            markets are volatile; nothing in this document should be read as a guarantee of value,
            liquidity, or future price performance for PIVAH or any NFT traded through the protocol.
            This document is for informational purposes only and does not constitute financial,
            legal, or investment advice, nor an offer or solicitation to buy or sell any asset.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">9. Conclusion</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Pivah's premise is simple: NFTs deserve the same liquidity infrastructure that tokens
            have had for years, and creators deserve tooling that doesn't force a choice between
            "one drop, one fixed price" and nothing. What's described here is not a roadmap promise
            — it is a protocol that is live on Base mainnet, independently audited, and in active
            use today, with real users minting, trading, listing, and staking through it.
          </p>
        </section>
      </Panel>
    </div>
  );
}
