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
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
} from "@/lib/constants";
import { todayIso } from "@/lib/format";

type Contact = { id: string; name: string };
type ReceiptDocument = { id: string; name: string; category: string; mimeType: string | null; uploadedAt: string };
type Expense = {
  id?: string;
  amount: number | string;
  category: string;
  date: string;
  contactId?: string | null;
  paymentMode?: string | null;
  paymentStatus?: string;
  dueDate?: string | null;
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
  const [paymentStatus, setPaymentStatus] = useState(initial?.paymentStatus ?? "paid");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPickerOpen, setReceiptPickerOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptDocument | null>(null);
  const documents = useQuery({
    queryKey: ["documents", "receipt-picker"],
    enabled: receiptPickerOpen,
    queryFn: () => json<ReceiptDocument[]>("/api/documents"),
  });

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
      if (!receipt && selectedReceipt) receiptDocId = selectedReceipt.id;
      const payload = {
        amount: Number(amount),
        category,
        date,
        contactId: contactId || null,
        paymentMode: paymentMode || null,
        paymentStatus,
        dueDate: paymentStatus === "due" ? dueDate || null : null,
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
          <Label>Payment status</Label>
          <Select value={paymentStatus} onValueChange={(v) => v && setPaymentStatus(String(v))}>
            <SelectTrigger className="mt-1.5 min-h-11 w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="paid">Paid</SelectItem><SelectItem value="due">Due / pending</SelectItem></SelectContent>
          </Select>
          {paymentStatus === "due" && <Input type="date" className="mt-2 min-h-11" value={dueDate ?? ""} onChange={(e) => setDueDate(e.target.value)} aria-label="Payment due date" />}
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="min-h-10" onClick={() => setReceiptPickerOpen(true)}>
              Choose existing receipt
            </Button>
            {selectedReceipt && <span className="max-w-full truncate text-xs text-muted-foreground">Selected: {selectedReceipt.name}</span>}
          </div>
        </div>
        <Button type="submit" className="min-h-11 gap-2" disabled={save.isPending}>
          {save.isPending && <Spinner />}
          {save.isPending ? "Saving…" : "Save expense"}
        </Button>
      </form>
      <Dialog open={receiptPickerOpen} onOpenChange={setReceiptPickerOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Choose existing receipt</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Select a file already stored in your Library. It will not be uploaded again.</p>
          <div className="flex flex-col gap-2">
            {(documents.data ?? []).map((doc) => <button key={doc.id} type="button" className="flex min-h-12 items-center justify-between rounded-xl border px-3 text-left text-sm hover:bg-muted" onClick={() => { setSelectedReceipt(doc); setReceipt(null); setReceiptPickerOpen(false); }}><span className="min-w-0 truncate font-medium">{doc.name}</span><span className="ml-3 shrink-0 text-xs text-muted-foreground">{doc.category}</span></button>)}
            {documents.isLoading && <div className="flex justify-center py-6"><Spinner /></div>}
            {!documents.isLoading && !documents.data?.length && <p className="py-6 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </ResponsiveForm>
  );
}
