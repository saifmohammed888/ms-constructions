"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Eye, FileUp, Image as ImageIcon, Pencil, Trash2, Upload } from "lucide-react";
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
import { FileViewer, UploadOverlay } from "@/components/file-viewer";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CardSkeleton, Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";

type Doc = {
  id: string;
  name: string;
  driveFileId: string;
  thumbnailUrl: string | null;
  webViewLink: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  category: string;
  tags: string[];
  uploadedAt: string;
};

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<Doc | null>(null);
  const [selectedImage, setSelectedImage] = useState<Doc | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Doc | null>(null);
  const [uploadCategory, setUploadCategory] = useState<DocCategory>((category as DocCategory) || "misc");
  const [dragging, setDragging] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [uploadState, setUploadState] = useState({ done: 0, total: 0, failed: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

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

  const expenses = useQuery({
    queryKey: ["expenses", "attach-invoice"],
    enabled: attachOpen,
    queryFn: () => fetch("/api/expenses").then((r) => r.json()) as Promise<{ items: { id: string; amount: string; category: string; date: string; receiptDocId: string | null }[] }>,
  });

  const attachInvoice = useMutation({
    mutationFn: async (expenseId: string) => {
      if (!selectedImage) throw new Error("Select an image first");
      const res = await fetch(`/api/expenses/${expenseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receiptDocId: selectedImage.id }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not attach invoice");
    },
    onSuccess: () => { toast.success("Invoice attached to expense"); setAttachOpen(false); setSelectedImage(null); },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadOne = async (file: File, selectedCategory: DocCategory) => {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("category", selectedCategory);
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      return data as Doc;
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    const selectedCategory = uploadCategory || "misc";
    setUploadState({ done: 0, total: files.length, failed: 0 });
    let failed = 0;
    for (const file of files) {
      try {
        await uploadOne(file, selectedCategory);
      } catch (error) {
        failed += 1;
        toast.error(`${file.name}: ${error instanceof Error ? error.message : "Upload failed"}`);
      }
      setUploadState((state) => ({ ...state, done: state.done + 1, failed }));
    }
    await qc.invalidateQueries({ queryKey: ["documents"] });
    toast.success(`${files.length - failed} file${files.length - failed === 1 ? "" : "s"} uploaded to ${DOC_CATEGORY_LABELS[selectedCategory]}`);
    setTimeout(() => setUploadState({ done: 0, total: 0, failed: 0 }), 800);
  };

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

  const allDocuments = list.data ?? [];

  return (
    <div className="library-page mx-auto flex max-w-5xl flex-col gap-4">
      <UploadOverlay show={uploadState.total > 0 && uploadState.done < uploadState.total} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">Drawings, receipts, and approvals. Tap a file to preview. Delete from the card or viewer.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setBulkOpen((open) => !open)} aria-expanded={bulkOpen}>
            {bulkOpen ? "Hide bulk upload" : "Bulk upload"}
          </Button>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
            {uploadState.total > 0 && uploadState.done < uploadState.total ? <Spinner /> : <Upload className="size-4" />}
            Upload
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              accept="image/*,.pdf,.dwg,.docx,.xlsx,.doc,.xls,application/pdf"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) void uploadFiles(files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
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

      {bulkOpen && <section
        className={`rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-black/10 bg-white"}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void uploadFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <FileUp className="mx-auto size-7 text-muted-foreground" />
        <p className="mt-2 font-medium">Drop multiple files here</p>
        <p className="mt-1 text-sm text-muted-foreground">Choose a category once, then upload drawings, photos, or documents together.</p>
        <div className="mx-auto mt-3 flex max-w-sm items-center gap-2">
          <Select value={uploadCategory} onValueChange={(v) => v && setUploadCategory(v as DocCategory)}>
            <SelectTrigger className="min-h-11 flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>{DOC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{DOC_CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => inputRef.current?.click()}>Choose files</Button>
        </div>
        {uploadState.total > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">Uploaded {uploadState.done} of {uploadState.total}{uploadState.failed ? ` · ${uploadState.failed} failed` : ""}</p>
        )}
      </section>}

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

      {!list.isLoading && allDocuments.length > 0 && <ImageTable items={allDocuments} selected={selectedImage} onSelect={setSelectedImage} onView={setPreview} onEdit={setEditing} onAttach={() => setAttachOpen(true)} />}

      {list.isLoading ? (
        <CardSkeleton rows={6} />
      ) : (list.data?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No documents yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload a drawing or approval PDF.</p>
        </div>
      ) : null}

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

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Attach invoice to expense</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Choose the expense for <span className="font-medium text-foreground">{selectedImage?.name}</span>.</p>
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {(expenses.data?.items ?? []).map((expense) => <button key={expense.id} type="button" className="flex min-h-12 items-center justify-between rounded-xl border px-3 text-left text-sm transition-colors hover:bg-muted" onClick={() => attachInvoice.mutate(expense.id)} disabled={attachInvoice.isPending}><span><span className="font-medium">{expense.category}</span><span className="ml-2 text-muted-foreground">{expense.date}</span></span><span className="font-semibold">₹{Number(expense.amount).toLocaleString("en-IN")}</span></button>)}
            {!expenses.isLoading && !expenses.data?.items.length && <p className="py-6 text-center text-sm text-muted-foreground">No expenses available yet.</p>}
            {expenses.isLoading && <div className="flex justify-center py-6"><Spinner /></div>}
          </div>
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

function ImageTable({ items, selected, onSelect, onView, onEdit, onAttach }: { items: Doc[]; selected: Doc | null; onSelect: (doc: Doc | null) => void; onView: (doc: Doc) => void; onEdit: (doc: Doc) => void; onAttach: () => void }) {
  return <section className="table-shell" aria-label="Library files"><div className="flex flex-wrap items-center gap-2 border-b border-black/5 px-4 py-3"><ImageIcon className="size-4 text-primary" /><h2 className="text-sm font-semibold">All files</h2><span className="text-xs text-muted-foreground">{items.length} files · click a title to edit</span>{selected && <Button size="sm" className="ml-auto" onClick={onAttach}><Check className="size-3.5" />Attach to expense</Button>}</div><table className="w-full text-sm"><thead><tr><th className="w-10" aria-label="Select" /><th>File</th><th>Category</th><th>Added</th><th className="text-right">Action</th></tr></thead><tbody>{items.map((doc) => <tr key={doc.id}><td><Checkbox checked={selected?.id === doc.id} aria-label={`Select ${doc.name}`} onCheckedChange={(checked) => onSelect(checked ? doc : null)} /></td><td className="max-w-[24rem] truncate font-medium"><button className="text-left hover:text-primary hover:underline" onClick={() => onEdit(doc)}>{doc.name}</button></td><td className="text-muted-foreground">{DOC_CATEGORY_LABELS[doc.category as DocCategory] ?? doc.category}</td><td className="text-muted-foreground">{formatDate(doc.uploadedAt)}</td><td><Button variant="outline" size="sm" onClick={() => onView(doc)}><Eye className="size-3.5" />View</Button></td></tr>)}</tbody></table></section>;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function LibraryStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold tracking-tight">{value}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{detail}</p></div>;
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
