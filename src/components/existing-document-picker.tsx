"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { DocumentImage } from "@/components/document-image";
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, type DocCategory } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type PickableDocument = {
  id: string;
  name: string;
  category: string;
  mimeType: string | null;
  uploadedAt?: string;
};

const IMAGE_PATTERN = /\.(png|jpe?g|gif|webp|heic|heif|avif|bmp|tiff?)$/i;

function isImage(doc: PickableDocument) {
  return (doc.mimeType ?? "").startsWith("image/") || IMAGE_PATTERN.test(doc.name);
}

/**
 * Pick files that are already in Documents, instead of uploading them again.
 * Used wherever a record can point at existing files (Work Log, Expenses).
 */
export function ExistingDocumentPicker({
  open,
  onOpenChange,
  title,
  alreadyAttached,
  defaultCategory,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  alreadyAttached: string[];
  defaultCategory?: DocCategory;
  onConfirm: (documents: PickableDocument[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<DocCategory | "">(defaultCategory ?? "");
  const [picked, setPicked] = useState<PickableDocument[]>([]);

  // Reads the whole library once per open; the list is filtered locally so
  // typing never waits on the network.
  const documents = useQuery({
    queryKey: ["documents", "picker"],
    enabled: open,
    queryFn: async () => {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load Documents");
      return data as PickableDocument[];
    },
  });

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (documents.data ?? []).filter((doc) => {
      if (category && doc.category !== category) return false;
      return !needle || doc.name.toLowerCase().includes(needle);
    });
  }, [documents.data, search, category]);

  const toggle = (doc: PickableDocument) => {
    setPicked((current) => (current.some((item) => item.id === doc.id) ? current.filter((item) => item.id !== doc.id) : [...current, doc]));
  };

  const confirm = () => {
    onConfirm(picked);
    setPicked([]);
    setSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPicked([]);
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[85dvh] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Files already in Documents are linked, not uploaded again.</p>
        <Input className="min-h-11" placeholder="Search by file name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search Documents" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button type="button" size="sm" className="min-h-9 shrink-0" variant={category === "" ? "default" : "outline"} onClick={() => setCategory("")}>All</Button>
          {DOC_CATEGORIES.map((c) => (
            <Button key={c} type="button" size="sm" className="min-h-9 shrink-0" variant={category === c ? "default" : "outline"} onClick={() => setCategory(c)}>
              {DOC_CATEGORY_LABELS[c]}
            </Button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {documents.isLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : documents.isError ? (
            <p className="py-10 text-center text-sm text-destructive">Could not load Documents. Close and try again.</p>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No matching files.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {visible.map((doc) => {
                const linked = alreadyAttached.includes(doc.id);
                const selected = picked.some((item) => item.id === doc.id);
                return (
                  <li key={doc.id}>
                    <button
                      type="button"
                      disabled={linked}
                      aria-pressed={selected}
                      onClick={() => toggle(doc)}
                      className={cn(
                        "relative flex w-full flex-col overflow-hidden rounded-xl border bg-white text-left transition-colors disabled:opacity-50",
                        selected ? "border-primary ring-2 ring-primary/40" : "hover:bg-muted/50",
                      )}
                    >
                      <span className="flex aspect-square w-full items-center justify-center bg-stone-100">
                        {isImage(doc) ? (
                          <DocumentImage id={doc.id} alt={doc.name} className="size-full" imgClassName="size-full object-cover" />
                        ) : (
                          <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
                        )}
                      </span>
                      <span className="flex flex-col gap-0.5 px-2 py-1.5">
                        <span className="truncate text-xs font-medium">{doc.name}</span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {linked ? "Already attached" : DOC_CATEGORY_LABELS[doc.category as DocCategory] ?? doc.category}
                        </span>
                      </span>
                      {selected && (
                        <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                          <Check className="size-3.5" aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <span className="text-sm text-muted-foreground">{picked.length} selected</span>
          <Button type="button" className="min-h-11" onClick={confirm} disabled={picked.length === 0}>
            Attach {picked.length > 0 ? picked.length : ""} {picked.length === 1 ? "file" : "files"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
