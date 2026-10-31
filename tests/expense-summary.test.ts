import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeExpenses } from "../src/lib/expense-summary";

test("paid, due and unknown expenses reconcile without counting unpaid as spent", () => {
  const result = summarizeExpenses([
    { amount: "1000.00", paymentStatus: "paid", category: "foundation", date: "2026-10-01" },
    { amount: "200.00", paymentStatus: "due", category: "foundation", date: "2026-10-02" },
    { amount: "25.00", paymentStatus: "partial", category: "foundation", date: "2026-10-03" },
  ], ["foundation"], ["2026-10"]);
  assert.equal(result.paid, 1000);
  assert.equal(result.due, 200);
  assert.equal(result.unclassified, 25);
  assert.equal(result.recordedTotal, 1225);
  assert.equal(result.byCategory[0].amount, 1000);
  assert.equal(result.monthly[0].amount, 1000);
});

test("empty, filtered, other-category and other-month records retain their meaning", () => {
  assert.equal(summarizeExpenses([], ["foundation"], ["2026-10"]).recordedTotal, 0);
  const rows = [
    { amount: "100.50", paymentStatus: "paid", category: "foundation", date: "2026-10-01" },
    { amount: "75.50", paymentStatus: "due", category: "other", date: "2026-09-01" },
  ];
  const result = summarizeExpenses(rows.filter((row) => row.category === "other"), ["foundation"], ["2026-10"]);
  assert.equal(result.paid, 0);
  assert.equal(result.due, 75.5);
  assert.equal(result.monthly[0].amount, 0);
  assert.equal(result.byCategory[0].amount, 0);
});
