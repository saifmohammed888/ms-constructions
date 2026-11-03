import { summarizeExpenses } from "@/lib/expense-summary";

export type InsightExpense = {
  id: string;
  amount: string | number;
  category: string;
  date: string;
  paymentStatus: string;
  dueDate: string | null;
  notes: string | null;
  contactName: string | null;
  hasReceipt: boolean;
};

export type InsightTask = {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
  goalLabel: string | null;
  priority: string | null;
  completedAt: string | null;
};

export type InsightLog = {
  id: string;
  date: string;
  status: string;
  workCompleted: string;
  workInProgress: string | null;
  workPlanned: string | null;
  blockers: string | null;
};

export type InsightInput = {
  today: string;
  budgetTotal: number | null;
  budgetByCategory: Record<string, number>;
  categories: readonly string[];
  expenses: InsightExpense[];
  tasks: InsightTask[];
  logs: InsightLog[];
  documentCategories: string[];
};

export type ActionTone = "urgent" | "warn" | "info";
export type ActionItem = { id: string; tone: ActionTone; title: string; detail: string; href: string };
export type LogDay = { date: string; state: "logged" | "auto" | "missing" };
export type CategoryHealth = "over" | "near" | "ok" | "unbudgeted";

const CORE_DOCUMENTS = ["drawings", "approvals", "contracts"] as const;
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/** Whole days between two ISO dates (b - a), independent of server timezone. */
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthKeys(today: string, n: number) {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(Date.UTC(y, m - n + i, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function pctChange(current: number, previous: number) {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

/**
 * Turns raw project records into the owner's daily view: what needs action
 * today, how fast money is going out, and how site logging is keeping up.
 * Pure so it can be tested without a database.
 */
export function buildInsights(input: InsightInput) {
  const { today, expenses, tasks, logs } = input;
  const budget = input.budgetTotal && input.budgetTotal > 0 ? input.budgetTotal : null;
  const months = monthKeys(today, 6);
  const totals = summarizeExpenses(expenses, input.categories, months);
  const amount = (e: InsightExpense) => Number(e.amount);
  const paid = expenses.filter((e) => e.paymentStatus === "paid");
  const due = expenses.filter((e) => e.paymentStatus === "due");

  // ---- Spending pace -------------------------------------------------------
  const thisMonth = today.slice(0, 7);
  const lastMonth = months[months.length - 2];
  const sumWhere = (rows: InsightExpense[], pred: (e: InsightExpense) => boolean) => rows.filter(pred).reduce((s, e) => s + amount(e), 0);
  const inWindow = (from: number, to: number) => (e: InsightExpense) => {
    const age = daysBetween(e.date, today);
    return age >= from && age < to;
  };
  const dayOfMonth = Number(today.slice(8, 10));
  const paidThisMonth = sumWhere(paid, (e) => e.date.startsWith(thisMonth));
  // Compare like with like: last month up to the same day-of-month.
  const paidLastMonthToDate = sumWhere(paid, (e) => e.date.startsWith(lastMonth) && Number(e.date.slice(8, 10)) <= dayOfMonth);
  const paidLastMonth = sumWhere(paid, (e) => e.date.startsWith(lastMonth));
  const paidLast7 = sumWhere(paid, inWindow(0, 7));
  const paidLast30 = sumWhere(paid, inWindow(0, 30));
  const paidPrev30 = sumWhere(paid, inWindow(30, 60));
  const paidLast90 = sumWhere(paid, inWindow(0, 90));
  const firstPaid = paid.reduce<string | null>((min, e) => (!min || e.date < min ? e.date : min), null);
  // Average over the time actually covered (max 90 days) so a new project is
  // not diluted by months before it started.
  const coveredDays = firstPaid ? Math.min(90, Math.max(30, daysBetween(firstPaid, today) + 1)) : 0;
  const avgMonthlyBurn = coveredDays ? (paidLast90 / coveredDays) * 30 : 0;

  const committed = totals.paid + totals.due;
  const remaining = budget !== null ? budget - committed : null;
  const runwayMonths = remaining !== null && remaining > 0 && avgMonthlyBurn > 0 ? remaining / avgMonthlyBurn : null;
  const monthlyAverage = totals.monthly.reduce((s, m) => s + m.amount, 0) / Math.max(1, totals.monthly.filter((m) => m.amount > 0).length);

  // ---- Payments ------------------------------------------------------------
  const weekAhead = shiftDate(today, 7);
  const overduePayments = due.filter((e) => e.dueDate && e.dueDate < today);
  const dueSoon = due.filter((e) => e.dueDate && e.dueDate >= today && e.dueDate <= weekAhead);
  const undatedDue = due.filter((e) => !e.dueDate);
  const upcomingPayments = [...due]
    .sort((a, b) => (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") || amount(b) - amount(a))
    .slice(0, 6)
    .map((e) => ({
      id: e.id,
      amount: amount(e),
      category: e.category,
      dueDate: e.dueDate,
      notes: e.notes,
      contactName: e.contactName,
      daysUntil: e.dueDate ? daysBetween(today, e.dueDate) : null,
    }));

  // ---- Category budgets ----------------------------------------------------
  const dueByCategory = new Map<string, number>();
  for (const e of due) dueByCategory.set(e.category, (dueByCategory.get(e.category) ?? 0) + amount(e));
  const categoryBudgets = totals.byCategory
    .map(({ category, amount: paidAmount }) => {
      const catBudget = Number(input.budgetByCategory?.[category] ?? 0) || 0;
      const dueAmount = dueByCategory.get(category) ?? 0;
      const used = paidAmount + dueAmount;
      const pct = catBudget > 0 ? (used / catBudget) * 100 : null;
      const health: CategoryHealth = pct === null ? "unbudgeted" : pct > 100 ? "over" : pct >= 85 ? "near" : "ok";
      return { category, paid: paidAmount, due: dueAmount, budget: catBudget || null, pct, health };
    })
    .filter((c) => c.paid > 0 || c.due > 0 || c.budget)
    .sort((a, b) => b.paid + b.due - (a.paid + a.due));
  const overBudget = categoryBudgets.filter((c) => c.health === "over");

  // ---- Who the money goes to ----------------------------------------------
  const payeeTotals = new Map<string, { name: string; paid: number; due: number; count: number }>();
  for (const e of expenses) {
    if (e.paymentStatus !== "paid" && e.paymentStatus !== "due") continue;
    const name = e.contactName?.trim() || "No contact linked";
    const entry = payeeTotals.get(name) ?? { name, paid: 0, due: 0, count: 0 };
    if (e.paymentStatus === "paid") entry.paid += amount(e);
    else entry.due += amount(e);
    entry.count += 1;
    payeeTotals.set(name, entry);
  }
  const topPayees = [...payeeTotals.values()].sort((a, b) => b.paid + b.due - (a.paid + a.due)).slice(0, 5);
  const missingReceipts = paid.filter((e) => !e.hasReceipt);
  const missingReceiptsRecent = missingReceipts.filter(inWindow(0, 30));

  // ---- Tasks ---------------------------------------------------------------
  const open = tasks.filter((t) => t.status !== "done");
  const overdueTasks = open.filter((t) => t.dueDate && t.dueDate < today);
  const dueThisWeek = open.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= weekAhead);
  const urgentOpen = open.filter((t) => t.priority === "urgent" || t.priority === "high");
  const rankTask = (t: InsightTask) => [t.dueDate && t.dueDate < today ? 0 : 1, PRIORITY_RANK[t.priority ?? "normal"] ?? 2, t.dueDate ?? "9999-12-31"] as const;
  const focusTasks = [...overdueTasks, ...dueThisWeek, ...urgentOpen.filter((t) => !t.dueDate || t.dueDate > weekAhead)]
    .filter((t, i, all) => all.findIndex((x) => x.id === t.id) === i)
    .sort((a, b) => {
      const [a0, a1, a2] = rankTask(a);
      const [b0, b1, b2] = rankTask(b);
      return a0 - b0 || a1 - b1 || a2.localeCompare(b2);
    })
    .slice(0, 6)
    .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, status: t.status, priority: t.priority ?? "normal", overdue: Boolean(t.dueDate && t.dueDate < today) }));
  const weekAgo = shiftDate(today, -7);
  const completedThisWeek = tasks.filter((t) => t.status === "done" && t.completedAt && t.completedAt.slice(0, 10) > weekAgo).length;
  const currentStage = tasks.find((t) => t.status !== "done" && t.goalLabel)?.goalLabel ?? "Planning & coordination";

  // ---- Work log ------------------------------------------------------------
  const logByDate = new Map<string, InsightLog>();
  for (const log of logs) {
    const existing = logByDate.get(log.date);
    // A manual log for a date wins over the automatic placeholder.
    if (!existing || (existing.status === "auto_generated" && log.status !== "auto_generated")) logByDate.set(log.date, log);
  }
  const logStrip: LogDay[] = Array.from({ length: 14 }, (_, i) => {
    const date = shiftDate(today, i - 13);
    const log = logByDate.get(date);
    return { date, state: !log ? "missing" : log.status === "auto_generated" ? "auto" : "logged" };
  });
  const todayLog = logByDate.get(today);
  const todayLogged = Boolean(todayLog && todayLog.status !== "auto_generated");
  const daysLogged14 = logStrip.filter((d) => d.state === "logged").length;
  // Consecutive days with a manual log. Today only counts once it is logged,
  // so an unlogged morning does not reset the streak.
  let streak = 0;
  for (let date = todayLogged ? today : shiftDate(today, -1); logByDate.get(date) && logByDate.get(date)!.status !== "auto_generated"; date = shiftDate(date, -1)) streak++;
  const pendingReview = [...logByDate.values()].filter((l) => l.status === "auto_generated");
  const latestLog = [...logByDate.values()].filter((l) => l.status !== "auto_generated").sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const openBlockers = latestLog?.blockers?.trim() ? latestLog.blockers.trim() : null;

  // ---- Documents -----------------------------------------------------------
  const present = new Set(input.documentCategories);
  const missingDocuments = CORE_DOCUMENTS.filter((c) => !present.has(c));

  // ---- Prioritized action list --------------------------------------------
  const actions: ActionItem[] = [];
  const sum = (rows: InsightExpense[]) => rows.reduce((s, e) => s + amount(e), 0);
  if (overduePayments.length) actions.push({ id: "overdue-payments", tone: "urgent", title: `${plural(overduePayments.length, "payment")} overdue`, detail: `${inr(sum(overduePayments))} past its due date — settle or reschedule`, href: "/expenses" });
  if (overdueTasks.length) actions.push({ id: "overdue-tasks", tone: "urgent", title: `${plural(overdueTasks.length, "task")} overdue`, detail: overdueTasks.slice(0, 2).map((t) => t.title).join(", ") + (overdueTasks.length > 2 ? "…" : ""), href: "/tasks" });
  if (openBlockers) actions.push({ id: "blockers", tone: "urgent", title: "Blocker reported on site", detail: openBlockers.length > 110 ? `${openBlockers.slice(0, 110)}…` : openBlockers, href: "/daily-log" });
  if (budget !== null && committed > budget) actions.push({ id: "over-budget", tone: "urgent", title: "Committed spend is over budget", detail: `${inr(committed - budget)} above the ${inr(budget)} budget (paid + due)`, href: "/settings" });
  if (!todayLogged) actions.push({ id: "log-today", tone: "warn", title: "Today's work log is not added", detail: latestLog ? `Last update was ${daysBetween(latestLog.date, today) === 1 ? "yesterday" : `${daysBetween(latestLog.date, today)} days ago`}` : "No work log recorded yet", href: "/daily-log" });
  if (dueSoon.length) actions.push({ id: "due-soon", tone: "warn", title: `${inr(sum(dueSoon))} due in the next 7 days`, detail: `${plural(dueSoon.length, "payment")} — plan cash in advance`, href: "/expenses" });
  if (overBudget.length) actions.push({ id: "category-over", tone: "warn", title: `${plural(overBudget.length, "category")} over budget`, detail: overBudget.map((c) => c.category[0].toUpperCase() + c.category.slice(1)).join(", "), href: "/expenses" });
  if (pendingReview.length) actions.push({ id: "review-logs", tone: "warn", title: `${plural(pendingReview.length, "automatic log")} to review`, detail: "Replace placeholders with what actually happened on site", href: "/daily-log" });
  if (undatedDue.length) actions.push({ id: "undated-due", tone: "info", title: `${plural(undatedDue.length, "due payment")} without a due date`, detail: `${inr(sum(undatedDue))} — add dates so they show up in time`, href: "/expenses" });
  if (missingReceiptsRecent.length) actions.push({ id: "receipts", tone: "info", title: `${plural(missingReceiptsRecent.length, "recent payment")} without a receipt`, detail: "Attach bills from the last 30 days while they're easy to find", href: "/expenses" });
  if (missingDocuments.length) actions.push({ id: "documents", tone: "info", title: `Core documents missing: ${missingDocuments.length}`, detail: missingDocuments.map((c) => c[0].toUpperCase() + c.slice(1)).join(", "), href: "/documents" });

  return {
    actions,
    money: {
      budget,
      paid: totals.paid,
      due: totals.due,
      unclassified: totals.unclassified,
      recordedTotal: totals.recordedTotal,
      committed,
      remaining,
      paidThisMonth,
      paidLastMonth,
      paidLastMonthToDate,
      monthChangePct: pctChange(paidThisMonth, paidLastMonthToDate),
      paidLast7,
      paidLast30,
      last30ChangePct: pctChange(paidLast30, paidPrev30),
      avgMonthlyBurn,
      runwayMonths,
      overdueTotal: sum(overduePayments),
      overdueCount: overduePayments.length,
      dueSoonTotal: sum(dueSoon),
      dueSoonCount: dueSoon.length,
      missingReceiptCount: missingReceipts.length,
    },
    monthly: totals.monthly,
    monthlyAverage,
    categoryBudgets,
    topPayees,
    upcomingPayments,
    recent: [...expenses]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map((e) => ({ id: e.id, amount: amount(e), category: e.category, date: e.date, paymentStatus: e.paymentStatus, contactName: e.contactName, notes: e.notes })),
    tasks: {
      focus: focusTasks,
      openCount: open.length,
      overdueCount: overdueTasks.length,
      dueThisWeekCount: dueThisWeek.length,
      completedThisWeek,
    },
    workLog: {
      todayLogged,
      strip: logStrip,
      daysLogged14,
      streak,
      pendingReviewCount: pendingReview.length,
      latest: latestLog
        ? { date: latestLog.date, workCompleted: latestLog.workCompleted, workPlanned: latestLog.workPlanned, workInProgress: latestLog.workInProgress, blockers: latestLog.blockers }
        : null,
    },
    missingDocuments,
    currentStage,
  };
}

export type DashboardInsights = ReturnType<typeof buildInsights>;
