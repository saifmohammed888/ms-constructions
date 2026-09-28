"use client";

import { FileSpreadsheet, FileText, FileType2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";

type Doc = {
  id: string;
  name: string;
  driveFileId: string;
  mimeType: string | null;
};

function kind(mime: string | null, name: string) {
  const m = (mime || "").toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic|bmp)$/.test(n)) return "image" as const;
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf" as const;
  return "other" as const;
}

export function FileViewer({ doc }: { doc: Doc }) {
  const [failed, setFailed] = useState(false);
  const t = kind(doc.mimeType, doc.name);
  const src = `/api/documents/${doc.id}/file`;
  const drivePreview = `https://drive.google.com/file/d/${doc.driveFileId}/preview`;

  if (failed || t === "other") {
    return (
      <div className="relative h-[min(70vh,720px)] w-full overflow-hidden rounded-xl border bg-stone-100">
        <iframe title={doc.name} className="h-full w-full" src={drivePreview} />
      </div>
    );
  }

  if (t === "image") {
    return (
      <div className="relative flex max-h-[70vh] min-h-64 items-center justify-center overflow-auto rounded-xl border bg-stone-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={doc.name}
          className="max-h-[70vh] w-full object-contain"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="relative h-[min(70vh,720px)] w-full overflow-hidden rounded-xl border bg-stone-100">
      <object data={src} type="application/pdf" className="h-full w-full">
        <iframe title={doc.name} className="h-full w-full" src={drivePreview} />
      </object>
    </div>
  );
}

export function FileThumb({
  doc,
}: {
  doc: { id: string; name: string; thumbnailUrl: string | null; mimeType: string | null };
}) {
  const t = kind(doc.mimeType, doc.name);
  const ext = doc.name.includes(".") ? doc.name.split(".").pop()!.toUpperCase() : "FILE";
  if (t === "image") {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-stone-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/documents/${doc.id}/file`} alt={doc.name} className="h-full w-full object-contain" />
      </div>
    );
  }
  if (t === "pdf" && doc.thumbnailUrl) {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-stone-100 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={doc.thumbnailUrl} alt={doc.name} className="max-h-full max-w-full object-contain shadow-sm" />
      </div>
    );
  }
  if (t === "pdf") {
    return (
      <div className="relative h-full w-full overflow-hidden bg-stone-100">
        <iframe title={`${doc.name} preview`} src={`/api/documents/${doc.id}/file#page=1&view=FitH`} className="pointer-events-none absolute inset-0 h-[160%] w-full origin-top scale-[.72] bg-white" />
      </div>
    );
  }
  const Icon = /xls|xlsx|csv/.test(ext.toLowerCase()) ? FileSpreadsheet : /doc|docx/.test(ext.toLowerCase()) ? FileType2 : FileText;
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-50 to-stone-200 text-muted-foreground">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-zinc-800 shadow-sm"><Icon className="size-7" /></span>
    </div>
  );
}

export function UploadOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex items-center gap-3 rounded-xl bg-background px-5 py-4 shadow-lg">
        <Spinner className="size-5" />
        <p className="text-sm font-medium">Uploading to Drive…</p>
      </div>
    </div>
  );
}
