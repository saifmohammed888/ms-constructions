"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
        <p className="text-sm text-muted-foreground">Loading expenses…</p>
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No expenses in this view</p>
          <p className="mt-1 text-sm text-muted-foreground">Log a payment in under ten seconds.</p>
          <Button className="mt-4 min-h-11" onClick={() => setOpen(true)}>
            Add your first expense
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.data!.items.map((e) => (
            <li key={e.id} className="flex items-center gap-3 rounded-xl border p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{formatInr(e.amount)}</p>
                <p className="text-sm text-muted-foreground">
                  {EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory]} · {formatDate(e.date)}
                  {e.paymentMode ? ` · ${PAYMENT_MODE_LABELS[e.paymentMode as keyof typeof PAYMENT_MODE_LABELS]}` : ""}
                </p>
                {e.notes && <p className="truncate text-sm">{e.notes}</p>}
              </div>
              <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={() => { setEditing(e); setOpen(true); }}>
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={() => del.mutate(e.id)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
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

export default function ExpensesPage() {
  return (
    <Suspense>
      <ExpensesInner />
    </Suspense>
  );
}
