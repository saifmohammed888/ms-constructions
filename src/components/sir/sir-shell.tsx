"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardList, LayoutDashboard, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/sir", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/sir/track", label: "My notices", icon: ClipboardList },
  { href: "/sir/districts", label: "Districts", icon: MapPin },
  { href: "/sir/guide", label: "Guide", icon: BookOpen },
];

export function SirShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,oklch(0.97_0.02_145)_0%,var(--background)_28%)] text-foreground">
      <header className="sticky top-0 z-30 border-b border-emerald-900/10 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link href="/sir" className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-sm font-bold text-white shadow-sm">
              SIR
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">Karnataka SIR Tracker</p>
              <p className="truncate text-xs text-muted-foreground">Special Intensive Revision · 2026</p>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = item.exact ? path === item.href : path.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-emerald-700 text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-6 md:pb-10">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background/95 backdrop-blur md:hidden">
        {NAV.map((item) => {
          const active = item.exact ? path === item.href : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium",
                active ? "text-emerald-800" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
