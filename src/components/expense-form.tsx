"use client";

import { useCallback, useRef, useState } from "react";
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
import { ExistingDocumentPicker } from "@/components/existing-document-picker";
import { Camera, ImagePlus, X } from "lucide-react";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
} from "@/lib/constants";
import { todayIso } from "@/lib/format";
import { filesFromInput, uploadDocuments } from "@/lib/upload";

type Contact = { id: string; name: string };
type ReceiptDocument = { id: string; name: string; category?: string; mimeType: string | null; uploadedAt?: string };
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
  receiptDocIds?: string[];
  receiptDocuments?: ReceiptDocument[];
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
  const [receipts, setReceipts] = useState<File[]>([]);
  const receiptInputs = useRef<{ camera: HTMLInputElement | null; library: HTMLInputElement | null }>({ camera: null, library: null });

  /** Append picked/captured receipts instead of replacing the previous selection. */
  const addReceipts = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setReceipts((current) => {
      const known = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      return [...current, ...files.filter((file) => !known.has(`${file.name}:${file.size}:${file.lastModified}`))];
    });
  }, []);
  const [receiptPickerOpen, setReceiptPickerOpen] = useState(false);
  const [selectedReceipts, setSelectedReceipts] = useState<ReceiptDocument[]>(initial?.receiptDocuments ?? []);

  const save = useMutation({
    mutationFn: async () => {
      // The form is the full list of linked files: anything removed here is unlinked on save.
      const receiptDocIds = selectedReceipts.map((doc) => doc.id);
      const { uploaded, failed } = await uploadDocuments<ReceiptDocument>(receipts, { category: "receipts" });
      for (const doc of uploaded) receiptDocIds.push(doc.id);
      if (failed.length > 0) toast.error(`${failed.length} receipt${failed.length === 1 ? "" : "s"} could not be uploaded: ${failed[0].error}`);
      const payload = {
        amount: Number(amount),
        category,
        date,
        contactId: contactId || null,
        paymentMode: paymentMode || null,
        paymentStatus,
        dueDate: paymentStatus === "due" ? dueDate || null : null,
        notes: notes || null,
        receiptDocIds: [...new Set(receiptDocIds)],
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
          <Label>Receipt photo</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => receiptInputs.current.camera?.click()}>
              <Camera className="size-4" /> Take photo
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => receiptInputs.current.library?.click()}>
              <ImagePlus className="size-4" /> Choose file
            </Button>
          </div>
          {/* Hidden inputs opened via ref.click() — a wrapping label with a visible
              input can swallow taps on mobile. `capture` launches the rear camera;
              the second input opens the gallery/files picker instead. */}
          <input
            ref={(el) => { receiptInputs.current.camera = el; }}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => { addReceipts(filesFromInput(e.currentTarget)); e.currentTarget.value = ""; }}
          />
          <input
            ref={(el) => { receiptInputs.current.library = el; }}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => { addReceipts(filesFromInput(e.currentTarget)); e.currentTarget.value = ""; }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="min-h-10" onClick={() => setReceiptPickerOpen(true)}>
              Choose from Documents
            </Button>
            {selectedReceipts.map((doc) => <span key={doc.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs"><span className="truncate">{doc.name}</span><button type="button" aria-label={`Unlink ${doc.name}`} className="inline-flex size-5 items-center justify-center rounded-full hover:bg-black/10" onClick={() => setSelectedReceipts((current) => current.filter((item) => item.id !== doc.id))}><X className="size-3" /></button></span>)}
            {receipts.length > 0 && <span className="max-w-full truncate text-xs text-muted-foreground">{receipts.length} file{receipts.length === 1 ? "" : "s"} ready to upload</span>}
          </div>
        </div>
        <Button type="submit" className="min-h-11 gap-2" disabled={save.isPending}>
          {save.isPending && <Spinner />}
          {save.isPending ? "Saving…" : "Save expense"}
        </Button>
      </form>
      <ExistingDocumentPicker
        open={receiptPickerOpen}
        onOpenChange={setReceiptPickerOpen}
        title="Attach from Documents"
        alreadyAttached={selectedReceipts.map((doc) => doc.id)}
        onConfirm={(docs) => {
          // One file can back several expenses (e.g. one PhonePe statement); nothing is copied.
          setSelectedReceipts((current) => {
            const known = new Set(current.map((doc) => doc.id));
            return [...current, ...docs.filter((doc) => !known.has(doc.id)).map((doc) => ({ id: doc.id, name: doc.name, mimeType: doc.mimeType }))];
          });
          setReceipts([]);
        }}
      />
    </ResponsiveForm>
  );
}
