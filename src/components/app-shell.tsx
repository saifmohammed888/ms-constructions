"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileText,
  Home,
  IndianRupee,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/documents", label: "Library", icon: FileText },
  { href: "/tasks", label: "Work", icon: ClipboardList },
  { href: "/expenses", label: "Money", icon: IndianRupee },
  { href: "/contacts", label: "People", icon: Users },
];

export function AppShell({
  children,
  projectName,
}: {
  children: React.ReactNode;
  projectName: string;
}) {
  const path = usePathname();
  return (
<<<<<<< HEAD
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-sidebar p-4 md:flex md:flex-col">
        <div className="mb-6 px-2">
          <p className="text-xs font-medium tracking-wide text-amber-800/70 uppercase">
            MS Constructions
          </p>
          <p className="mt-1 truncate text-lg font-semibold">{projectName}</p>
=======
    <div className="min-h-dvh bg-[#f7f7f5] text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-white p-5 md:flex md:flex-col">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-950 text-sm font-bold text-white">MS</span>
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Site space</p>
              <p className="truncate font-semibold">{projectName}</p>
            </div>
          </div>
>>>>>>> e86bc13 (fix: new page)
        </div>
        <nav className="flex flex-1 flex-col gap-1.5">
          {NAV.map((item) => {
            const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                  active ? "bg-zinc-950 text-white shadow-sm" : "text-muted-foreground hover:bg-zinc-100",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/settings"
          className={cn(
            "mt-auto flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm",
            path.startsWith("/settings") ? "bg-zinc-100 text-foreground" : "text-muted-foreground hover:bg-zinc-100",
          )}
        >
          <Settings className="size-4" />
          Settings
        </Link>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-black/5 bg-[#f7f7f5]/90 px-4 py-3 backdrop-blur md:px-8">
          <div>
            <p className="text-sm font-semibold md:hidden">{projectName}</p>
            <p className="hidden text-sm text-muted-foreground md:block">Your construction, in one calm place</p>
          </div>
          <Link href="/settings" className="md:hidden min-h-11 min-w-11 inline-flex items-center justify-center">
            <Settings className="size-5" />
          </Link>
        </header>
        <main className="px-4 pb-24 pt-5 md:px-8 md:pb-10">{children}</main>
      </div>

      <Link href="/expenses" aria-label="Add something" className="fixed bottom-[4.6rem] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-zinc-950 text-white shadow-xl transition-transform active:scale-95 md:hidden">
        <Plus className="size-6" />
      </Link>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-black/5 bg-white/95 backdrop-blur md:hidden">
        {NAV.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]",
                active ? "font-semibold text-foreground" : "text-muted-foreground",
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
