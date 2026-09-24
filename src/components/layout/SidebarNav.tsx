import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Sparkles,
  Repeat,
  Store,
  Coins,
  Wallet,
  BarChart3,
  FolderKanban,
  Droplets,
  ListTree,
  BookOpen,
} from "lucide-react";

const nav = [
  {
    label: "Protocol",
    items: [
      { to: "/", label: "Overview", icon: LayoutDashboard },
      { to: "/marketplace", label: "Marketplace", icon: Store },
      { to: "/creator/new", label: "Mint NFTs", icon: Sparkles },
      { to: "/stake", label: "Stake", icon: Coins },
    ],
  },
  {
    label: "Pivah DEX",
    items: [
      { to: "/dex", label: "Swap", icon: Repeat },
      { to: "/dex/pools", label: "Available Pools", icon: ListTree },
      { to: "/dex/liquidity", label: "Add / Withdraw LP", icon: Droplets },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/projects", label: "Projects", icon: FolderKanban },
      { to: "/portfolio", label: "Portfolio", icon: Wallet },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Resources",
    items: [{ to: "/docs", label: "Docs", icon: BookOpen }],
  },
] as const;

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-7 px-3 py-4">
      {nav.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  activeOptions={{ exact: item.to === "/" || item.to === "/dex" }}
                  activeProps={{
                    className: "bg-sidebar-accent text-sidebar-accent-foreground shadow-panel",
                  }}
                  inactiveProps={{
                    className: "text-muted-foreground hover:bg-sidebar-accent/50",
                  }}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
                >
                  <item.icon className="size-4 shrink-0" strokeWidth={2} />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
