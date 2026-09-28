"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Camera, ClipboardList as ClipboardIcon, FileUp, Plus, Receipt, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { BudgetBar, CategoryDonut, MonthlyBurn } from "@/components/charts/charts";
import { ExpenseForm } from "@/components/expense-form";
import { TaskForm } from "@/components/task-form";
import { formatDate, formatInr } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/constants";
import { PageLoader } from "@/components/ui/spinner";
import Link from "next/link";

type Dash = {
  projectName: string;
  budgetTotal: number | null;
  totalSpent: number;
  byCategory: { category: string; amount: number }[];
  monthly: { month: string; amount: number }[];
  thisWeek: { id: string; title: string; dueDate: string | null; status: string }[];
  overdueCount: number;
  recent: { id: string; amount: string; category: string; date: string }[];
  duePayments: { id: string; amount: string; category: string; dueDate: string | null; notes: string | null }[];
  recentPhotos: { id: string; name: string; mimeType: string | null; uploadedAt: string }[];
  missingDocuments: string[];
  currentStage: string;
  setupComplete: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
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

  if (dash.isLoading) {
    return <PageLoader label="Loading your site…" />;
  }
  if (dash.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
        Could not load the dashboard. Refresh and try again.
      </div>
    );
  }
  const d = dash.data!;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><Sparkles className="size-3.5" /> {d.projectName}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Where things stand</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Active stage: {d.currentStage}
          </p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Button className="min-h-11 rounded-xl" onClick={() => setExpenseOpen(true)}>
            <Plus className="size-4" /> Expense
          </Button>
          <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => setTaskOpen(true)}>
            <Plus className="size-4" /> Task
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction icon={Receipt} label="Expense" onClick={() => setExpenseOpen(true)} />
        <QuickAction icon={FileUp} label="Upload" href="/documents" />
        <QuickAction icon={ClipboardIcon} label="Task" onClick={() => setTaskOpen(true)} />
        <QuickAction icon={Camera} label="Site update" href="/documents" />
      </div>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Project attention summary">
        <AttentionCard href="/tasks" title="Work needing attention" value={d.overdueCount ? `${d.overdueCount} overdue` : "On track"} detail={d.thisWeek.length ? `${d.thisWeek.length} task${d.thisWeek.length === 1 ? "" : "s"} this week` : "No tasks due this week"} tone={d.overdueCount ? "red" : "green"} />
        <AttentionCard href="/expenses" title="Payments to plan" value={formatInr(d.duePayments.reduce((sum, payment) => sum + Number(payment.amount), 0))} detail={`${d.duePayments.length} upcoming or overdue`} tone={d.duePayments.length ? "amber" : "green"} />
        <AttentionCard href="/documents" title="Project records" value={d.missingDocuments.length ? `${d.missingDocuments.length} missing` : "Ready"} detail={d.missingDocuments.length ? d.missingDocuments.map((category) => category[0].toUpperCase() + category.slice(1)).join(", ") : "Core documents are present"} tone={d.missingDocuments.length ? "blue" : "green"} />
      </section>

      <Card className="overflow-hidden rounded-2xl border-0 bg-zinc-950 text-white shadow-sm">
        <CardContent className="pt-6">
          <BudgetBar spent={d.totalSpent} budget={d.budgetTotal} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border-black/5 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Spend by category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryDonut
              data={d.byCategory}
              onSelect={(c) => router.push(`/expenses?category=${c}`)}
            />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-black/5 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Monthly burn</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyBurn data={d.monthly} />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-black/5 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">This week</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {d.thisWeek.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing due this week.{" "}
              <button className="underline" onClick={() => setTaskOpen(true)}>
                Add a task
              </button>
            </p>
          ) : (
            d.thisWeek.map((t) => (
              <label key={t.id} className="flex min-h-11 items-center gap-3 rounded-lg border px-3">
                <Checkbox
                  checked={t.status === "done"}
                  onCheckedChange={() => toggleTask.mutate(t)}
                />
                <span className="flex-1 text-sm">{t.title}</span>
                <span className="text-xs text-muted-foreground">{formatDate(t.dueDate)}</span>
              </label>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-black/5 shadow-sm">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Recent expenses</CardTitle>
          <Link href="/expenses" className="text-sm underline">
            All
          </Link>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {d.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No expenses yet.{" "}
              <button className="underline" onClick={() => setExpenseOpen(true)}>
                Add your first expense
              </button>
            </p>
          ) : (
            d.recent.map((e) => (
              <div key={e.id} className="flex min-h-11 items-center justify-between rounded-lg border px-3 text-sm">
                <span>{EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category}</span>
                <span className="text-muted-foreground">{formatDate(e.date)}</span>
                <span className="font-medium">{formatInr(e.amount)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-amber-200 bg-amber-50/60 shadow-sm">
        <CardHeader><CardTitle className="text-base">Upcoming payments</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {d.duePayments.length === 0 ? <p className="text-sm text-muted-foreground">No pending payments.</p> : d.duePayments.map((p) => <div key={p.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"><span>{EXPENSE_CATEGORY_LABELS[p.category as ExpenseCategory] ?? p.category}<span className="ml-2 text-xs text-muted-foreground">{p.dueDate ? formatDate(p.dueDate) : "No due date"}</span></span><span className="font-semibold text-amber-800">{formatInr(p.amount)}</span></div>)}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-black/5 shadow-sm">
        <CardHeader><CardTitle className="text-base">Project insights</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Insight label="Due payments" value={formatInr(d.duePayments.reduce((sum, payment) => sum + Number(payment.amount), 0))} tone={d.duePayments.length ? "amber" : "green"} detail={d.duePayments.length ? `${d.duePayments.length} payment${d.duePayments.length === 1 ? "" : "s"} to plan for` : "Nothing pending"} />
          <Insight label="Upcoming work" value={`${d.thisWeek.filter((task) => task.status !== "done").length}`} tone={d.thisWeek.some((task) => task.status !== "done") ? "blue" : "green"} detail="Open tasks this week" />
          <Insight label="Project activity" value={`${d.recent.length}`} tone="neutral" detail="Recent expense records" />
        </CardContent>
      </Card>

      <ExpenseForm open={expenseOpen} onOpenChange={setExpenseOpen} />
      <TaskForm open={taskOpen} onOpenChange={setTaskOpen} />
      <SitePhotoCarousel photos={d.recentPhotos} />
    </div>
  );
}

function Insight({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "amber" | "green" | "blue" | "neutral" }) {
  const styles = { amber: "bg-amber-50 text-amber-900", green: "bg-emerald-50 text-emerald-900", blue: "bg-blue-50 text-blue-900", neutral: "bg-zinc-50 text-zinc-900" };
  return <div className={`rounded-xl p-4 ${styles[tone]}`}><p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p><p className="mt-1 text-xs opacity-70">{detail}</p></div>;
}

function AttentionCard({ href, title, value, detail, tone }: { href: string; title: string; value: string; detail: string; tone: "red" | "amber" | "blue" | "green" }) {
  const styles = { red: "border-red-200 bg-red-50 text-red-950", amber: "border-amber-200 bg-amber-50 text-amber-950", blue: "border-blue-200 bg-blue-50 text-blue-950", green: "border-emerald-200 bg-emerald-50 text-emerald-950" };
  return <Link href={href} className={`rounded-2xl border p-4 transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${styles[tone]}`}><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium uppercase tracking-wide opacity-70">{title}</p>{tone === "red" && <TriangleAlert className="size-4" aria-hidden="true" />}</div><p className="mt-2 text-xl font-semibold">{value}</p><p className="mt-1 text-xs opacity-70">{detail}</p></Link>;
}

function SitePhotoCarousel({ photos }: { photos: Dash["recentPhotos"] }) {
  const [index, setIndex] = useState(0);
  if (!photos.length) return null;
  const photo = photos[index];
  return <Card className="overflow-hidden rounded-2xl border-black/5 shadow-sm"><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">Latest site photos</CardTitle><p className="text-xs text-muted-foreground">{index + 1} of {photos.length}</p></div><div className="flex gap-1"><Button variant="outline" size="icon" aria-label="Previous photo" onClick={() => setIndex((index - 1 + photos.length) % photos.length)}><ArrowLeft className="size-4" /></Button><Button variant="outline" size="icon" aria-label="Next photo" onClick={() => setIndex((index + 1) % photos.length)}><ArrowRight className="size-4" /></Button></div></CardHeader><CardContent className="p-0"><div className="relative aspect-[16/9] overflow-hidden bg-zinc-950"><img src={`/api/documents/${photo.id}/file`} alt={photo.name} className="h-full w-full object-contain" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-12 text-sm text-white">{photo.name}</div></div></CardContent></Card>;
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  href,
}: {
  icon: typeof Receipt;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const content = <><span className="flex size-9 items-center justify-center rounded-xl bg-zinc-100"><Icon className="size-4" /></span><span>{label}</span><ArrowRight className="ml-auto size-4 text-muted-foreground" /></>;
  if (href) return <Link href={href} className="flex min-h-16 items-center gap-2 rounded-2xl border border-black/5 bg-white px-3 text-sm font-medium shadow-sm transition-transform active:scale-[.98]">{content}</Link>;
  return <button onClick={onClick} className="flex min-h-16 items-center gap-2 rounded-2xl border border-black/5 bg-white px-3 text-left text-sm font-medium shadow-sm transition-transform active:scale-[.98]">{content}</button>;
}
