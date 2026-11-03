"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, Copy, Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { BudgetBar, CategoryDonut, MonthlyBurn } from "@/components/charts/charts";
import { TaskForm } from "@/components/task-form";
import { formatDate, formatInr } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/constants";
import { PageLoader } from "@/components/ui/spinner";
import { copyResultMessage, copyText } from "@/lib/clipboard";
import type { DashboardInsights } from "@/lib/dashboard-insights";

type Dash = DashboardInsights & {
  today: string;
  projectName: string;
  setupComplete: boolean;
  gcalConnected: boolean;
};

const TONE = {
  urgent: "border-red-200 bg-red-50 text-red-950",
  warn: "border-amber-200 bg-amber-50 text-amber-950",
  info: "border-blue-200 bg-blue-50 text-blue-950",
} as const;

const HEALTH = {
  over: { label: "Over", cls: "bg-red-100 text-red-800" },
  near: { label: "Near limit", cls: "bg-amber-100 text-amber-900" },
  ok: { label: "On track", cls: "bg-emerald-100 text-emerald-800" },
  unbudgeted: { label: "No budget", cls: "bg-zinc-100 text-zinc-700" },
} as const;

const cat = (c: string) => EXPENSE_CATEGORY_LABELS[c as ExpenseCategory] ?? c;

function trend(pct: number | null) {
  if (pct === null) return "No comparison yet";
  const rounded = Math.round(pct);
  if (rounded === 0) return "Flat vs last month";
  return `${rounded > 0 ? "Up" : "Down"} ${Math.abs(rounded)}% vs last month (same days)`;
}

