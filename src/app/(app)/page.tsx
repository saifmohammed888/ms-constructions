"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { BudgetBar, CategoryDonut, MonthlyBurn } from "@/components/charts/charts";
import { ExpenseForm } from "@/components/expense-form";
import { TaskForm } from "@/components/task-form";
import { formatDate, formatInr } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/constants";
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
    return <p className="text-sm text-muted-foreground">Loading your site…</p>;
  }
  if (dash.isError) {
    return <p className="text-sm text-destructive">Could not load the dashboard. Refresh and try again.</p>;
  }
  const d = dash.data!;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Where things stand</h1>
          <p className="text-sm text-muted-foreground">
            {d.overdueCount > 0 ? `${d.overdueCount} overdue task${d.overdueCount === 1 ? "" : "s"}` : "No overdue tasks"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="min-h-11" onClick={() => setExpenseOpen(true)}>
            <Plus className="size-4" /> Expense
          </Button>
          <Button variant="outline" className="min-h-11" onClick={() => setTaskOpen(true)}>
            <Plus className="size-4" /> Task
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <BudgetBar spent={d.totalSpent} budget={d.budgetTotal} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly burn</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyBurn data={d.monthly} />
          </CardContent>
        </Card>
      </div>

      <Card>
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

      <Card>
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

      <ExpenseForm open={expenseOpen} onOpenChange={setExpenseOpen} />
      <TaskForm open={taskOpen} onOpenChange={setTaskOpen} />
    </div>
  );
}
