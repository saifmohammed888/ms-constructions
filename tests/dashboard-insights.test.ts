import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInsights, type InsightInput } from "../src/lib/dashboard-insights";

const base = (over: Partial<InsightInput> = {}): InsightInput => ({
  today: "2026-10-15",
  budgetTotal: 1000,
  budgetByCategory: { foundation: 500 },
  categories: ["foundation", "misc"],
  expenses: [],
  tasks: [],
  logs: [],
  documentCategories: ["drawings", "approvals", "contracts"],
  ...over,
});

const exp = (over: Partial<InsightInput["expenses"][number]>) => ({
  id: Math.random().toString(36).slice(2),
  amount: "100",
  category: "foundation",
  date: "2026-10-10",
  paymentStatus: "paid",
  dueDate: null,
  notes: null,
  contactName: null,
  hasReceipt: true,
  ...over,
});

test("overdue due payments and committed-over-budget raise urgent actions", () => {
  const r = buildInsights(base({
    expenses: [exp({ amount: "800", paymentStatus: "paid" }), exp({ amount: "300", paymentStatus: "due", dueDate: "2026-10-12" })],
  }));
  assert.equal(r.money.committed, 1100);
  assert.equal(r.money.overdueCount, 1);
  const ids = r.actions.map((a) => a.id);
  assert.ok(ids.includes("overdue-payments"));
  assert.ok(ids.includes("over-budget"));
  assert.equal(r.actions[0].tone, "urgent");
});

test("category health reflects paid plus due against category budget", () => {
  const r = buildInsights(base({
    expenses: [exp({ amount: "300" }), exp({ amount: "150", paymentStatus: "due", dueDate: "2026-10-30" })],
  }));
  const f = r.categoryBudgets.find((c) => c.category === "foundation")!;
  assert.equal(f.pct, 90);
  assert.equal(f.health, "near");
});

test("work log streak counts manual logs only and tolerates an unlogged today", () => {
  const logs = ["2026-10-13", "2026-10-14"].map((date, i) => ({ id: String(i), date, status: "normal", workCompleted: "x", workInProgress: null, workPlanned: null, blockers: null }));
  const r = buildInsights(base({ logs }));
  assert.equal(r.workLog.todayLogged, false);
  assert.equal(r.workLog.streak, 2);
  assert.ok(r.actions.some((a) => a.id === "log-today"));
});

test("automatic placeholders do not count as logged work", () => {
  const logs = [{ id: "a", date: "2026-10-15", status: "auto_generated", workCompleted: "auto", workInProgress: null, workPlanned: null, blockers: null }];
  const r = buildInsights(base({ logs }));
  assert.equal(r.workLog.todayLogged, false);
  assert.equal(r.workLog.pendingReviewCount, 1);
  assert.equal(r.workLog.streak, 0);
});

test("empty project yields no actions except missing today log and no division errors", () => {
  const r = buildInsights(base({ documentCategories: [] }));
  assert.equal(r.money.runwayMonths, null);
  assert.equal(r.money.monthChangePct, null);
  assert.ok(r.actions.some((a) => a.id === "documents"));
  assert.ok(r.actions.some((a) => a.id === "log-today"));
  assert.equal(r.workLog.strip.length, 14);
});

test("overdue tasks are ranked first in focus list", () => {
  const r = buildInsights(base({
    tasks: [
      { id: "later", title: "Later", dueDate: "2026-10-25", status: "todo", goalLabel: null, priority: "urgent", completedAt: null },
      { id: "late", title: "Late", dueDate: "2026-10-01", status: "todo", goalLabel: null, priority: "low", completedAt: null },
      { id: "done", title: "Done", dueDate: "2026-10-01", status: "done", goalLabel: null, priority: "normal", completedAt: "2026-10-14T10:00:00Z" },
    ],
  }));
  assert.deepEqual(r.tasks.focus.map((t) => t.id), ["late", "later"]);
  assert.equal(r.tasks.overdueCount, 1);
  assert.equal(r.tasks.completedThisWeek, 1);
});
