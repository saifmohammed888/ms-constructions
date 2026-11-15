"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Check, ChevronLeft, ChevronRight, Download, Eye, FileUp, Grid3x3, Image as ImageIcon, List, MessageCircle, Pencil, Trash2, Upload } from "lucide-react";
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
import { uploadDocuments, filesFromInput } from "@/lib/upload";
import { CardSkeleton, Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { DocumentGrid, BulkBar } from "@/components/document-grid";
import { applyOrganizeFilter, duplicateIds, isImageDoc, stageCounts, type OrganizeDoc, type OrganizeFilter } from "@/lib/document-organize";
import Link from "next/link";

type Doc = OrganizeDoc & {
  driveFileId: string;
  thumbnailUrl: string | null;
  webViewLink: string | null;
};

const PAGE_SIZE = 60;
const VIEW_KEY = "documents-view";

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<OrganizeFilter>({ kind: "all" });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [bulk, setBulk] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [preview, setPreview] = useState<Doc | null>(null);
  const [selectedImage, setSelectedImage] = useState<Doc | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Doc | null>(null);
  const [uploadCategory, setUploadCategory] = useState<DocCategory>((category as DocCategory) || "misc");
  const [dragging, setDragging] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewsBusy, setPreviewsBusy] = useState(false);
  const [uploadState, setUploadState] = useState({ done: 0, total: 0, failed: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const activeUploadCategory = category ? (category as DocCategory) : uploadCategory;

  // Remember the chosen view on this device. Storage can be blocked, which is fine.
  useEffect(() => {
    try {
      // Reading the saved preference is the one place the view has to be set after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(VIEW_KEY) === "list") setView("list");
    } catch {
      /* default view */
    }
  }, []);
  const chooseView = (next: "grid" | "list") => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* not persisted */
    }
  };

  const selectCategory = (nextCategory: "" | DocCategory) => {
    setCategory(nextCategory);
    setVisibleCount(PAGE_SIZE);
    if (nextCategory) setUploadCategory(nextCategory);
  };

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });

  const list = useQuery({
    queryKey: ["documents", category, q],
    queryFn: async () => {
      const s = new URLSearchParams();
      if (category) s.set("category", category);
      if (q) s.set("q", q);
      const res = await fetch(`/api/documents?${s}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load Documents");
      return data as Doc[];
    },
  });

  const expenses = useQuery({
    queryKey: ["expenses", "attach-invoice"],
    enabled: attachOpen,
    queryFn: () => fetch("/api/expenses").then((r) => r.json()) as Promise<{ items: { id: string; amount: string; category: string; date: string; receiptDocId: string | null }[] }>,
  });

  const allDocuments = useMemo(() => list.data ?? [], [list.data]);
  const duplicates = useMemo(() => duplicateIds(allDocuments), [allDocuments]);
  const stages = useMemo(() => stageCounts(allDocuments).slice(0, 8), [allDocuments]);
  const filtered = useMemo(() => applyOrganizeFilter(allDocuments, filter, duplicates), [allDocuments, filter, duplicates]);
  const previewsMissing = allDocuments.filter((doc) => !doc.hasPreview && isImageDoc(doc)).length;

  // Previous/next move through the list in the order it is shown.
  const previewIndex = preview ? filtered.findIndex((d) => d.id === preview.id) : -1;
  const stepPreview = (step: 1 | -1) => {
    const target = filtered[previewIndex + step];
    if (previewIndex >= 0 && target) setPreview(target);
  };
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { const t = filtered[previewIndex + 1]; if (t) setPreview(t); }
      else if (e.key === "ArrowLeft") { const t = filtered[previewIndex - 1]; if (t) setPreview(t); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, previewIndex, filtered]);

  const attachInvoice = useMutation({
    mutationFn: async (expenseId: string) => {
      if (!selectedImage) throw new Error("Select an image first");
      const res = await fetch(`/api/expenses/${expenseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receiptDocId: selectedImage.id }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not attach invoice");
    },
    onSuccess: () => {
      toast.success("Invoice attached to expense");
      setAttachOpen(false);
      setSelectedImage(null);
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Same helper as Work Log and Expenses: normalised names, one retry on flaky
  // mobile networks, sequential sends, and the same error wording everywhere.
  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    const selectedCategory = activeUploadCategory || "misc";
    setUploadState({ done: 0, total: files.length, failed: 0 });
    const { uploaded, failed } = await uploadDocuments<Doc>(files, {
      category: selectedCategory,
      onProgress: (done) => setUploadState((state) => ({ ...state, done })),
    });
    for (const item of failed) toast.error(`${item.file.name}: ${item.error}`);
    setUploadState((state) => ({ ...state, done: files.length, failed: failed.length }));
    await qc.invalidateQueries({ queryKey: ["documents"] });
    if (uploaded.length) toast.success(`${uploaded.length} file${uploaded.length === 1 ? "" : "s"} uploaded to ${DOC_CATEGORY_LABELS[selectedCategory]}`);
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
    onError: (e: Error) => toast.error(e.message),
  });

  // Bulk actions run one file at a time so Drive is never flooded and failures are reported per file.
  const runBulk = async (label: string, work: (doc: Doc) => Promise<void>) => {
    const targets = allDocuments.filter((doc) => bulk.has(doc.id));
    if (!targets.length) return;
    setBulkBusy(true);
    let failed = 0;
    for (const doc of targets) {
      try {
        await work(doc);
      } catch {
        failed += 1;
      }
    }
    setBulkBusy(false);
    await qc.invalidateQueries({ queryKey: ["documents"] });
    const done = targets.length - failed;
    if (done) toast.success(`${label}: ${done} file${done === 1 ? "" : "s"}`);
    if (failed) toast.error(`${failed} file${failed === 1 ? "" : "s"} could not be updated. Try again.`);
    setBulk(new Set());
  };

  const bulkCategory = (next: DocCategory) =>
    runBulk(`Moved to ${DOC_CATEGORY_LABELS[next]}`, async (doc) => {
      if (doc.category === next) return;
      const res = await fetch(`/api/documents/${doc.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: next }) });
      if (!res.ok) throw new Error("Move failed");
    });

  const bulkTag = (tag: string) =>
    runBulk(`Tagged "${tag}"`, async (doc) => {
      if (doc.tags.includes(tag)) return;
      const res = await fetch(`/api/documents/${doc.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: [...doc.tags, tag].slice(0, 50) }) });
      if (!res.ok) throw new Error("Tag failed");
    });

  const bulkDelete = async () => {
    setBulkDeleteOpen(false);
    await runBulk("Removed", async (doc) => {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    });
  };

  // Builds previews for older photos in small batches until none are left.
  const makePreviews = async () => {
    setPreviewsBusy(true);
    let made = 0;
    let remaining = previewsMissing;
    try {
      for (let round = 0; round < 40 && remaining > 0; round += 1) {
        const res = await fetch("/api/document-previews/backfill", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Preview run failed");
        made += data.processed;
        remaining = data.remaining;
        if (data.processed === 0) break;
        void qc.invalidateQueries({ queryKey: ["documents"] });
      }
      toast.success(made ? `Previews made for ${made} photo${made === 1 ? "" : "s"}` : "No new previews were needed");
      if (remaining > 0) toast.error(`${remaining} photo${remaining === 1 ? "" : "s"} still have no preview. Try again later.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not make previews");
    } finally {
      setPreviewsBusy(false);
      await qc.invalidateQueries({ queryKey: ["documents"] });
    }
  };

  const downloadDocument = async (doc: Doc) => {
    try {
      setDownloadingId(doc.id);
      const response = await fetch(`/api/documents/${doc.id}/file?download=1`);
      if (!response.ok) {
        const body = await readJsonResponse<{ error?: string }>(response);
        throw new Error(getErrorMessage(body, "Could not download file"));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download file");
    } finally {
      setDownloadingId(null);
    }
  };

  const shareDocumentFile = async (doc: Doc) => {
    const shareLink = documentShareLink(doc);
    try {
      setSharingId(doc.id);
      if (!navigator.share) {
        window.open(whatsappShareUrl(doc), "_blank", "noopener,noreferrer");
        return;
      }

      const response = await fetch(`/api/documents/${doc.id}/file`);
      if (!response.ok) throw new Error("Could not prepare file for sharing");
      const blob = await response.blob();
      const file = new File([blob], doc.name, { type: blob.type || doc.mimeType || "application/octet-stream" });
      const payload = {
        title: doc.name,
        text: "MS Construction document",
        files: [file],
      };

      if (navigator.canShare?.(payload)) {
        await navigator.share(payload);
        return;
      }

      await navigator.share({ title: doc.name, text: `MS Construction document: ${doc.name}`, url: shareLink });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Could not share file");
      window.open(whatsappShareUrl(doc), "_blank", "noopener,noreferrer");
    } finally {
      setSharingId(null);
    }
  };

  const toggleBulk = (id: string) => {
    setBulk((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const uploading = uploadState.total > 0 && uploadState.done < uploadState.total;
  const gridDocs = filtered.slice(0, visibleCount);

  return (
    <div className="library-page mx-auto flex max-w-5xl flex-col gap-4 pb-28">
      <UploadOverlay show={uploading} />
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">Drawings, photos, receipts and approvals. Tap a file to view it.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setBulkOpen((open) => !open)} aria-expanded={bulkOpen}>
            {bulkOpen ? "Hide bulk upload" : "Bulk upload"}
          </Button>
          <Button type="button" variant="outline" className="min-h-11" aria-label="Take photo" onClick={() => cameraInputRef.current?.click()} disabled={uploading}>
            <Camera className="size-4" /> <span className="hidden sm:inline">Photo</span>
          </Button>
          <Button type="button" className="min-h-11" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Spinner /> : <Upload className="size-4" />}
            Upload
          </Button>
          {/* Gallery / files picker. Hidden and opened via ref.click() so mobile
              browsers treat the tap as a direct gesture on the input. */}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,.pdf,.dwg,.docx,.xlsx,.doc,.xls,application/pdf"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              const files = filesFromInput(e.currentTarget);
              if (files.length) void uploadFiles(files);
              e.currentTarget.value = "";
            }}
          />
          {/* Opens the phone's native camera (rear lens) for site photos. */}
          <input
            ref={cameraInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            capture="environment"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              const files = filesFromInput(e.currentTarget);
              if (files.length) void uploadFiles(files);
              e.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      {settings.isSuccess && !settings.data?.driveConnected && (
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
          <Select value={activeUploadCategory} onValueChange={(v) => v && setUploadCategory(v as DocCategory)}>
            <SelectTrigger className="min-h-11 flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>{DOC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{DOC_CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => inputRef.current?.click()}>Choose files</Button>
        </div>
        {uploadState.total > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">Uploaded {uploadState.done} of {uploadState.total}{uploadState.failed ? ` · ${uploadState.failed} failed` : ""}</p>
        )}
      </section>}

      <div className="flex flex-wrap items-center gap-2">
        <Input className="min-h-11 min-w-0 flex-1" placeholder="Search name or tag" value={q} onChange={(e) => { setQ(e.target.value); setVisibleCount(PAGE_SIZE); }} />
        <div className="inline-flex rounded-xl border bg-white p-1" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "grid"} onClick={() => chooseView("grid")} className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <Grid3x3 className="size-4" /> Thumbnails
          </button>
          <button type="button" aria-pressed={view === "list"} onClick={() => chooseView("list")} className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <List className="size-4" /> List
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Button size="sm" className="min-h-9 shrink-0" variant={category === "" ? "default" : "outline"} onClick={() => selectCategory("")}>
          All
        </Button>
        {DOC_CATEGORIES.map((c) => (
          <Button key={c} size="sm" className="min-h-9 shrink-0" variant={category === c ? "default" : "outline"} onClick={() => selectCategory(c)}>
            {DOC_CATEGORY_LABELS[c]}
          </Button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Quick filters">
        {([["all", "Everything"], ["unlinked", "Not linked"], ["untagged", "No tags"], ["duplicates", `Possible duplicates${duplicates.size ? ` (${duplicates.size})` : ""}`]] as const).map(([kind, label]) => (
          <Button key={kind} size="sm" className="min-h-9 shrink-0" variant={filter.kind === kind ? "default" : "outline"} onClick={() => { setFilter({ kind }); setVisibleCount(PAGE_SIZE); }}>
            {label}
          </Button>
        ))}
        {stages.map(({ stage, count }) => (
          <Button key={stage} size="sm" className="min-h-9 shrink-0" variant={filter.kind === "stage" && filter.stage === stage ? "default" : "outline"} onClick={() => { setFilter({ kind: "stage", stage }); setVisibleCount(PAGE_SIZE); }}>
            {stage} · {count}
          </Button>
        ))}
      </div>

      {previewsMissing > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-4 py-3 text-sm">
          <span>{previewsMissing} photo{previewsMissing === 1 ? "" : "s"} still need a quick preview, so the thumbnails load fast.</span>
          <Button type="button" variant="outline" className="min-h-10" onClick={makePreviews} disabled={previewsBusy}>
            {previewsBusy && <Spinner />} Make previews
          </Button>
        </div>
      )}

      {list.isLoading ? (
        <CardSkeleton rows={6} />
      ) : list.isError ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">Could not load Documents. Check your connection and try again.</p>
      ) : allDocuments.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No documents yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload a drawing or approval PDF.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Nothing matches this filter</p>
          <Button className="mt-3 min-h-10" variant="outline" onClick={() => setFilter({ kind: "all" })}>Show everything</Button>
        </div>
      ) : view === "grid" ? (
        <>
          <DocumentGrid docs={gridDocs} selected={bulk} duplicates={duplicates} onToggle={toggleBulk} onOpen={(doc) => setPreview(doc as Doc)} />
          {filtered.length > visibleCount && (
            <Button variant="outline" className="min-h-11 self-center" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
              Show more · {filtered.length - visibleCount} left
            </Button>
          )}
        </>
      ) : (
        <ImageTable items={filtered} duplicates={duplicates} selected={selectedImage} sharingId={sharingId} downloadingId={downloadingId} onSelect={setSelectedImage} onView={setPreview} onEdit={setEditing} onAttach={() => setAttachOpen(true)} onShare={shareDocumentFile} onDownload={downloadDocument} />
      )}

      {bulk.size > 0 && (
        <BulkBar
          count={bulk.size}
          busy={bulkBusy}
          onCategory={bulkCategory}
          onAddTag={bulkTag}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={() => setBulk(new Set())}
        />
      )}

      <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="pr-8">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" className="min-h-11" onClick={() => stepPreview(-1)} disabled={previewIndex <= 0} aria-label="Previous document">
                  <ChevronLeft className="size-4" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground" aria-live="polite">{previewIndex + 1} of {filtered.length}</span>
                <Button variant="outline" className="min-h-11" onClick={() => stepPreview(1)} disabled={previewIndex < 0 || previewIndex >= filtered.length - 1} aria-label="Next document">
                  Next <ChevronRight className="size-4" />
                </Button>
              </div>
              <FileViewer doc={preview} />
              <div className="flex flex-wrap gap-2">
                {preview.webViewLink && (
                  <a className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm" href={preview.webViewLink} target="_blank" rel="noreferrer">
                    Open in Drive
                  </a>
                )}
                <Button variant="outline" className="min-h-11" onClick={() => downloadDocument(preview)} disabled={downloadingId === preview.id}>
                  {downloadingId === preview.id ? <Spinner /> : <Download className="size-4" />} Download
                </Button>
                <Button variant="outline" className="min-h-11" onClick={() => shareDocumentFile(preview)} disabled={sharingId === preview.id}>
                  {sharingId === preview.id ? <Spinner /> : <MessageCircle className="size-4" />} Share file
                </Button>
                <Button variant="outline" className="min-h-11" onClick={() => setEditing(preview)}>
                  <Pencil className="size-4" /> Rename
                </Button>
                <Button variant="destructive" className="min-h-11" onClick={() => setPendingDelete(preview)}>
                  <Trash2 className="size-4" /> Delete
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Added {formatDate(preview.uploadedAt.slice(0, 10))} · {preview.linkCount} linked {preview.linkCount === 1 ? "record" : "records"}
                {duplicates.has(preview.id) && " · possible duplicate of another file with the same name and size"}
              </p>
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
        body={pendingDelete ? `${pendingDelete.name} is removed from the app and unlinked from any expenses or work logs. The file stays in Google Drive.` : ""}
        pending={del.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && del.mutate(pendingDelete)}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`Delete ${bulk.size} file${bulk.size === 1 ? "" : "s"}?`}
        body="The selected files are removed from the app and unlinked from any expenses or work logs. They stay in Google Drive."
        pending={bulkBusy}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={bulkDelete}
      />
    </div>
  );
}

function ImageTable({ items, duplicates, selected, sharingId, downloadingId, onSelect, onView, onEdit, onAttach, onShare, onDownload }: { items: Doc[]; duplicates: Set<string>; selected: Doc | null; sharingId: string | null; downloadingId: string | null; onSelect: (doc: Doc | null) => void; onView: (doc: Doc) => void; onEdit: (doc: Doc) => void; onAttach: () => void; onShare: (doc: Doc) => void; onDownload: (doc: Doc) => void }) {
  return <section className="table-shell overflow-x-auto" aria-label="Document files"><div className="flex flex-wrap items-center gap-2 border-b border-black/5 px-4 py-3"><ImageIcon className="size-4 text-primary" /><h2 className="text-sm font-semibold">All files</h2><span className="text-xs text-muted-foreground">{items.length} files · click a title to edit</span>{selected && <Button size="sm" className="ml-auto" onClick={onAttach}><Check className="size-3.5" />Attach to expense</Button>}</div><table className="w-full text-sm"><thead><tr><th className="w-10" aria-label="Select" /><th>File</th><th>Category</th><th>Added</th><th>Links</th><th className="text-right">Action</th></tr></thead><tbody>{items.map((doc) => <tr key={doc.id}><td><Checkbox checked={selected?.id === doc.id} aria-label={`Select ${doc.name}`} onCheckedChange={(checked) => onSelect(checked ? doc : null)} /></td><td className="max-w-[24rem] truncate font-medium"><button className="text-left hover:text-primary hover:underline" onClick={() => onEdit(doc)}>{doc.name}</button>{duplicates.has(doc.id) && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900">Possible duplicate</span>}</td><td className="text-muted-foreground">{DOC_CATEGORY_LABELS[doc.category as DocCategory] ?? doc.category}</td><td className="text-muted-foreground">{formatDate(doc.uploadedAt.slice(0, 10))}</td><td className="text-muted-foreground">{doc.linkCount}</td><td><div className="flex justify-end gap-1"><Button variant="outline" size="sm" className="size-11 p-0 lg:h-8 lg:w-auto lg:px-3" onClick={() => onView(doc)} aria-label={`View ${doc.name}`} title="View"><Eye className="size-3.5" /><span className="hidden lg:inline">View</span></Button><Button variant="outline" size="sm" className="size-11 p-0 lg:h-8 lg:w-auto lg:px-3" onClick={() => onDownload(doc)} disabled={downloadingId === doc.id} aria-label={`Download ${doc.name}`} title="Download">{downloadingId === doc.id ? <Spinner /> : <Download className="size-3.5" />}<span className="hidden lg:inline">Download</span></Button><Button variant="outline" size="sm" className="size-11 p-0 lg:h-8 lg:w-auto lg:px-3" onClick={() => onShare(doc)} disabled={sharingId === doc.id} aria-label={`Share ${doc.name} as file`} title="Share file">{sharingId === doc.id ? <Spinner /> : <MessageCircle className="size-3.5" />}<span className="hidden lg:inline">Share</span></Button></div></td></tr>)}</tbody></table></section>;
}

function documentShareLink(doc: Doc) {
  if (doc.webViewLink) return doc.webViewLink;
  if (typeof window === "undefined") return `/api/documents/${doc.id}/file`;
  return `${window.location.origin}/api/documents/${doc.id}/file`;
}

function whatsappShareUrl(doc: Doc) {
  const text = `MS Construction document: ${doc.name}\n${documentShareLink(doc)}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

async function readJsonResponse<T>(res: Response) {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return { error: text } as T;
  }
}

function getErrorMessage(body: unknown, fallback: string) {
  return typeof body === "object" && body && "error" in body && typeof body.error === "string" ? body.error : fallback;
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
