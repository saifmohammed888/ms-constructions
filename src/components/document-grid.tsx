"use client";

import { useMemo } from "react";
import { Check, FileText, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentImage } from "@/components/document-image";
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, type DocCategory } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { dayOf, isImageDoc, type OrganizeDoc } from "@/lib/document-organize";
import { cn } from "@/lib/utils";

export function DocumentGrid({
  docs,
  selected,
  duplicates,
  onToggle,
  onOpen,
}: {
  docs: OrganizeDoc[];
  selected: Set<string>;
  duplicates: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (doc: OrganizeDoc) => void;
}) {
  // Newest day first; within a day the list is already newest first.
  const groups = useMemo(() => {
    const byDay = new Map<string, OrganizeDoc[]>();
    for (const doc of docs) {
      const day = dayOf(doc.uploadedAt);
      byDay.set(day, [...(byDay.get(day) ?? []), doc]);
    }
    return [...byDay.entries()];
  }, [docs]);

  return (
    <div className="flex flex-col gap-5">
      {groups.map(([day, items]) => (
        <section key={day} aria-label={formatDate(day)}>
          <h2 className="sticky top-14 z-10 flex items-baseline gap-2 bg-background/95 py-2 text-sm font-semibold backdrop-blur">
            {formatDate(day)}
            <span className="text-xs font-normal text-muted-foreground">{items.length} {items.length === 1 ? "file" : "files"}</span>
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {items.map((doc) => {
              const isSelected = selected.has(doc.id);
              const isDuplicate = duplicates.has(doc.id);
              const unlinked = doc.linkCount === 0 && (doc.category === "receipts" || doc.category === "statements");
              return (
                <li key={doc.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onOpen(doc)}
                    aria-label={`Open ${doc.name}`}
                    className={cn("block w-full overflow-hidden rounded-xl border bg-white text-left transition-shadow hover:shadow-sm", isSelected && "ring-2 ring-primary/50")}
                  >
                    <span className="flex aspect-square w-full items-center justify-center bg-stone-100">
                      {isImageDoc(doc) ? (
                        <DocumentImage id={doc.id} alt={doc.name} preview className="size-full" imgClassName="size-full object-cover" />
                      ) : (
                        <FileText className="size-9 text-muted-foreground" aria-hidden="true" />
                      )}
                    </span>
                    <span className="block px-2 py-1.5">
                      <span className="block truncate text-xs font-medium">{doc.name}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-700">{DOC_CATEGORY_LABELS[doc.category as DocCategory] ?? doc.category}</span>
                        {isDuplicate && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900">Possible duplicate</span>}
                        {unlinked && <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700"><Link2Off className="size-2.5" aria-hidden="true" />Not linked</span>}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`Select ${doc.name}`}
                    onClick={() => onToggle(doc.id)}
                    className={cn(
                      "absolute left-2 top-2 flex size-8 items-center justify-center rounded-full border-2 border-white shadow transition-colors",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-white/85 text-transparent hover:text-muted-foreground",
                    )}
                  >
                    <Check className="size-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Actions for the files ticked in the grid. Each one applies to every selected file. */
export function BulkBar({
  count,
  busy,
  onCategory,
  onAddTag,
  onDelete,
  onClear,
}: {
  count: number;
  busy: boolean;
  onCategory: (category: DocCategory) => void;
  onAddTag: (tag: string) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div role="region" aria-label="Selected files" className="fixed inset-x-3 bottom-[5.25rem] z-40 flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 shadow-xl md:bottom-4 md:left-72 md:right-8">
      <span className="mr-auto text-sm font-semibold">{count} selected</span>
      <select
        aria-label="Move selected to category"
        className="min-h-11 rounded-lg border bg-white px-2 text-sm"
        disabled={busy}
        defaultValue=""
        onChange={(event) => {
          if (event.target.value) onCategory(event.target.value as DocCategory);
          event.target.value = "";
        }}
      >
        <option value="" disabled>Move to…</option>
        {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{DOC_CATEGORY_LABELS[c]}</option>)}
      </select>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem("tag") as HTMLInputElement;
          const tag = input.value.trim();
          if (tag) onAddTag(tag);
          input.value = "";
        }}
      >
        <input name="tag" aria-label="Tag to add" placeholder="Add tag" maxLength={40} disabled={busy} className="min-h-11 w-32 rounded-lg border px-2 text-sm" />
        <Button type="submit" variant="outline" className="min-h-11" disabled={busy}>Tag</Button>
      </form>
      <Button type="button" variant="destructive" className="min-h-11" onClick={onDelete} disabled={busy}>Delete</Button>
      <Button type="button" variant="ghost" className="min-h-11" onClick={onClear} disabled={busy}>Clear</Button>
    </div>
  );
}
