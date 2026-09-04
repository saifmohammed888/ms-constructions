"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  SIR_DISTRICTS,
  SIR_NOTICE_REASONS,
  SIR_NOTICE_STATUSES,
  loadTrackedNotices,
  saveTrackedNotices,
  type SirNoticeReason,
  type SirNoticeStatus,
  type TrackedNotice,
} from "@/lib/sir-data";
import { formatDate } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EMPTY_FORM = {
  voterName: "",
  epicNumber: "",
  district: "",
  assemblyConstituency: "",
  boothNumber: "",
  reason: "logical_discrepancy" as SirNoticeReason,
  status: "notice_expected" as SirNoticeStatus,
  noticeReceivedDate: "",
  hearingDate: "",
  documentsReady: false,
  notes: "",
};

function statusColor(status: SirNoticeStatus) {
  switch (status) {
    case "resolved":
      return "bg-emerald-100 text-emerald-900";
    case "appeal_filed":
      return "bg-purple-100 text-purple-900";
    case "documents_submitted":
      return "bg-blue-100 text-blue-900";
    case "hearing_scheduled":
      return "bg-amber-100 text-amber-900";
    case "notice_received":
      return "bg-orange-100 text-orange-900";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function NoticeTracker() {
  const [notices, setNotices] = useState<TrackedNotice[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TrackedNotice | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    setNotices(loadTrackedNotices());
  }, []);

  function persist(next: TrackedNotice[]) {
    setNotices(next);
    saveTrackedNotices(next);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(notice: TrackedNotice) {
    setEditing(notice);
    setForm({
      voterName: notice.voterName,
      epicNumber: notice.epicNumber,
      district: notice.district,
      assemblyConstituency: notice.assemblyConstituency,
      boothNumber: notice.boothNumber,
      reason: notice.reason,
      status: notice.status,
      noticeReceivedDate: notice.noticeReceivedDate ?? "",
      hearingDate: notice.hearingDate ?? "",
      documentsReady: notice.documentsReady,
      notes: notice.notes,
    });
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    if (editing) {
      persist(
        notices.map((n) =>
          n.id === editing.id
            ? {
                ...n,
                ...form,
                noticeReceivedDate: form.noticeReceivedDate || null,
                hearingDate: form.hearingDate || null,
                updatedAt: now,
              }
            : n,
        ),
      );
    } else {
      const row: TrackedNotice = {
        id: crypto.randomUUID(),
        ...form,
        noticeReceivedDate: form.noticeReceivedDate || null,
        hearingDate: form.hearingDate || null,
        createdAt: now,
        updatedAt: now,
      };
      persist([row, ...notices]);
    }
    setOpen(false);
  }

  function remove(id: string) {
    persist(notices.filter((n) => n.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My SIR notices</h1>
          <p className="text-sm text-muted-foreground">
            Track notices for your family. Saved locally in this browser — no account needed.
          </p>
        </div>
        <Button className="min-h-11 bg-emerald-700 hover:bg-emerald-800" onClick={openCreate}>
          <Plus className="size-4" /> Add notice
        </Button>
      </div>

      {notices.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No notices tracked yet. Add an entry when you receive a SIR notice or expect one based on the draft roll.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {notices.map((notice) => (
            <Card key={notice.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{notice.voterName}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      EPIC {notice.epicNumber || "—"} · {notice.district || "District not set"}
                    </p>
                  </div>
                  <Badge className={statusColor(notice.status)}>{SIR_NOTICE_STATUSES[notice.status]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Reason:</span> {SIR_NOTICE_REASONS[notice.reason]}
                </p>
                {notice.hearingDate && (
                  <p>
                    <span className="text-muted-foreground">Hearing:</span> {formatDate(notice.hearingDate)}
                  </p>
                )}
                {notice.noticeReceivedDate && (
                  <p>
                    <span className="text-muted-foreground">Notice received:</span>{" "}
                    {formatDate(notice.noticeReceivedDate)}
                  </p>
                )}
                <p className="text-muted-foreground">
                  Documents ready: {notice.documentsReady ? "Yes" : "Not yet"}
                </p>
                {notice.notes && <p className="rounded-lg bg-muted/60 p-3 text-xs">{notice.notes}</p>}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="min-h-9" onClick={() => openEdit(notice)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-9 text-destructive hover:text-destructive"
                    onClick={() => remove(notice.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit notice" : "Add SIR notice"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="voterName">Voter name</Label>
                <Input id="voterName" required value={form.voterName} onChange={(e) => setForm({ ...form, voterName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="epic">EPIC number</Label>
                <Input id="epic" value={form.epicNumber} onChange={(e) => setForm({ ...form, epicNumber: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label>District</Label>
                <Select value={form.district} onValueChange={(v) => setForm({ ...form, district: v ?? "" })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {SIR_DISTRICTS.map((d) => (
                      <SelectItem key={d.id} value={d.name}>
                        {d.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ac">Assembly constituency</Label>
                <Input id="ac" value={form.assemblyConstituency} onChange={(e) => setForm({ ...form, assemblyConstituency: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="booth">Booth / part number</Label>
                <Input id="booth" value={form.boothNumber} onChange={(e) => setForm({ ...form, boothNumber: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Notice reason</Label>
                <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v as SirNoticeReason })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(SIR_NOTICE_REASONS) as [SirNoticeReason, string][]).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as SirNoticeStatus })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(SIR_NOTICE_STATUSES) as [SirNoticeStatus, string][]).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="received">Notice received date</Label>
                <Input id="received" type="date" value={form.noticeReceivedDate} onChange={(e) => setForm({ ...form, noticeReceivedDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hearing">Hearing / inquiry date</Label>
                <Input id="hearing" type="date" value={form.hearingDate} onChange={(e) => setForm({ ...form, hearingDate: e.target.value })} />
              </div>
            </div>
            <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm">
              <Checkbox checked={form.documentsReady} onCheckedChange={(c) => setForm({ ...form, documentsReady: c === true })} />
              Required documents collected
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button type="submit" className="min-h-11 w-full bg-emerald-700 hover:bg-emerald-800">
              {editing ? "Save changes" : "Add notice"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
