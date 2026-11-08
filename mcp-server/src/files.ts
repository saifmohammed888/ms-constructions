import crypto from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { google } from "googleapis";
import { pool, query } from "./db.js";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_CATEGORIES = ["legal", "drawings", "approvals", "receipts", "photos", "contracts", "bank", "identity", "misc"] as const;
export const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "image/avif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

type Category = (typeof DOCUMENT_CATEGORIES)[number];
type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];
type SaveInput = {
  name: string;
  mimeType: AllowedMime;
  category: Category;
  tags?: string[];
  expenseId?: string;
  workLogId?: string;
};

function encryptionKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is required for uploads");
  const key = Buffer.from(raw, raw.length === 64 ? "hex" : "utf8");
  if (key.length < 32) throw new Error("ENCRYPTION_KEY must be at least 32 bytes");
  return key.subarray(0, 32);
}

function decrypt(payload: string) {
  const [iv, tag, data] = payload.split(":");
  if (!iv || !tag || !data) throw new Error("Stored Google token is invalid");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(data, "hex")), decipher.final()]).toString("utf8");
}

function cleanName(value: string) {
  const name = value.trim().replace(/[\\/:*?"<>|\r\n]+/g, "-").slice(0, 180);
  if (!name || name === "." || name === "..") throw new Error("A valid filename is required");
  return name;
}

async function driveContext() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for uploads");
  const { rows } = await query<{ google_refresh_token: string | null; drive_folder_id: string | null }>("SELECT google_refresh_token, drive_folder_id FROM settings WHERE id=1");
  const settings = rows[0];
  if (!settings?.google_refresh_token || !settings.drive_folder_id) throw new Error("Google Drive is not connected in the app");
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: decrypt(settings.google_refresh_token) });
  return { drive: google.drive({ version: "v3", auth }), rootId: settings.drive_folder_id };
}

function folderLabel(category: Category) {
  return category[0].toUpperCase() + category.slice(1);
}

async function categoryFolder(drive: ReturnType<typeof google.drive>, rootId: string, category: Category) {
  const name = folderLabel(category);
  const escaped = name.replace(/'/g, "\\'");
  const found = await drive.files.list({ q: `'${rootId}' in parents and name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: "files(id)", pageSize: 1 });
  if (found.data.files?.[0]?.id) return found.data.files[0].id;
  const created = await drive.files.create({ requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [rootId] }, fields: "id" });
  if (!created.data.id) throw new Error("Could not create the Drive category folder");
  return created.data.id;
}

async function validateAttachment(expenseId?: string, workLogId?: string) {
  if (expenseId && workLogId) throw new Error("Attach the file to either one expense or one work log, not both");
  if (expenseId) {
    const found = await query("SELECT id FROM expenses WHERE id=$1", [expenseId]);
    if (!found.rows[0]) throw new Error("Expense not found");
  }
  if (workLogId) {
    const found = await query("SELECT id FROM site_updates WHERE id=$1", [workLogId]);
    if (!found.rows[0]) throw new Error("Work log not found");
  }
}

export function decodeBase64(value: string) {
  const compact = value.replace(/\s/g, "");
  if (!compact || compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) throw new Error("fileBase64 is not valid base64");
  if (compact.length > Math.ceil(MAX_FILE_BYTES / 3) * 4) throw new Error("File must be 10 MB or smaller");
  const buffer = Buffer.from(compact, "base64");
  if (!buffer.length) throw new Error("File is empty");
  if (buffer.length > MAX_FILE_BYTES) throw new Error("File must be 10 MB or smaller");
  return buffer;
}

export async function saveFile(buffer: Buffer, input: SaveInput) {
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw new Error("File must be between 1 byte and 10 MB");
  await validateAttachment(input.expenseId, input.workLogId);
  const name = cleanName(input.name);
  const { drive, rootId } = await driveContext();
  const parentId = await categoryFolder(drive, rootId, input.category);
  const uploaded = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType: input.mimeType, body: Readable.from(buffer) },
    fields: "id,name,mimeType,size,thumbnailLink,webViewLink",
  });
  if (!uploaded.data.id) throw new Error("Google Drive did not return a file id");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const project = await client.query("SELECT id FROM projects ORDER BY created_at LIMIT 1");
    const inserted = await client.query(
      `INSERT INTO documents (project_id,name,drive_file_id,thumbnail_url,web_view_link,mime_type,size_bytes,category,tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,project_id AS "projectId",name,drive_file_id AS "driveFileId",thumbnail_url AS "thumbnailUrl",web_view_link AS "webViewLink",mime_type AS "mimeType",size_bytes::float8 AS "sizeBytes",category,tags,uploaded_at AS "uploadedAt"`,
      [project.rows[0]?.id ?? null, uploaded.data.name || name, uploaded.data.id, uploaded.data.thumbnailLink ?? null, uploaded.data.webViewLink ?? null, uploaded.data.mimeType || input.mimeType, Number(uploaded.data.size || buffer.length), input.category, [...new Set(input.tags ?? [])]],
    );
    const document = inserted.rows[0];
    if (input.expenseId) {
      await client.query("INSERT INTO expense_documents (expense_id,document_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [input.expenseId, document.id]);
      await client.query("UPDATE expenses SET receipt_doc_id=COALESCE(receipt_doc_id,$1) WHERE id=$2", [document.id, input.expenseId]);
    }
    if (input.workLogId) await client.query("INSERT INTO site_update_documents (site_update_id,document_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [input.workLogId, document.id]);
    await client.query("COMMIT");
    return { ...document, attachedTo: input.expenseId ? { type: "expense", id: input.expenseId } : input.workLogId ? { type: "workLog", id: input.workLogId } : null };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function privateIp(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const value = address.toLowerCase();
  return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb") || value.startsWith("::ffff:127.") || value.startsWith("::ffff:10.") || value.startsWith("::ffff:192.168.");
}

export async function validateImportUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Only HTTPS file URLs are allowed");
  if (url.username || url.password || url.port) throw new Error("URL credentials and custom ports are not allowed");
  const allowed = (process.env.MCP_IMPORT_HOSTS || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) throw new Error("URL import is disabled until MCP_IMPORT_HOSTS is configured");
  const hostname = url.hostname.toLowerCase();
  if (!allowed.some((host) => hostname === host || hostname.endsWith(`.${host}`))) throw new Error("This URL hostname is not allow-listed");
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => privateIp(address))) throw new Error("Private or unresolved URL destinations are not allowed");
  return url;
}

export async function downloadFile(url: URL) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20_000), headers: { Accept: ALLOWED_MIME_TYPES.join(",") } });
  if (!response.ok) throw new Error(`File host returned HTTP ${response.status}`);
  const rawType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (!rawType || !ALLOWED_MIME_TYPES.includes(rawType as AllowedMime)) throw new Error("The URL did not return a supported file type");
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_FILE_BYTES) throw new Error("File must be 10 MB or smaller");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw new Error("File must be between 1 byte and 10 MB");
  return { buffer, mimeType: rawType as AllowedMime };
}
