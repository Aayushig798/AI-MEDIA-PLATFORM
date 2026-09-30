"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, History, Inbox, Leaf, Map as MapIcon, Search } from "lucide-react";
import { cx } from "./ui";

const LINKS = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/search", label: "Search", icon: Search },
  { href: "/review", label: "Review", icon: Inbox },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/ledger", label: "Audit trail", icon: History },
];

export function Nav() {
  const pathname = usePathname();
  const [reviewCount, setReviewCount] = useState<number | null>(null);

  // Live count of photos waiting for a human decision, refreshed on navigation.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/review-queue")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.success && Array.isArray(d.assets)) setReviewCount(d.assets.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200/70 bg-white/75 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:gap-8">
        <Link href="/projects" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_4px_12px_-4px_rgba(5,150,105,0.7)]">
            <Leaf className="h-4 w-4" />
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight text-zinc-900 sm:inline">
            Eco<span className="text-emerald-600">Evidence</span>
          </span>
        </Link>

        <nav className="-mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cx(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
                  active ? "bg-emerald-50 text-emerald-800" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
                )}
              >
                <Icon className={cx("h-4 w-4", active ? "text-emerald-600" : "text-zinc-400")} />
                <span className="hidden md:inline">{label}</span>
                {href === "/review" && reviewCount ? (
                  <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold leading-[18px] text-white tabular-nums">
                    {reviewCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/search"
            className="hidden h-9 w-56 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 text-sm text-zinc-400 transition hover:border-zinc-300 hover:bg-white lg:flex"
          >
            <Search className="h-4 w-4" />
            Search photos…
          </Link>
        </div>
      </div>
    </header>
  );
}
