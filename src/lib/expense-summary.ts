export type ExpenseAmount = { amount: string | number; paymentStatus: string | null; category: string; date: string };

/** Dashboard spend means paid expenses; other statuses remain visible separately. */
export function summarizeExpenses(rows: ExpenseAmount[], categories: readonly string[], months: readonly string[]) {
  let paid = 0, due = 0, unclassified = 0;
  const byCategory = new Map(categories.map((category) => [category, 0]));
  const byMonth = new Map(months.map((month) => [month, 0]));
  for (const row of rows) {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) throw new Error("Invalid expense amount");
    if (row.paymentStatus === "paid") {
      paid += amount;
      if (byCategory.has(row.category)) byCategory.set(row.category, byCategory.get(row.category)! + amount);
      const month = row.date.slice(0, 7);
      if (byMonth.has(month)) byMonth.set(month, byMonth.get(month)! + amount);
    } else if (row.paymentStatus === "due") due += amount;
    else unclassified += amount;
  }
  return { paid, due, unclassified, recordedTotal: paid + due + unclassified, byCategory: categories.map((category) => ({ category, amount: byCategory.get(category)! })), monthly: months.map((month) => ({ month, amount: byMonth.get(month)! })) };
}
