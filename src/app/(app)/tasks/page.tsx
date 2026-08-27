"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { TaskForm } from "@/components/task-form";
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
};

type View = "week" | "month" | "goal";

export default function TasksPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>("week");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
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
  const tasks = list.data ?? [];
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

  function move(listInGroup: Task[], index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= listInGroup.length) return;
    const a = listInGroup[index];
    const b = listInGroup[next];
    patch.mutate({ id: a.id, body: { sortOrder: b.sortOrder } });
    patch.mutate({ id: b.id, body: { sortOrder: a.sortOrder } });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">Plan the week. Calendar sync is one-way (app → Google).</p>
        </div>
        <Button className="min-h-11" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4" /> Add
        </Button>
      </div>

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

      {overdue.length > 0 && (
        <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
          <p className="mb-2 text-sm font-medium text-destructive">Overdue</p>
          {overdue.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              overdue
              onToggle={() => patch.mutate({ id: t.id, body: { status: t.status === "done" ? "todo" : "done" } })}
              onSync={() => patch.mutate({ id: t.id, body: { syncCalendar: !t.gcalEventId } })}
              onEdit={() => { setEditing(t); setOpen(true); }}
              onDelete={() => del.mutate(t.id)}
            />
          ))}
        </section>
      )}

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No tasks yet</p>
          <Button className="mt-4 min-h-11" onClick={() => setOpen(true)}>
            Add your first task
          </Button>
        </div>
      ) : (
        groups.map(([key, items]) => (
          <section key={key} className="rounded-xl border p-3">
            <p className="mb-2 text-sm font-medium">{label(key)}</p>
            {items.map((t, i) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={() => patch.mutate({ id: t.id, body: { status: t.status === "done" ? "todo" : "done" } })}
                onSync={() => patch.mutate({ id: t.id, body: { syncCalendar: !t.gcalEventId } })}
                onEdit={() => { setEditing(t); setOpen(true); }}
                onDelete={() => del.mutate(t.id)}
                onUp={() => move(items, i, -1)}
                onDown={() => move(items, i, 1)}
              />
            ))}
          </section>
        ))
      )}

      <TaskForm key={editing?.id ?? "new"} open={open} onOpenChange={setOpen} initial={editing ?? undefined} />
    </div>
  );
}

function TaskRow({
  task,
  overdue,
  onToggle,
  onSync,
  onEdit,
  onDelete,
  onUp,
  onDown,
}: {
  task: Task;
  overdue?: boolean;
  onToggle: () => void;
  onSync: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  return (
    <div className={`flex items-start gap-2 rounded-lg px-1 py-2 ${task.status === "done" ? "opacity-60" : ""}`}>
      <Checkbox className="mt-2" checked={task.status === "done"} onCheckedChange={onToggle} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${overdue ? "text-destructive" : ""}`}>{task.title}</p>
        <p className="text-xs text-muted-foreground">{formatDate(task.dueDate)}</p>
        {task.calendarSyncError && (
          <button className="mt-1 text-xs text-destructive underline" onClick={onSync}>
            {task.calendarSyncError}
          </button>
        )}
        {task.gcalEventId && !task.calendarSyncError && (
          <Badge variant="secondary" className="mt-1">
            On calendar
          </Badge>
        )}
      </div>
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" title="Sync to Calendar" disabled={!task.dueDate} onClick={onSync}>
        🏗
      </Button>
      {onUp && (
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onUp}>
          <ArrowUp className="size-4" />
        </Button>
      )}
      {onDown && (
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onDown}>
          <ArrowDown className="size-4" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onEdit}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onDelete}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
