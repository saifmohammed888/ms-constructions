"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Eye, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveForm } from "@/components/responsive-form";
import { CardSkeleton, Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatDate, todayIso } from "@/lib/format";

type DailyDoc = {
  id: string;
  name: string;
  mimeType: string | null;
  category: string;
};

type DailyLog = {
  id: string;
  date: string;
  workCompleted: string;
  workInProgress: string | null;
  workPlanned: string | null;
  blockers: string | null;
  materialsReceived: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  documents: DailyDoc[];
};

type FormState = {
  date: string;
  workCompleted: string;
  workInProgress: string;
  workPlanned: string;
  blockers: string;
  materialsReceived: string;
  notes: string;
  status: string;
  documents: DailyDoc[];
  files: File[];
};

const emptyForm = (): FormState => ({
  date: todayIso(),
  workCompleted: "",
  workInProgress: "",
  workPlanned: "",
  blockers: "",
  materialsReceived: "",
  notes: "",
  status: "normal",
  documents: [],
  files: [],
});

export default function DailyLogPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DailyLog | null>(null);
  const [detail, setDetail] = useState<DailyLog | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DailyLog | null>(null);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [form, setForm] = useState<FormState>(() => emptyForm());

  const list = useQuery({
    queryKey: ["daily-logs"],
    queryFn: async () => {
      const res = await fetch("/api/daily-logs");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load daily logs");
      return data as DailyLog[];
    },
  });

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (list.data ?? []).filter((log) => {
      const matchesDate = !date || log.date === date;
      const text = [log.workCompleted, log.workInProgress, log.workPlanned, log.blockers, log.materialsReceived, log.notes, log.status].filter(Boolean).join(" ").toLowerCase();
      return matchesDate && (!needle || text.includes(needle));
    });
  }, [date, list.data, search]);

  const save = useMutation({
    mutationFn: async () => {
      const uploaded = await uploadFiles(form.files, form.date);
      const documentIds = [...form.documents.map((doc) => doc.id), ...uploaded.map((doc) => doc.id)];
      const body = {
        date: form.date,
        workCompleted: form.workCompleted,
        workInProgress: form.workInProgress || null,
        workPlanned: form.workPlanned || null,
        blockers: form.blockers || null,
        materialsReceived: form.materialsReceived || null,
        notes: form.notes || null,
        status: form.status || "normal",
        documentIds,
      };
      const res = await fetch(editing ? `/api/daily-logs/${editing.id}` : "/api/daily-logs", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save daily log");
      return data as DailyLog;
    },
    onSuccess: () => {
      toast.success(editing ? "Daily log updated" : "Daily log added");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm());
      qc.invalidateQueries({ queryKey: ["daily-logs"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/daily-logs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete daily log");
    },
    onSuccess: () => {
      toast.success("Daily log deleted");
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["daily-logs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const startEdit = (log: DailyLog) => {
    setEditing(log);
    setForm({
      date: log.date,
      workCompleted: log.workCompleted,
      workInProgress: log.workInProgress || "",
      workPlanned: log.workPlanned || "",
      blockers: log.blockers || "",
      materialsReceived: log.materialsReceived || "",
      notes: log.notes || "",
      status: log.status || "normal",
      documents: log.documents || [],
      files: [],
    });
    setOpen(true);
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Daily Log</h1>
          <p className="text-sm text-muted-foreground">Track daily site notes, blockers, materials, and site photos by date.</p>
        </div>
        <Button className="min-h-11" onClick={startAdd}>
          <Plus className="size-4" /> Add log
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
        <Input className="min-h-11 rounded-xl bg-white" placeholder="Search work, notes, blockers" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Input className="min-h-11 rounded-xl bg-white" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {date && <div><Button size="sm" variant="outline" onClick={() => setDate("")}>Clear date filter</Button></div>}

      {list.isLoading ? (
        <CardSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <CalendarDays className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No daily logs yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add today&apos;s work and photos before details get forgotten.</p>
          <Button className="mt-4 min-h-11" onClick={startAdd}>Add daily log</Button>
        </div>
      ) : (
        <section className="table-shell">
          <div className="flex flex-wrap items-center gap-2 border-b border-black/5 px-4 py-3">
            <CalendarDays className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Logs</h2>
            <span className="text-xs text-muted-foreground">{rows.length} entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead><tr><th>Date</th><th>Work completed</th><th>Blockers</th><th>Photos</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {rows.map((log) => (
                  <tr key={log.id}>
                    <td className="font-medium">{formatDate(log.date)}</td>
                    <td className="max-w-[320px] text-muted-foreground"><span className="line-clamp-2">{log.workCompleted}</span></td>
                    <td className="max-w-[220px] text-muted-foreground"><span className="line-clamp-1">{log.blockers || "—"}</span></td>
                    <td>{log.documents.length ? `${log.documents.length} image${log.documents.length === 1 ? "" : "s"}` : "—"}</td>
                    <td><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="View" onClick={() => setDetail(log)}><Eye className="size-4" /></Button><Button variant="ghost" size="icon" title="Edit" onClick={() => startEdit(log)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" title="Delete" onClick={() => setPendingDelete(log)}><Trash2 className="size-4" /></Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ResponsiveForm open={open} onOpenChange={setOpen} title={editing ? "Edit daily log" : "Add daily log"}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Input className="min-h-11" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          <Field label="Work completed" value={form.workCompleted} onChange={(value) => setForm({ ...form, workCompleted: value })} required />
          <Field label="Work in progress" value={form.workInProgress} onChange={(value) => setForm({ ...form, workInProgress: value })} />
          <Field label="Planned next" value={form.workPlanned} onChange={(value) => setForm({ ...form, workPlanned: value })} />
          <Field label="Blockers" value={form.blockers} onChange={(value) => setForm({ ...form, blockers: value })} />
          <Field label="Materials received" value={form.materialsReceived} onChange={(value) => setForm({ ...form, materialsReceived: value })} />
          <Field label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
          <div>
            <label className="text-sm font-medium">Images</label>
            <label className="mt-1.5 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-white px-4 text-center text-sm text-muted-foreground">
              <ImagePlus className="mb-2 size-5" />
              Add site photos for this date
              <input className="sr-only" type="file" accept="image/*" multiple onChange={(e) => setForm({ ...form, files: Array.from(e.target.files ?? []) })} />
            </label>
            {(form.documents.length > 0 || form.files.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {form.documents.map((doc) => <AttachmentChip key={doc.id} label={doc.name} onRemove={() => setForm({ ...form, documents: form.documents.filter((item) => item.id !== doc.id) })} />)}
                {form.files.map((file) => <AttachmentChip key={file.name} label={file.name} onRemove={() => setForm({ ...form, files: form.files.filter((item) => item !== file) })} />)}
              </div>
            )}
          </div>
          <Button className="min-h-11" type="submit" disabled={save.isPending}>{save.isPending ? <Spinner /> : null}{editing ? "Save log" : "Add log"}</Button>
        </form>
      </ResponsiveForm>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{detail ? formatDate(detail.date) : "Daily log"}</DialogTitle></DialogHeader>
          {detail && <DailyLogDetail log={detail} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={Boolean(pendingDelete)} title="Delete daily log?" body={pendingDelete ? `This removes the log for ${formatDate(pendingDelete.date)}. Linked images stay safely in Library and Drive.` : ""} pending={del.isPending} onCancel={() => setPendingDelete(null)} onConfirm={() => pendingDelete && del.mutate(pendingDelete.id)} />
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="text-sm font-medium">{label}<textarea className="mt-1.5 min-h-20 w-full rounded-xl border bg-white px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary/30" value={value} onChange={(e) => onChange(e.target.value)} required={required} /></label>;
}

function AttachmentChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs"><span className="truncate">{label}</span><button type="button" aria-label={`Remove ${label}`} onClick={onRemove}><X className="size-3" /></button></span>;
}

function DailyLogDetail({ log }: { log: DailyLog }) {
  return <div className="flex flex-col gap-4 text-sm"><Info label="Work completed" value={log.workCompleted} /><Info label="Work in progress" value={log.workInProgress} /><Info label="Planned next" value={log.workPlanned} /><Info label="Blockers" value={log.blockers} /><Info label="Materials received" value={log.materialsReceived} /><Info label="Notes" value={log.notes} />{log.documents.length > 0 && <div><p className="mb-2 font-medium">Images</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{log.documents.map((doc) => <a key={doc.id} href={`/api/documents/${doc.id}/file`} target="_blank" className="overflow-hidden rounded-xl border bg-stone-100"><img src={`/api/documents/${doc.id}/file`} alt={doc.name} className="aspect-square w-full object-cover" /></a>)}</div></div>}</div>;
}

function Info({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 whitespace-pre-wrap">{value}</p></div>;
}

async function uploadFiles(files: File[], date: string) {
  const docs: DailyDoc[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("category", "photos");
    fd.set("tags", `daily-log,${date}`);
    const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Could not upload ${file.name}`);
    docs.push(data as DailyDoc);
  }
  return docs;
}
