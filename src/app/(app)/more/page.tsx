"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatInr } from "@/lib/format";

const tabs = {
  decisions: { label: "Wrong spending", fields: ["reason", "impact", "lesson", "amount"] },
  learnings: { label: "Learnings", fields: ["area", "improvement", "status"] },
  savings: { label: "Savings", fields: ["source", "estimated", "actual", "status"] },
  quotations: { label: "Quotations", fields: ["vendor", "category", "quoted", "final", "status"] },
} as const;
type Tracker = keyof typeof tabs;
type Row = { id: string; title: string; data: Record<string, string | number | null> };

export default function MorePage() {
  const [tracker, setTracker] = useState<Tracker>("decisions");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["tracker", tracker], queryFn: () => fetch(`/api/trackers?tracker=${tracker}`).then((r) => r.json() as Promise<Row[]>) });
  const save = useMutation({ mutationFn: () => fetch("/api/trackers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tracker, title: form.title, data: Object.fromEntries(tabs[tracker].fields.map((field) => [field, form[field] || null])) }) }).then((r) => r.json()), onSuccess: () => { setForm({}); qc.invalidateQueries({ queryKey: ["tracker", tracker] }); } });
  const remove = useMutation({ mutationFn: (id: string) => fetch(`/api/trackers/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["tracker", tracker] }) });
  const rows = (query.data ?? []).filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
  return <div className="mx-auto flex max-w-5xl flex-col gap-4"><div><h1 className="text-2xl font-semibold">More</h1><p className="text-sm text-muted-foreground">Capture decisions, lessons, savings, and quotations for this project.</p></div><div className="flex gap-2 overflow-x-auto pb-1">{Object.entries(tabs).map(([key, value]) => <Button key={key} variant={tracker === key ? "default" : "outline"} onClick={() => { setTracker(key as Tracker); setForm({}); }}>{value.label}</Button>)}</div><div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="grid gap-2 sm:grid-cols-2"><Input placeholder="Title" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />{tabs[tracker].fields.map((field) => <Input key={field} placeholder={field[0].toUpperCase() + field.slice(1)} value={form[field] ?? ""} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />)}</div><Button className="mt-3" disabled={!form.title || save.isPending} onClick={() => save.mutate()}><Plus className="size-4" /> Add {tabs[tracker].label}</Button></div><Input placeholder={`Search ${tabs[tracker].label.toLowerCase()}`} value={search} onChange={(e) => setSearch(e.target.value)} /><div className="overflow-x-auto rounded-2xl border bg-white shadow-sm"><table className="w-full min-w-[760px] text-sm"><thead className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Title</th>{tabs[tracker].fields.map((field) => <th key={field} className="px-4 py-3">{field}</th>)}<th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{row.title}</td>{tabs[tracker].fields.map((field) => <td key={field} className="px-4 py-3 text-muted-foreground">{field.includes("amount") || ["estimated", "actual", "quoted", "final"].includes(field) ? formatInr(Number(row.data[field] ?? 0)) : row.data[field] || "—"}</td>)}<td className="px-4 py-2 text-right"><Button variant="ghost" size="icon" title="Edit" disabled><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" title="Delete" onClick={() => remove.mutate(row.id)}><Trash2 className="size-4" /></Button></td></tr>)}</tbody><tfoot><tr className="border-t bg-zinc-50 font-semibold"><td className="px-4 py-3" colSpan={tabs[tracker].fields.length + 1}>Filtered records</td><td className="px-4 py-3 text-right">{rows.length}</td></tr></tfoot></table></div></div>;
}
