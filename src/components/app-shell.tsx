"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileText,
  Home,
  IndianRupee,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/expenses", label: "Expenses", icon: IndianRupee },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/documents", label: "Docs", icon: FileText },
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
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-sidebar p-4 md:flex md:flex-col">
        <div className="mb-6 px-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Construction
          </p>
          <p className="mt-1 truncate text-lg font-semibold">{projectName}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted",
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
            "mt-auto flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm",
            path.startsWith("/settings") ? "bg-sidebar-accent" : "text-muted-foreground hover:bg-muted",
          )}
        >
          <Settings className="size-4" />
          Settings
        </Link>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur md:px-8">
          <div>
            <p className="text-sm font-semibold md:hidden">{projectName}</p>
            <p className="hidden text-sm text-muted-foreground md:block">Site tracker · INR · Asia/Kolkata</p>
          </div>
          <Link href="/settings" className="md:hidden min-h-11 min-w-11 inline-flex items-center justify-center">
            <Settings className="size-5" />
          </Link>
        </header>
        <main className="px-4 pb-24 pt-4 md:px-8 md:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background md:hidden">
        {NAV.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                active ? "text-foreground" : "text-muted-foreground",
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
