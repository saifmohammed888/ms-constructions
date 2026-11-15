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
  /** Same name and size as another file in the library. */
  isDuplicate: boolean;
};

const IMAGE_NAME = /\.(png|jpe?g|gif|webp|heic|heif|avif|bmp|tiff?)$/i;

export function isImageDoc(doc: Pick<OrganizeDoc, "name" | "mimeType">) {
  return (doc.mimeType ?? "").startsWith("image/") || IMAGE_NAME.test(doc.name);
}

/** India-time calendar day of an upload, used to group the grid. */
export function dayOf(iso: string) {
  return todayIso(new Date(iso));
}
