"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskForm } from "@/components/task-form";
import { CardSkeleton } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatMonthLabel, formatWeekLabel, isoWeekKey, monthKey, todayIso } from "@/lib/format";

type Task = {
  id: string;
  title: string;
  dueDate: string | null;
  goalLabel: string | null;
  status: string;
  notes: string | null;
  gcalEventId: string | null;
  calendarSyncError: string | null;
  sortOrder: number;
  completedAt: string | null;
};

type View = "week" | "month" | "goal";

export default function TasksPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>("week");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [statusView, setStatusView] = useState<"active" | "completed" | "all">("active");
  const [detail, setDetail] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const list = useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetch("/api/tasks").then((r) => r.json()) as Promise<Task[]>,
  });

  const patch = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      return data as Task;
    },
    onSuccess: (row) => {
      if (row.calendarSyncError) toast.error(row.calendarSyncError);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast.success("Task deleted");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const today = todayIso();
  const tasks = useMemo(() => (list.data ?? []).filter((task) => {
    const matchesStatus = statusView === "all" || (statusView === "completed" ? task.status === "done" : task.status !== "done");
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || [task.title, task.goalLabel, task.notes].some((value) => value?.toLowerCase().includes(needle));
    return matchesStatus && matchesSearch;
  }), [list.data, statusView, search]);
  const totalTasks = list.data?.length ?? 0;
  const completedCount = (list.data ?? []).filter((task) => task.status === "done").length;
  const overdue = tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today);

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      let key = "No date";
      if (view === "goal") key = t.goalLabel || "Ungrouped";
      else if (t.dueDate) key = view === "week" ? isoWeekKey(t.dueDate) : monthKey(t.dueDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        const ad = a.status === "done" ? 1 : 0;
        const bd = b.status === "done" ? 1 : 0;
        if (ad !== bd) return ad - bd;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      });
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tasks, view]);

  function label(key: string) {
    if (key === "No date" || key === "Ungrouped") return key;
    if (view === "week" && key.includes("-W")) return formatWeekLabel(key);
    if (view === "month" && /^\d{4}-\d{2}$/.test(key)) return formatMonthLabel(key);
    return key;
  }


  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">Plan the work. Keep every completed task as part of the project record.</p>
        </div>
        <Button className="min-h-11" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4" /> Add
        </Button>
      </div>

      <Input className="min-h-11" placeholder="Search tasks, goals, or notes" value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="grid grid-cols-3 rounded-xl border p-1">
        {(["week", "month", "goal"] as View[]).map((v) => (
          <button
            key={v}
            className={`min-h-11 rounded-lg text-sm font-medium capitalize ${view === v ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setView(v)}
          >
            By {v}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 rounded-xl border bg-white p-1">
        {(["active", "completed", "all"] as const).map((v) => (
          <button key={v} className={`min-h-10 rounded-lg text-sm font-medium capitalize ${statusView === v ? "bg-emerald-600 text-white" : "text-muted-foreground"}`} onClick={() => setStatusView(v)}>
            {v} {v === "completed" ? `(${completedCount})` : v === "all" ? `(${totalTasks})` : ""}
          </button>
        ))}
      </div>

      {overdue.length > 0 && (
        <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
          <p className="mb-2 text-sm font-medium text-destructive">Overdue</p>
          <TaskTable items={overdue} overdue onToggle={(t) => patch.mutate({ id: t.id, body: { status: t.status === "done" ? "todo" : "done" } })} onView={setDetail} onEdit={(t) => { setEditing(t); setOpen(true); }} onDelete={(t) => del.mutate(t.id)} />
        </section>
      )}

      {list.isLoading ? (
        <CardSkeleton rows={4} />
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">{statusView === "completed" ? "No completed tasks yet" : "No tasks yet"}</p>
          {statusView !== "completed" && <Button className="mt-4 min-h-11" onClick={() => setOpen(true)}>Add your first task</Button>}
        </div>
      ) : (
        groups.map(([key, items]) => (
          <section key={key} className="rounded-xl border p-3">
            <p className="mb-2 text-sm font-medium">{label(key)}</p>
            <TaskTable items={items} onToggle={(t) => patch.mutate({ id: t.id, body: { status: t.status === "done" ? "todo" : "done" } })} onView={setDetail} onEdit={(t) => { setEditing(t); setOpen(true); }} onDelete={(t) => del.mutate(t.id)} />
          </section>
        ))
      )}

      <TaskForm key={editing?.id ?? "new"} open={open} onOpenChange={setOpen} initial={editing ?? undefined} />
      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}><DialogContent><DialogHeader><DialogTitle>{detail?.title}</DialogTitle></DialogHeader>{detail && <div className="flex flex-col gap-3 text-sm"><p><span className="text-muted-foreground">Status:</span> {detail.status === "done" ? "Completed" : "Pending"}</p><p><span className="text-muted-foreground">Due:</span> {formatDate(detail.dueDate)}</p>{detail.goalLabel && <p><span className="text-muted-foreground">Goal:</span> {detail.goalLabel}</p>}<p className="whitespace-pre-wrap"><span className="text-muted-foreground">Notes:</span> {detail.notes || "No notes"}</p></div>}</DialogContent></Dialog>
    </div>
  );
}

function TaskTable({ items, overdue, onToggle, onView, onEdit, onDelete }: { items: Task[]; overdue?: boolean; onToggle: (task: Task) => void; onView: (task: Task) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void }) {
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="w-12 px-2 py-2">Done</th><th className="px-2 py-2">Task</th><th className="px-2 py-2">Goal / phase</th><th className="px-2 py-2">Due / completed</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Notes</th><th className="w-32 px-2 py-2 text-right">Actions</th></tr></thead><tbody>{items.map((task) => <tr key={task.id} className={`border-b last:border-0 ${task.status === "done" ? "bg-emerald-50/80 text-emerald-950" : "hover:bg-zinc-50"}`}><td className="px-2 py-2"><Checkbox checked={task.status === "done"} onCheckedChange={() => onToggle(task)} /></td><td className={`px-2 py-2 font-medium ${task.status === "done" ? "line-through decoration-emerald-600/60" : overdue ? "text-destructive" : ""}`}>{task.status === "done" && <CheckCircle2 className="mr-1 inline size-4 text-emerald-600" />}{task.title}</td><td className="px-2 py-2 text-muted-foreground">{task.goalLabel || "—"}</td><td className="px-2 py-2 text-muted-foreground">{task.status === "done" ? `Completed ${formatDate(task.completedAt || task.dueDate)}` : formatDate(task.dueDate)}</td><td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs ${task.status === "done" ? "bg-emerald-100 text-emerald-700" : overdue ? "bg-red-100 text-red-700" : "bg-zinc-100 text-zinc-700"}`}>{task.status === "done" ? "Completed" : overdue ? "Overdue" : "Pending"}</span></td><td className="max-w-[220px] px-2 py-2 text-muted-foreground"><span className="line-clamp-1" title={task.notes || undefined}>{task.notes || "—"}</span></td><td className="px-2 py-1"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="View task" onClick={() => onView(task)}><Eye className="size-4" /></Button><Button variant="ghost" size="icon" title="Edit task" onClick={() => onEdit(task)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" title="Delete task" onClick={() => onDelete(task)}><Trash2 className="size-4" /></Button></div></td></tr>)}</tbody></table></div>
  );
}
