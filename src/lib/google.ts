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

function oauthClient() {
  if (!googleConfigured()) throw new Error("Google OAuth is not configured");
  const redirect = `${process.env.APP_URL ?? "http://127.0.0.1:43123"}/api/auth/google/callback`;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirect,
  );
}

export function googleAuthUrl() {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [DRIVE_SCOPE, CAL_SCOPE],
  });
}

export async function exchangeCode(code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("No refresh token returned. Reconnect Google and approve access again.");
  }
  return tokens.refresh_token;
}

async function authedClient() {
  const row = await getSettingsRow();
  if (!row?.googleRefreshToken) return null;
  const client = oauthClient();
  client.setCredentials({ refresh_token: decrypt(row.googleRefreshToken) });
  return client;
}

export async function saveRefreshToken(refreshToken: string, projectName: string) {
  const db = await getDb();
  const folderId = await ensureDriveTree(refreshToken, projectName);
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
  const client = oauthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth: client });
}

async function findOrCreateFolder(drive: ReturnType<typeof google.drive>, name: string, parentId?: string) {
  const q = parentId
    ? `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const existing = await drive.files.list({
    q,
    fields: "files(id,name)",
    spaces: "drive",
  });
  const hit = existing.data.files?.[0];
  if (hit?.id) return hit.id;
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  return created.data.id!;
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
