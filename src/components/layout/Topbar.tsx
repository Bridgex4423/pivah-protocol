import { ClientOnly } from "@tanstack/react-router";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Bell, Search, Menu } from "lucide-react";

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
        className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
      >
        <Menu className="size-4" />
      </button>

      <div className="relative hidden min-w-0 flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search collections, pools or addresses"
          className="h-10 w-full max-w-md rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-xl border border-border bg-surface p-2.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />
        </button>
        <ClientOnly
          fallback={<div className="h-10 w-32 rounded-xl border border-border bg-surface" />}
        >
          <ConnectButton
            chainStatus="icon"
            accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
            showBalance={false}
          />
        </ClientOnly>
      </div>
    </header>
  );
}
