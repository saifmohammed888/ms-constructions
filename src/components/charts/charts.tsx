"use client";

import dynamic from "next/dynamic";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/constants";
import { formatInr, formatMonthLabel } from "@/lib/format";

const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });

const COLORS = ["#b45309", "#0f766e", "#1d4ed8", "#7c3aed", "#be123c", "#365314", "#0369a1", "#9a3412", "#44403c"];

export function BudgetBar({ spent, budget }: { spent: number; budget: number | null }) {
  const pct = budget && budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Spent vs budget</p>
          <p className="text-2xl font-semibold tracking-tight">{formatInr(spent)}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {budget ? `${Math.round(pct)}% of ${formatInr(budget)}` : "Set a budget in Settings"}
        </p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${pct > 100 ? "bg-destructive" : "bg-amber-700"}`}
          style={{ width: `${budget ? pct : 0}%` }}
        />
      </div>
    </div>
  );
}

export function CategoryDonut({
  data,
  onSelect,
}: {
  data: { category: string; amount: number }[];
  onSelect: (category: string) => void;
}) {
  const slices = data.filter((d) => d.amount > 0);
  if (!slices.length) return <p className="text-sm text-muted-foreground">No spend yet — add an expense to see the split.</p>;
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="amount"
            nameKey="category"
            innerRadius={50}
            outerRadius={80}
            onClick={(d) => {
              const cat = (d as { category?: string }).category;
              if (cat) onSelect(cat);
            }}
          >
            {slices.map((s, i) => (
              <Cell key={s.category} fill={COLORS[i % COLORS.length]} cursor="pointer" />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, n) => [
              formatInr(Number(v ?? 0)),
              EXPENSE_CATEGORY_LABELS[String(n) as ExpenseCategory] ?? String(n),
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyBurn({ data }: { data: { month: string; amount: number }[] }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.map((d) => ({ ...d, label: formatMonthLabel(d.month).slice(0, 3) }))}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
          <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
          <Bar dataKey="amount" fill="#b45309" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
