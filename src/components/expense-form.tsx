"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveForm } from "@/components/responsive-form";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
} from "@/lib/constants";
import { todayIso } from "@/lib/format";

type Contact = { id: string; name: string };
type Expense = {
  id?: string;
  amount: number | string;
  category: string;
  date: string;
  contactId?: string | null;
  paymentMode?: string | null;
  notes?: string | null;
  receiptDocId?: string | null;
};

async function json<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export function ExpenseForm({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Expense | null;
}) {
  const qc = useQueryClient();
  const contacts = useQuery({
    queryKey: ["contacts"],
    queryFn: () => json<Contact[]>("/api/contacts"),
  });
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [category, setCategory] = useState(initial?.category ?? "misc");
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [contactId, setContactId] = useState(initial?.contactId ?? "");
  const [paymentMode, setPaymentMode] = useState(initial?.paymentMode ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [receipt, setReceipt] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      let receiptDocId = initial?.receiptDocId ?? null;
      if (receipt) {
        const fd = new FormData();
        fd.set("file", receipt);
        fd.set("category", "receipts");
        const up = await fetch("/api/documents/upload", { method: "POST", body: fd });
        const body = await up.json();
        if (up.ok) receiptDocId = body.id;
        else toast.error(body.error || "Receipt saved as expense only — connect Google for photos");
      }
      const payload = {
        amount: Number(amount),
        category,
        date,
        contactId: contactId || null,
        paymentMode: paymentMode || null,
        notes: notes || null,
        receiptDocId,
      };
      if (initial?.id) {
        return json(`/api/expenses/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      return json("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Expense updated" : "Expense added");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ResponsiveForm open={open} onOpenChange={onOpenChange} title={initial?.id ? "Edit expense" : "Add expense"}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div>
          <Label htmlFor="amount">Amount (₹)</Label>
          <Input
            id="amount"
            inputMode="decimal"
            autoFocus
            className="mt-1.5 min-h-11 text-lg"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => v && setCategory(String(v))}>
            <SelectTrigger className="mt-1.5 min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {EXPENSE_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" className="mt-1.5 min-h-11" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Payee</Label>
          <Select value={contactId || "none"} onValueChange={(v) => setContactId(v === "none" ? "" : String(v))}>
            <SelectTrigger className="mt-1.5 min-h-11 w-full">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No payee</SelectItem>
              {(contacts.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Payment mode</Label>
          <Select value={paymentMode || "none"} onValueChange={(v) => setPaymentMode(v === "none" ? "" : String(v))}>
            <SelectTrigger className="mt-1.5 min-h-11 w-full">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {PAYMENT_MODES.map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_MODE_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" className="mt-1.5" value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="receipt">Receipt photo</Label>
          <Input
            id="receipt"
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="mt-1.5 min-h-11"
            onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button type="submit" className="min-h-11" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save expense"}
        </Button>
      </form>
    </ResponsiveForm>
  );
}
