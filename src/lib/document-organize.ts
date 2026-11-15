import { todayIso } from "@/lib/format";

export type OrganizeDoc = {
  id: string;
  name: string;
  category: string;
  tags: string[];
  sizeBytes: number | null;
  uploadedAt: string;
  mimeType: string | null;
  linkCount: number;
  hasPreview: boolean;
};

const IMAGE_NAME = /\.(png|jpe?g|gif|webp|heic|heif|avif|bmp|tiff?)$/i;

export function isImageDoc(doc: Pick<OrganizeDoc, "name" | "mimeType">) {
  return (doc.mimeType ?? "").startsWith("image/") || IMAGE_NAME.test(doc.name);
}

/** Same name and size as another file: usually the same photo uploaded twice. */
export function duplicateIds(docs: OrganizeDoc[]) {
  const counts = new Map<string, number>();
  const keyOf = (doc: OrganizeDoc) => `${doc.name.trim().toLowerCase()}|${doc.sizeBytes ?? ""}`;
  for (const doc of docs) counts.set(keyOf(doc), (counts.get(keyOf(doc)) ?? 0) + 1);
  return new Set(docs.filter((doc) => (counts.get(keyOf(doc)) ?? 0) > 1).map((doc) => doc.id));
}

/** The stage or topic in a library name: 2026-11-04_1147_Material_Steel.jpg gives "Material". */
export function stageOf(name: string) {
  const match = /^\d{4}-\d{2}-\d{2}_\d{4}_([A-Za-z][A-Za-z-]*)_/.exec(name);
  return match ? match[1] : null;
}

export function stageCounts(docs: OrganizeDoc[]) {
  const counts = new Map<string, number>();
  for (const doc of docs) {
    const stage = stageOf(doc.name);
    if (stage) counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([stage, count]) => ({ stage, count }));
}

/** India-time calendar day of an upload, used to group the grid. */
export function dayOf(iso: string) {
  return todayIso(new Date(iso));
}

export type OrganizeFilter = { kind: "all" | "unlinked" | "untagged" | "duplicates" | "stage"; stage?: string };

export function applyOrganizeFilter<T extends OrganizeDoc>(docs: T[], filter: OrganizeFilter, duplicates: Set<string>): T[] {
  switch (filter.kind) {
    case "unlinked":
      return docs.filter((doc) => doc.linkCount === 0);
    case "untagged":
      return docs.filter((doc) => doc.tags.length === 0);
    case "duplicates":
      return docs.filter((doc) => duplicates.has(doc.id));
    case "stage":
      return docs.filter((doc) => stageOf(doc.name) === filter.stage);
    default:
      return docs;
  }
}
