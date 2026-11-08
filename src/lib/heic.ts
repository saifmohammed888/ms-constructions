import convert from "heic-convert";

/** Browsers other than iOS Safari cannot display HEIC/HEIF photos from phones. */
export const HEIC_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

/** Re-encode a HEIC/HEIF photo as JPEG so any browser can show it. */
export async function heicToJpeg(input: Buffer): Promise<Buffer> {
  const out = await convert({ buffer: input, format: "JPEG", quality: 0.88 });
  return Buffer.from(out);
}
