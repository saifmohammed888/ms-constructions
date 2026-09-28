"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ExpenseForm } from "@/components/expense-form";
import { formatDate, formatInr, todayIso } from "@/lib/format";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_MODE_LABELS,
  type ExpenseCategory,
} from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardSkeleton } from "@/components/ui/spinner";
import { Suspense } from "react";

type Expense = {
  id: string;
  amount: string;
  category: string;
  date: string;
  contactId: string | null;
  paymentMode: string | null;
  notes: string | null;
};

function ExpensesInner() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [month, setMonth] = useState("");
  const [contactId, setContactId] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [sort, setSort] = useState<{ key: "date" | "amount" | "category"; direction: "asc" | "desc" }>({ key: "date", direction: "desc" });

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });
  const contacts = useQuery({
    queryKey: ["contacts"],
    queryFn: () => fetch("/api/contacts").then((r) => r.json()),
  });
  const query = useMemo(() => {
    const s = new URLSearchParams();
    if (category) s.set("category", category);
    if (month) s.set("month", month);
    if (contactId) s.set("contact_id", contactId);
    return s.toString();
  }, [category, month, contactId]);

  const list = useQuery({
    queryKey: ["expenses", query],
    queryFn: async () => {
      const res = await fetch(`/api/expenses?${query}`);
      return res.json() as Promise<{ items: Expense[]; total: number }>;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete");
    },
    onSuccess: () => {
      toast.success("Expense deleted");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const budgets = (settings.data?.budgetByCategory ?? {}) as Record<string, number>;
  const spentByCat = (list.data?.items ?? []).reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
    return acc;
  }, {});
  const items = useMemo(() => [...(list.data?.items ?? [])].sort((a, b) => {
    const av = sort.key === "amount" ? Number(a.amount) : sort.key === "category" ? a.category : a.date;
    const bv = sort.key === "amount" ? Number(b.amount) : sort.key === "category" ? b.category : b.date;
    return (av < bv ? -1 : av > bv ? 1 : 0) * (sort.direction === "asc" ? 1 : -1);
  }), [list.data?.items, sort]);
  const toggleSort = (key: "date" | "amount" | "category") => setSort((s) => ({ key, direction: s.key === key && s.direction === "asc" ? "desc" : "asc" }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Filtered total {formatInr(list.data?.total ?? 0)}
          </p>
        </div>
        <div className="flex gap-2">
          {/* This is a file download endpoint, so it intentionally uses a native anchor. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/expenses/export"
            className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium"
          >
            CSV
          </a>
          <Button className="min-h-11" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </div>

      <div className="sticky top-14 z-10 -mx-4 flex flex-col gap-2 border-b bg-background px-4 py-3 md:mx-0 md:rounded-xl md:border">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button size="sm" variant={category === "" ? "default" : "outline"} className="min-h-9" onClick={() => setCategory("")}>
            All
          </Button>
          {EXPENSE_CATEGORIES.map((c) => {
            const over = budgets[c] != null && (spentByCat[c] ?? 0) > budgets[c];
            return (
              <Button
                key={c}
                size="sm"
                variant={category === c ? "default" : "outline"}
                className={`min-h-9 ${over ? "border-destructive text-destructive" : ""}`}
                onClick={() => setCategory(c)}
              >
                {EXPENSE_CATEGORY_LABELS[c]}
              </Button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="month"
            className="min-h-11 rounded-lg border px-3 text-sm"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <Select value={contactId || "all"} onValueChange={(v) => setContactId(v === "all" ? "" : String(v))}>
            <SelectTrigger className="min-h-11 w-48">
              <SelectValue placeholder="Payee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payees</SelectItem>
              {(contacts.data ?? []).map((c: { id: string; name: string }) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {list.isLoading ? (
        <CardSkeleton rows={5} />
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No expenses in this view</p>
          <p className="mt-1 text-sm text-muted-foreground">Log a payment in under ten seconds.</p>
          <Button className="mt-4 min-h-11" onClick={() => setOpen(true)}>
            Add your first expense
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm"><table className="w-full min-w-[720px] text-sm"><thead className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3"><SortButton label="Date" onClick={() => toggleSort("date")} /></th><th className="px-4 py-3"><SortButton label="Category" onClick={() => toggleSort("category")} /></th><th className="px-4 py-3">Payment</th><th className="px-4 py-3 text-right"><SortButton label="Amount" onClick={() => toggleSort("amount")} /></th><th className="w-24 px-4 py-3" /></tr></thead><tbody>{items.map((e) => <tr key={e.id} className="border-b last:border-0 hover:bg-zinc-50"><td className="px-4 py-3">{formatDate(e.date)}</td><td className="px-4 py-3 font-medium">{EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category}</td><td className="px-4 py-3 text-muted-foreground">{e.paymentMode ? PAYMENT_MODE_LABELS[e.paymentMode as keyof typeof PAYMENT_MODE_LABELS] : "—"}{e.notes && <span className="ml-2">· {e.notes}</span>}</td><td className="px-4 py-3 text-right font-semibold">{formatInr(e.amount)}</td><td className="px-4 py-2"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => { setEditing(e); setOpen(true); }}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => del.mutate(e.id)}><Trash2 className="size-4" /></Button></div></td></tr>)}</tbody></table></div>
      )}

      <ExpenseForm
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        initial={
          editing
            ? { ...editing, amount: Number(editing.amount) }
            : { amount: "", category: "misc", date: todayIso() }
        }
      />
    </div>
  );
}

function SortButton({ label, onClick }: { label: string; onClick: () => void }) { return <button className="inline-flex items-center gap-1" onClick={onClick}>{label}<ChevronsUpDown className="size-3.5" /></button>; }

export default function ExpensesPage() {
  return (
    <Suspense>
      <ExpensesInner />
    </Suspense>
  );
}
