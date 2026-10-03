"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveForm } from "@/components/responsive-form";

type Task = {
  id?: string;
  title: string;
  dueDate?: string | null;
  goalLabel?: string | null;
  notes?: string | null;
  priority?: string;
  gcalEventId?: string | null;
};

export function TaskForm({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Task | null;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [goalLabel, setGoalLabel] = useState(initial?.goalLabel ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "normal");

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        dueDate: dueDate || null,
        goalLabel: goalLabel || null,
        groupType: goalLabel ? "goal" : "week",
        notes: notes || null,
        priority,
      };
      const url = initial?.id ? `/api/tasks/${initial.id}` : "/api/tasks";
      const res = await fetch(url, {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save task");
      return data;
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Task updated" : "Task added");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ResponsiveForm open={open} onOpenChange={onOpenChange} title={initial?.id ? "Edit task" : "Add task"}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" className="mt-1.5 min-h-11" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <select id="priority" className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>
        </div>
        <div>
          <Label htmlFor="due">Due date</Label>
          <Input id="due" type="date" className="mt-1.5 min-h-11" value={dueDate ?? ""} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="goal">Goal (optional)</Label>
          <Input
            id="goal"
            className="mt-1.5 min-h-11"
            placeholder="Approvals, Foundation, Meet architect…"
            value={goalLabel ?? ""}
            onChange={(e) => setGoalLabel(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" className="mt-1.5" value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button type="submit" className="min-h-11 gap-2" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save task"}
        </Button>
      </form>
    </ResponsiveForm>
  );
}