function dueLabel(days: number | null, date: string | null) {
  if (!date || days === null) return "No due date";
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due ${formatDate(date)}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [taskOpen, setTaskOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const dash = useQuery({
    queryKey: ["dashboard"],
    retry: false,
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/dashboard", { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) });
      if (!res.ok) throw new Error("Could not load dashboard");
      return res.json() as Promise<Dash>;
    },
  });

  const toggleTask = useMutation({
    mutationFn: async (t: { id: string; status: string }) => {
      await fetch(`/api/tasks/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: t.status === "done" ? "todo" : "done" }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  if (dash.isLoading) return <PageLoader label="Loading your site…" />;
  if (dash.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive" role="alert">
        The dashboard could not load. Check your connection and try again.
        <Button className="ml-3" variant="outline" onClick={() => dash.refetch()}>Try again</Button>
      </div>
    );
  }
  const d = dash.data!;
  const m = d.money;

  async function copyProjectData() {
    setExporting(true);
    try {
      const res = await fetch("/api/export");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Could not export project data");
      const result = await copyText(JSON.stringify(payload, null, 2));
      toast.success(copyResultMessage(result));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not copy project data");
    } finally {
      setExporting(false);
    }
  }

  const todayLabel = formatDate(d.today);

  return (
    // Bottom padding on mobile keeps the last cards clear of the floating "+" button.
    <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-24 md:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{d.projectName} · {todayLabel}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Daily brief</h1>
          <p className="mt-1 text-sm text-muted-foreground">Stage: {d.currentStage}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="min-h-11 rounded-xl" onClick={copyProjectData} disabled={exporting} aria-label="Copy project data as JSON" title="Copy project data as JSON">
            <Copy className="size-4" /> <span className="hidden sm:inline">{exporting ? "Copying…" : "Copy data"}</span>
          </Button>
          <a href="/api/export/excel" className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium"><Download className="size-4" /> <span className="hidden sm:inline">Excel</span></a>
          <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => setTaskOpen(true)} aria-label="Add task">
            <Plus className="size-4" /> <span className="hidden sm:inline">Task</span>
          </Button>
        </div>
      </div>

      {/* 1. What needs action today */}
      <Card className="rounded-2xl border-black/5 shadow-sm">
        <CardHeader><CardTitle className="text-base">Needs action</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {d.actions.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-800"><CheckCircle2 className="size-4" /> Nothing urgent. Logged, paid up to date and no overdue items.</p>
          ) : d.actions.map((a) => (
            <Link key={a.id} href={a.href} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-shadow hover:shadow-sm ${TONE[a.tone]}`}>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold">{a.tone === "urgent" && <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />}{a.title}</span>
                <span className="block truncate text-xs opacity-80">{a.detail}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 opacity-60" aria-hidden="true" />
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* 2. Money: committed vs budget, pace, runway */}
      <Card className="overflow-hidden rounded-2xl border-0 bg-zinc-950 text-white shadow-sm">
        <CardContent className="pt-6">
          <BudgetBar spent={m.committed} budget={m.budget} />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Paid this month" value={formatInr(m.paidThisMonth)} sub={trend(m.monthChangePct)} />
            <Stat label="Last 7 days" value={formatInr(m.paidLast7)} sub="Paid" />
            <Stat label="Avg per month" value={formatInr(m.avgMonthlyBurn)} sub="Last 90 days, paid" />
            <Stat label="Budget left" value={m.remaining === null ? "—" : formatInr(m.remaining)} sub={m.runwayMonths === null ? "Paid + due against budget" : `≈ ${m.runwayMonths.toFixed(1)} months at current pace`} />
          </div>
          <p className="mt-3 text-xs text-zinc-300">Paid {formatInr(m.paid)} · Due {formatInr(m.due)}{m.unclassified !== 0 ? ` · Other status ${formatInr(m.unclassified)}` : ""}</p>
        </CardContent>
      </Card>

      {/* 3. Upcoming payments */}
      <Card className="rounded-2xl border-amber-200 bg-amber-50/60 shadow-sm">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Payments to plan</CardTitle>
          <span className="text-sm text-amber-900">{m.due ? `${formatInr(m.due)} due` : "Nothing due"}{m.dueSoonCount ? ` · ${formatInr(m.dueSoonTotal)} in 7 days` : ""}</span>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {d.upcomingPayments.length === 0 ? <p className="text-sm text-muted-foreground">No pending payments.</p> : d.upcomingPayments.map((p) => (
            <div key={p.id} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${p.daysUntil !== null && p.daysUntil < 0 ? "bg-red-50 text-red-900" : "bg-white"}`}>
              <span className="min-w-0">
                <span className="font-medium">{cat(p.category)}{p.contactName ? ` · ${p.contactName}` : ""}</span>
                <span className="block text-xs text-muted-foreground">{dueLabel(p.daysUntil, p.dueDate)}</span>
              </span>
              <span className="shrink-0 font-semibold text-amber-800">{formatInr(p.amount)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 4. Category budgets */}
      <Card className="rounded-2xl border-black/5 shadow-sm">
        <CardHeader><CardTitle className="text-base">Category budgets</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {d.categoryBudgets.length === 0 ? <p className="text-sm text-muted-foreground">No spend yet.</p> : d.categoryBudgets.map((c) => (
            <button key={c.category} type="button" onClick={() => router.push(`/expenses?category=${c.category}`)} className="flex flex-col gap-1.5 rounded-lg border px-3 py-2 text-left hover:bg-muted/50">
              <span className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{cat(c.category)}</span>
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">{formatInr(c.paid + c.due)}{c.budget ? ` of ${formatInr(c.budget)}` : ""}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH[c.health].cls}`}>{HEALTH[c.health].label}</span>
                </span>
              </span>
              {c.budget ? (
                <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className={`block h-full rounded-full ${c.health === "over" ? "bg-destructive" : c.health === "near" ? "bg-amber-500" : "bg-amber-700"}`} style={{ width: `${Math.min(100, c.pct ?? 0)}%` }} />
                </span>
              ) : null}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* 5. Trends and split */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border-black/5 shadow-sm">
          <CardHeader><CardTitle className="text-base">Paid by category</CardTitle></CardHeader>
          <CardContent>
            <CategoryDonut data={d.categoryBudgets.map((c) => ({ category: c.category, amount: c.paid }))} onSelect={(c) => router.push(`/expenses?category=${c}`)} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-black/5 shadow-sm">
          <CardHeader><CardTitle className="text-base">Monthly paid · avg {formatInr(d.monthlyAverage)}</CardTitle></CardHeader>
          <CardContent><MonthlyBurn data={d.monthly} /></CardContent>
        </Card>
      </div>

      {/* 6. Site work log */}
      <Card className="rounded-2xl border-black/5 shadow-sm">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Site log</CardTitle>
          <Link href="/daily-log" className="text-sm underline">Open log</Link>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>{d.workLog.todayLogged ? "Today logged" : "Today not logged yet"}</span>
            <span className="text-muted-foreground">Streak {d.workLog.streak} day{d.workLog.streak === 1 ? "" : "s"}</span>
            <span className="text-muted-foreground">{d.workLog.daysLogged14}/14 days logged</span>
            {d.workLog.pendingReviewCount > 0 && <span className="text-amber-800">{d.workLog.pendingReviewCount} automatic to review</span>}
          </div>
          <div className="flex gap-1" aria-label="Last 14 days">
            {d.workLog.strip.map((day) => (
              <span
                key={day.date}
                title={`${formatDate(day.date)}: ${day.state === "logged" ? "logged" : day.state === "auto" ? "automatic, review" : "missing"}`}
                className={`h-6 flex-1 rounded-sm ${day.state === "logged" ? "bg-emerald-600" : day.state === "auto" ? "bg-amber-400" : "bg-zinc-200"}`}
              />
            ))}
          </div>
          {d.workLog.latest ? (
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-xs text-muted-foreground">Latest · {formatDate(d.workLog.latest.date)}</p>
              <p className="mt-1 line-clamp-3">{d.workLog.latest.workCompleted}</p>
              {d.workLog.latest.workPlanned && <p className="mt-2 text-muted-foreground"><span className="font-medium text-foreground">Next:</span> {d.workLog.latest.workPlanned}</p>}
            </div>
          ) : <p className="text-sm text-muted-foreground">No work logs yet.</p>}
        </CardContent>
      </Card>

      {/* 7. Tasks in focus */}
      <Card className="rounded-2xl border-black/5 shadow-sm">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Tasks in focus</CardTitle>
          <span className="text-sm text-muted-foreground">{d.tasks.openCount} open · {d.tasks.completedThisWeek} done this week</span>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {d.tasks.focus.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing overdue or due this week. <button className="underline" onClick={() => setTaskOpen(true)}>Add a task</button></p>
          ) : d.tasks.focus.map((t) => (
            <label key={t.id} className="flex min-h-11 items-center gap-3 rounded-lg border px-3">
              <Checkbox checked={t.status === "done"} onCheckedChange={() => toggleTask.mutate(t)} />
              <span className="flex-1 text-sm">{t.title}{(t.priority === "urgent" || t.priority === "high") && <span className="ml-2 text-xs font-medium text-red-700 uppercase">{t.priority}</span>}</span>
              <span className={`text-xs ${t.overdue ? "font-medium text-red-700" : "text-muted-foreground"}`}>{t.dueDate ? formatDate(t.dueDate) : "No date"}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* 8. Who gets paid + recent */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border-black/5 shadow-sm">
          <CardHeader><CardTitle className="text-base">Top payees</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {d.topPayees.length === 0 ? <p className="text-sm text-muted-foreground">No payments recorded.</p> : d.topPayees.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{p.name}<span className="block text-xs text-muted-foreground">{p.count} record{p.count === 1 ? "" : "s"}</span></span>
                <span className="shrink-0 font-medium">{formatInr(p.paid + p.due)}</span>
              </div>
            ))}
            {m.missingReceiptCount > 0 && <p className="text-xs text-muted-foreground">{m.missingReceiptCount} paid expense{m.missingReceiptCount === 1 ? "" : "s"} without a receipt.</p>}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-black/5 shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent expenses</CardTitle>
            <Link href="/expenses" className="text-sm underline">All</Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {d.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses yet. <Link className="underline" href="/expenses">Add your first expense</Link></p>
            ) : d.recent.map((e) => (
              <div key={e.id} className="flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 text-sm">
                <span className="min-w-0 truncate">{cat(e.category)}{e.contactName ? <span className="text-muted-foreground"> · {e.contactName}</span> : null}</span>
                <span className="shrink-0 text-muted-foreground">{formatDate(e.date)}</span>
                <span className={`shrink-0 font-medium ${e.paymentStatus === "due" ? "text-amber-800" : ""}`}>{formatInr(e.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <TaskForm open={taskOpen} onOpenChange={setTaskOpen} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>
    </div>
  );
}
