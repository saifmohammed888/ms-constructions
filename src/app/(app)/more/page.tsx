"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveForm } from "@/components/responsive-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatInr } from "@/lib/format";

const trackers = {
  decisions: {
    title: "Wrong spending",
    subtitle: "Capture what went wrong so it is not repeated.",
    fields: ["where", "amount", "reason", "lesson"],
    columns: ["where", "amount", "reason", "lesson"],
  },
  savings: {
    title: "Savings",
    subtitle: "Track estimate, actual cost, and money saved.",
    fields: ["estimated", "actual", "description"],
    columns: ["description", "estimated", "actual", "totalSavings"],
  },
  learnings: {
    title: "Learning",
    subtitle: "Keep small lessons from site, people, and purchases.",
    fields: ["title", "area", "description"],
    columns: ["title", "area", "description"],
  },
  quotations: {
    title: "Quotation",
    subtitle: "Compare vendor quotes and the final decision.",
    fields: ["category", "vendor", "finalQuotation", "status"],
    columns: ["category", "vendor", "finalQuotation", "status"],
  },
} as const;

type Tracker = keyof typeof trackers;
type Field = (typeof trackers)[Tracker]["columns"][number];
type Row = { id: string; title: string; data: Record<string, string | number | null> };

const labels: Record<Field, string> = {
  where: "Where",
  amount: "Amount",
  reason: "Reason",
  lesson: "Lesson",
  title: "Title",
  area: "Area",
  description: "Description",
  estimated: "Estimated",
  actual: "Actual",
  totalSavings: "Savings",
  category: "Category",
  vendor: "Vendor",
  finalQuotation: "Final quote",
  status: "Status",
};

const moneyFields = new Set<Field>(["amount", "estimated", "actual", "totalSavings", "finalQuotation"]);
const longFields = new Set<Field>(["reason", "lesson", "description"]);
const quoteStatuses = ["Pending", "Selected", "Rejected"] as const;

export default function MorePage() {
  const qc = useQueryClient();
  const [tracker, setTracker] = useState<Tracker>("decisions");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const config = trackers[tracker];

  const list = useQuery({
    queryKey: ["tracker", tracker],
    queryFn: async () => {
      const res = await fetch(`/api/trackers?tracker=${tracker}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load entries");
      return data as Row[];
    },
  });

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (list.data ?? []).filter((row) => !needle || JSON.stringify(row).toLowerCase().includes(needle));
  }, [list.data, search]);

  const save = useMutation({
    mutationFn: async () => {
      const data = Object.fromEntries(config.fields.map((field) => [field, form[field] || null]));
      if (tracker === "savings") {
        const estimated = Number(form.estimated || 0);
        const actual = Number(form.actual || 0);
        data.totalSavings = estimated || actual ? String(Math.max(estimated - actual, 0)) : null;
      }
      const res = await fetch(editing ? `/api/trackers/${editing.id}` : "/api/trackers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracker, title: titleFromForm(tracker, form), data }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not save entry");
      return body as Row;
    },
    onSuccess: () => {
      toast.success(editing ? "Entry updated" : "Entry added");
      setOpen(false);
      setEditing(null);
      setForm({});
      qc.invalidateQueries({ queryKey: ["tracker", tracker] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/trackers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete entry");
    },
    onSuccess: () => {
      toast.success("Entry deleted");
      qc.invalidateQueries({ queryKey: ["tracker", tracker] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addEntry = () => {
    setEditing(null);
    setForm(defaultForm(tracker));
    setOpen(true);
  };

  const editEntry = (row: Row) => {
    setEditing(row);
    setForm(Object.fromEntries(config.fields.map((field) => [field, String(row.data[field] ?? "")])));
    setOpen(true);
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">More</h1>
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        </div>
        <Button className="min-h-11" onClick={addEntry}>
          <Plus className="size-4" /> Add
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(trackers) as Tracker[]).map((key) => (
          <Button key={key} variant={tracker === key ? "default" : "outline"} className="min-h-10" onClick={() => { setTracker(key); setSearch(""); }}>
            {trackers[key].title}
          </Button>
        ))}
      </div>

      <Input className="min-h-11 rounded-xl bg-white" placeholder={`Search ${config.title.toLowerCase()}`} value={search} onChange={(e) => setSearch(e.target.value)} />

      <section className="table-shell">
        <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
          <h2 className="text-sm font-semibold">{config.title}</h2>
          <span className="text-xs text-muted-foreground">{rows.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr>{config.columns.map((field) => <th key={field}>{labels[field]}</th>)}<th className="text-right">Actions</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {config.columns.map((field, index) => <td key={field} className={index === 0 ? "font-medium" : "text-muted-foreground"}>{displayValue(field, row)}</td>)}
                  <td><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => editEntry(row)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => remove.mutate(row.id)}><Trash2 className="size-4" /></Button></div></td>
                </tr>
              ))}
              {!list.isLoading && rows.length === 0 && <tr><td className="py-8 text-center text-muted-foreground" colSpan={config.columns.length + 1}>No entries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <ResponsiveForm open={open} onOpenChange={setOpen} title={editing ? `Edit ${config.title}` : `Add ${config.title}`}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          {config.fields.map((field) => <FieldInput key={field} field={field} value={form[field] ?? ""} onChange={(value) => setForm({ ...form, [field]: value })} />)}
          <Button type="submit" className="min-h-11" disabled={save.isPending}>{save.isPending ? "Saving..." : editing ? "Save" : "Add"}</Button>
        </form>
      </ResponsiveForm>
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: string; onChange: (value: string) => void }) {
  if (field === "status") {
    return <div><Label>{labels[field]}</Label><Select value={value || "Pending"} onValueChange={(next) => next && onChange(next)}><SelectTrigger className="mt-1.5 min-h-11"><SelectValue /></SelectTrigger><SelectContent>{quoteStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>;
  }
  if (longFields.has(field)) {
    return <label className="text-sm font-medium">{labels[field]}<textarea className="mt-1.5 min-h-20 w-full rounded-xl border bg-white px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary/30" value={value} onChange={(e) => onChange(e.target.value)} required={field === "reason" || field === "description"} /></label>;
  }
  return <div><Label>{labels[field]}</Label><Input className="mt-1.5 min-h-11" type={moneyFields.has(field) ? "number" : "text"} value={value} onChange={(e) => onChange(e.target.value)} required={field !== "actual"} /></div>;
}

function displayValue(field: Field, row: Row) {
  const value = field === "totalSavings" ? row.data.totalSavings : row.data[field];
  if (moneyFields.has(field)) return formatInr(Number(value ?? 0));
  return value || "—";
}

function titleFromForm(tracker: Tracker, form: Record<string, string>) {
  if (tracker === "decisions") return form.where || "Wrong spending";
  if (tracker === "savings") return form.description || "Savings";
  if (tracker === "learnings") return form.title || "Learning";
  return [form.category, form.vendor].filter(Boolean).join(" · ") || "Quotation";
}

function defaultForm(tracker: Tracker): Record<string, string> {
  if (tracker === "quotations") return { status: "Pending" };
  return {};
}
