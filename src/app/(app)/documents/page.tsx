"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, type DocCategory } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { FileThumb, FileViewer, UploadOverlay } from "@/components/file-viewer";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CardSkeleton, Spinner } from "@/components/ui/spinner";
import Link from "next/link";

type Doc = {
  id: string;
  name: string;
  driveFileId: string;
  thumbnailUrl: string | null;
  webViewLink: string | null;
  mimeType: string | null;
  category: string;
  tags: string[];
  uploadedAt: string;
};

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<Doc | null>(null);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Doc | null>(null);

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });

  const list = useQuery({
    queryKey: ["documents", category, q],
    queryFn: () => {
      const s = new URLSearchParams();
      if (category) s.set("category", category);
      if (q) s.set("q", q);
      return fetch(`/api/documents?${s}`).then((r) => r.json()) as Promise<Doc[]>;
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("category", category || "misc");
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      return data as Doc;
    },
    onSuccess: () => {
      toast.success("Uploaded");
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (doc: Doc) => {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast.success("Document deleted");
      setPendingDelete(null);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async (body: { id: string } & Record<string, unknown>) => {
      const { id, ...rest } = body;
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rest),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Document updated");
      qc.invalidateQueries({ queryKey: ["documents"] });
      setEditing(null);
    },
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <UploadOverlay show={upload.isPending} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">Drawings, receipts, and approvals. Tap a file to preview. Delete from the card or viewer.</p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
          {upload.isPending ? <Spinner /> : <Upload className="size-4" />}
          Upload
          <input
            type="file"
            className="hidden"
            accept="image/*,.pdf,.dwg,.docx,.xlsx,.doc,.xls,application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {!settings.data?.driveConnected && (
        <p className="rounded-lg border bg-amber-50 px-3 py-2 text-sm">
          Connect Google in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          to upload files to Drive.
        </p>
      )}

      <Input className="min-h-11" placeholder="Search name or tag" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Button size="sm" className="min-h-9" variant={category === "" ? "default" : "outline"} onClick={() => setCategory("")}>
          All
        </Button>
        {DOC_CATEGORIES.map((c) => (
          <Button key={c} size="sm" className="min-h-9" variant={category === c ? "default" : "outline"} onClick={() => setCategory(c)}>
            {DOC_CATEGORY_LABELS[c]}
          </Button>
        ))}
      </div>

      {list.isLoading ? (
        <CardSkeleton rows={6} />
      ) : (list.data?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No documents yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload a drawing or approval PDF.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {list.data!.map((doc) => (
            <div key={doc.id} className="group relative overflow-hidden rounded-xl border bg-card">
              <button className="block w-full text-left" onClick={() => setPreview(doc)}>
                <div className="aspect-square overflow-hidden">{<FileThumb doc={doc} />}</div>
                <div className="p-2">
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{DOC_CATEGORY_LABELS[doc.category as DocCategory]}</p>
                </div>
              </button>
              <button
                className="absolute top-2 right-2 inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg bg-background/90 text-destructive shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDelete(doc);
                }}
                aria-label={`Delete ${doc.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="pr-8">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="flex flex-col gap-3">
              <FileViewer doc={preview} />
              <div className="flex flex-wrap gap-2">
                {preview.webViewLink && (
                  <a className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm" href={preview.webViewLink} target="_blank" rel="noreferrer">
                    Open in Drive
                  </a>
                )}
                <a className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm" href={`/api/documents/${preview.id}/file`} download={preview.name}>
                  Download
                </a>
                <Button variant="outline" className="min-h-11" onClick={() => setEditing(preview)}>
                  <Pencil className="size-4" /> Rename
                </Button>
                <Button variant="destructive" className="min-h-11" onClick={() => setPendingDelete(preview)}>
                  <Trash2 className="size-4" /> Delete
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Added {formatDate(preview.uploadedAt)}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit document</DialogTitle>
          </DialogHeader>
          {editing && <DocEditForm doc={editing} pending={patch.isPending} onSave={(body) => patch.mutate(body)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this file?"
        body={pendingDelete ? `${pendingDelete.name} will be removed here and moved to Drive trash.` : ""}
        pending={del.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && del.mutate(pendingDelete)}
      />
    </div>
  );
}

function DocEditForm({
  doc,
  onSave,
  pending,
}: {
  doc: Doc;
  pending?: boolean;
  onSave: (body: { id: string } & Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(doc.name);
  const [category, setCategory] = useState(doc.category);
  const [tags, setTags] = useState(doc.tags.join(", "));
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          id: doc.id,
          name,
          category,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        });
      }}
    >
      <Input className="min-h-11" value={name} onChange={(e) => setName(e.target.value)} />
      <Select value={category} onValueChange={(v) => v && setCategory(String(v))}>
        <SelectTrigger className="min-h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DOC_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {DOC_CATEGORY_LABELS[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input className="min-h-11" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags" />
      <Button className="min-h-11" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
