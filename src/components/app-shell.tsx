"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileText,
  Home,
  IndianRupee,
  MoreHorizontal,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/documents", label: "Library", icon: FileText },
  { href: "/tasks", label: "Work", icon: ClipboardList },
  { href: "/expenses", label: "Money", icon: IndianRupee },
  { href: "/contacts", label: "People", icon: Users },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

const MOBILE_NAV = [NAV[0], NAV[2], NAV[3], NAV[1]];

export function AppShell({
  children,
  projectName,
}: {
  children: React.ReactNode;
  projectName: string;
}) {
  const path = usePathname();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-white p-5 md:flex md:flex-col">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-950 text-sm font-bold text-white">MS</span>
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Site space</p>
              <p className="truncate font-semibold">{projectName}</p>
            </div>
          </div>
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
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary",
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
            path.startsWith("/settings") ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary",
          )}
        >
          <Settings className="size-4" />
          Settings
        </Link>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between border-b border-black/5 bg-background/90 px-4 py-3 backdrop-blur md:px-8">
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

      <button type="button" aria-label="Add to project" onClick={() => setQuickAddOpen(true)} className="fixed bottom-[4.8rem] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform active:scale-95 md:hidden">
        <Plus className="size-6" />
      </button>
      <Sheet open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-8">
          <SheetHeader><SheetTitle>Quick add</SheetTitle></SheetHeader>
          <div className="grid grid-cols-2 gap-3 px-4">
            <QuickLink href="/expenses" label="Add expense" onClick={() => setQuickAddOpen(false)} />
            <QuickLink href="/tasks" label="Add task" onClick={() => setQuickAddOpen(false)} />
            <QuickLink href="/documents" label="Upload document" onClick={() => setQuickAddOpen(false)} />
            <QuickLink href="/documents" label="Add site photo" onClick={() => setQuickAddOpen(false)} />
            <QuickLink href="/contacts" label="People" onClick={() => setQuickAddOpen(false)} />
            <QuickLink href="/settings" label="Settings" onClick={() => setQuickAddOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-black/5 bg-white/95 backdrop-blur md:hidden">
        {MOBILE_NAV.map((item) => {
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
        <Link
          href="/more"
          className={cn(
            "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]",
            path.startsWith("/more") || path.startsWith("/contacts") || path.startsWith("/settings")
              ? "font-semibold text-foreground"
              : "text-muted-foreground",
          )}
        >
          <MoreHorizontal className="size-5" />
          More
        </Link>
      </nav>
    </div>
  );
}

function QuickLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  return <Link href={href} onClick={onClick} className="flex min-h-14 items-center rounded-2xl border bg-white px-4 text-sm font-medium shadow-sm transition-colors hover:bg-zinc-50">{label}</Link>;
}
