import { Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { X } from "lucide-react";
import { base } from "wagmi/chains";

import { SidebarNav } from "./SidebarNav";
import { Topbar } from "./Topbar";
import { SocialLinks } from "./SocialLinks";
import { DEFAULT_CHAIN_ID } from "@/lib/wagmi";

/** Testnet keeps its own unaudited-warning wording unchanged. Mainnet names
 *  the audit firm directly — more credible than a generic "audited" claim,
 *  since anyone can write that regardless of whether it's true. */
const DISCLAIMER =
  DEFAULT_CHAIN_ID === base.id
    ? "Contracts have been independently audited by Web3Sentinel."
    : "Testnet build. Contracts are unaudited — do not use with real funds.";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-4 py-5">
      <img src="/pivah-logo.png" alt="" className="size-9 rounded-xl object-cover" />
      <span className="leading-tight">
        <span className="block font-display text-sm font-bold">Pivah</span>
        <span className="block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Protocol
        </span>
      </span>
    </Link>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Logo />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <div className="border-t border-sidebar-border p-4">
          <SocialLinks className="mb-3" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">{DISCLAIMER}</p>
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-sidebar-border bg-sidebar">
            <div className="flex items-center justify-between pr-3">
              <Logo />
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarNav onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-sidebar-border p-4">
              <SocialLinks className="mb-3" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">{DISCLAIMER}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <Topbar onOpenSidebar={() => setOpen(true)} />
        <p className="border-b border-border bg-warning/10 px-4 py-2 text-center text-[11px] leading-relaxed text-warning lg:hidden">
          {DISCLAIMER}
        </p>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
