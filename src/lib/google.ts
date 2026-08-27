import { google } from "googleapis";
import { decrypt, encrypt } from "@/lib/crypto";
import { getDb, getSettingsRow } from "@/lib/db";
import { settings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { DOC_CATEGORIES, type DocCategory } from "@/lib/constants";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const CAL_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function appBaseUrl(req?: { url: string }) {
  const env = process.env.APP_URL?.trim().replace(/\/$/, "") ?? "";
  const isLocal = !env || /localhost|127\.0\.0\.1/.test(env);
  if (env && !isLocal) return env;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  if (req) return new URL(req.url).origin;
  return env || "http://127.0.0.1:43123";
}

function oauthClient(baseUrl: string) {
  if (!googleConfigured()) throw new Error("Google OAuth is not configured");
  const redirect = `${baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirect,
  );
}

export function googleAuthUrl(baseUrl: string) {
  const client = oauthClient(baseUrl);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [DRIVE_SCOPE, CAL_SCOPE],
  });
}

export async function exchangeCode(code: string, baseUrl: string) {
  const client = oauthClient(baseUrl);
  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error("Google did not return a refresh token. Remove the app from https://myaccount.google.com/permissions then Connect Google again.");
    }
    return tokens.refresh_token;
  } catch (err) {
    throw new Error(googleErr(err));
  }
}

async function authedClient() {
  const row = await getSettingsRow();
  if (!row?.googleRefreshToken) return null;
  const client = oauthClient(appBaseUrl());
  client.setCredentials({ refresh_token: decrypt(row.googleRefreshToken) });
  return client;
}

function googleErr(err: unknown) {
  const e = err as {
    message?: string;
    response?: { data?: { error?: string | { message?: string; error_description?: string } } };
  };
  const data = e.response?.data?.error;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    return data.message || data.error_description || e.message || "Google API error";
  }
  return e.message || "Google connect failed";
}

export async function saveRefreshToken(refreshToken: string, projectName: string) {
  const db = await getDb();
  let folderId: string | null = null;
  try {
    folderId = await ensureDriveTree(refreshToken, projectName);
  } catch (err) {
    console.error("Drive folder setup failed", googleErr(err));
  }
  await db
    .update(settings)
    .set({
      googleRefreshToken: encrypt(refreshToken),
      gcalConnected: true,
      driveFolderId: folderId,
    })
    .where(eq(settings.id, 1));
}

async function driveFromRefresh(refreshToken: string) {
  const client = oauthClient(appBaseUrl());
  client.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth: client });
}

async function findOrCreateFolder(drive: ReturnType<typeof google.drive>, name: string, parentId?: string) {
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  if (!created.data.id) throw new Error(`Could not create Drive folder: ${name}`);
  return created.data.id;
}

export async function ensureDriveTree(refreshToken: string, projectName: string) {
  const drive = await driveFromRefresh(refreshToken);
  const root = await findOrCreateFolder(drive, `Construction – ${projectName}`);
  const cats = [...DOC_CATEGORIES.map((c) => labelFolder(c)), "Backups"];
  for (const name of cats) {
    await findOrCreateFolder(drive, name, root);
  }
  return root;
}

function labelFolder(cat: DocCategory) {
  const map: Record<DocCategory, string> = {
    legal: "Legal",
    drawings: "Drawings",
    approvals: "Approvals",
    receipts: "Receipts",
    photos: "Photos",
    contracts: "Contracts",
    misc: "Misc",
  };
  return map[cat];
}

export async function getDrive() {
  const auth = await authedClient();
  if (!auth) return null;
  return google.drive({ version: "v3", auth });
}

export async function downloadDriveFile(fileId: string) {
  const drive = await getDrive();
  if (!drive) throw new Error("Google Drive is not connected");
  const meta = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,size",
  });
  const media = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );
  const data = media.data as ArrayBuffer;
  return {
    buffer: Buffer.from(data),
    mimeType: meta.data.mimeType || "application/octet-stream",
    name: meta.data.name || "file",
  };
}

export async function getCalendar() {
  const auth = await authedClient();
  if (!auth) return null;
  return google.calendar({ version: "v3", auth });
}

export async function resolveCategoryFolder(category: DocCategory) {
  const row = await getSettingsRow();
  if (!row?.driveFolderId || !row.googleRefreshToken) throw new Error("Google Drive is not connected");
  const drive = await getDrive();
  if (!drive) throw new Error("Google Drive is not connected");
  return findOrCreateFolder(drive, labelFolder(category), row.driveFolderId);
}

export async function uploadDriveFile(opts: {
  name: string;
  mimeType: string;
  buffer: Buffer;
  category: DocCategory;
}) {
  const drive = await getDrive();
  if (!drive) throw new Error("Google Drive is not connected");
  const parent = await resolveCategoryFolder(opts.category);
  const resumable = opts.buffer.length > 5 * 1024 * 1024;
  const created = await drive.files.create({
    requestBody: { name: opts.name, parents: [parent] },
    media: { mimeType: opts.mimeType || "application/octet-stream", body: BufferReadable(opts.buffer) },
    fields: "id,name,mimeType,size,thumbnailLink,webViewLink,webContentLink",
  });
  void resumable;
  return created.data;
}

function BufferReadable(buf: Buffer) {
  const { Readable } = require("stream") as typeof import("stream");
  return Readable.from(buf);
}

export async function trashDriveFile(fileId: string) {
  const drive = await getDrive();
  if (!drive) return;
  try {
    await drive.files.update({ fileId, requestBody: { trashed: true } });
  } catch {
    /* ignore */
  }
}

export async function refreshThumbnail(fileId: string) {
  const drive = await getDrive();
  if (!drive) return null;
  const meta = await drive.files.get({
    fileId,
    fields: "id,thumbnailLink,webViewLink,webContentLink",
  });
  return meta.data;
}

export async function createCalendarEvent(title: string, dueDate: string, appUrl: string) {
  const cal = await getCalendar();
  if (!cal) throw new Error("Calendar not connected");
  const res = await withRetry(() =>
    cal.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `🏗 ${title}`,
        description: `From Construction Tracker\n${appUrl}`,
        start: { date: dueDate },
        end: { date: dueDate },
      },
    }),
  );
  return res.data.id!;
}

export async function patchCalendarEvent(eventId: string, title: string, dueDate: string) {
  const cal = await getCalendar();
  if (!cal) throw new Error("Calendar not connected");
  await withRetry(() =>
    cal.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: {
        summary: `🏗 ${title}`,
        start: { date: dueDate },
        end: { date: dueDate },
      },
    }),
  );
}

export async function deleteCalendarEvent(eventId: string) {
  const cal = await getCalendar();
  if (!cal) return;
  try {
    await withRetry(() => cal.events.delete({ calendarId: "primary", eventId }));
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 404 || code === 410) return;
    throw err;
  }
}

async function withRetry<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (err: unknown) {
    const code = (err as { code?: number }).code ?? 0;
    if (code >= 500) return await fn();
    throw err;
  }
}

export async function uploadBackupZip(filename: string, buffer: Buffer) {
  const row = await getSettingsRow();
  const drive = await getDrive();
  if (!drive || !row?.driveFolderId || !row.googleRefreshToken) {
    throw new Error("Google Drive is not connected");
  }
  const parent = await findOrCreateFolder(drive, "Backups", row.driveFolderId);
  await drive.files.create({
    requestBody: { name: filename, parents: [parent] },
    media: { mimeType: "application/zip", body: BufferReadable(buffer) },
    fields: "id",
  });
  const listed = await drive.files.list({
    q: `'${parent}' in parents and trashed=false`,
    orderBy: "createdTime desc",
    fields: "files(id,createdTime)",
  });
  const extras = (listed.data.files ?? []).slice(12);
  for (const f of extras) {
    if (f.id) await drive.files.delete({ fileId: f.id });
  }
}
