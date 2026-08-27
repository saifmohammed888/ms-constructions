"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
      return data;
    },
    onSuccess: () => {
      toast.success("Uploaded to Drive");
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (doc: Doc) => {
      if (!confirm(`Delete ${doc.name}? It will also go to Drive trash.`)) return;
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast.success("Document deleted");
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-sm text-muted-foreground">Files live in your Google Drive. This list is stored locally for speed.</p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
          Upload
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {!settings.data?.driveConnected && (
        <p className="rounded-lg border bg-muted/50 p-3 text-sm">
          Connect Google in Settings to upload drawings, receipts, and contracts to Drive.
        </p>
      )}

      <Input className="min-h-11" placeholder="Search name or tag" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-2 overflow-x-auto">
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
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : (list.data?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No documents yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload a drawing or approval PDF.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {list.data!.map((doc) => (
            <button
              key={doc.id}
              className="overflow-hidden rounded-xl border text-left"
              onClick={() => setPreview(doc)}
            >
              <div className="flex aspect-square items-center justify-center bg-muted">
                {doc.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={doc.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={async (e) => {
                      const res = await fetch(`/api/documents/${doc.id}/refresh`, { method: "POST" });
                      const next = await res.json();
                      if (next.thumbnailUrl) (e.target as HTMLImageElement).src = next.thumbnailUrl;
                    }}
                  />
                ) : (
                  <span className="p-3 text-xs text-muted-foreground">{doc.mimeType || "File"}</span>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-sm font-medium">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{DOC_CATEGORY_LABELS[doc.category as DocCategory]}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="flex flex-col gap-3">
              <iframe
                title={preview.name}
                className="h-[60vh] w-full rounded-lg border"
                src={`https://drive.google.com/file/d/${preview.driveFileId}/preview`}
              />
              <div className="flex flex-wrap gap-2">
                {preview.webViewLink && (
                  <a className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm" href={preview.webViewLink} target="_blank" rel="noreferrer">
                    Open in Drive
                  </a>
                )}
                <a
                  className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm"
                  href={`https://drive.google.com/uc?id=${preview.driveFileId}&export=download`}
                >
                  Download
                </a>
                <Button variant="outline" className="min-h-11" onClick={() => setEditing(preview)}>
                  Rename / tags
                </Button>
                <Button variant="destructive" className="min-h-11" onClick={() => preview && del.mutate(preview)}>
                  Delete
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
          {editing && <DocEditForm doc={editing} onSave={(body) => patch.mutate(body)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocEditForm({
  doc,
  onSave,
}: {
  doc: Doc;
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
      <Button className="min-h-11" type="submit">
        Save
      </Button>
    </form>
  );
}
