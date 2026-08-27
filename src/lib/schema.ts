import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  date,
  integer,
  bigint,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    phone: text("phone"),
    altPhone: text("alt_phone"),
    email: text("email"),
    notes: text("notes"),
    tags: text("tags").array().notNull().default(sql`'{}'`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contacts_role_idx").on(t.role)],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    driveFileId: text("drive_file_id").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    webViewLink: text("web_view_link"),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    category: text("category").notNull().default("misc"),
    tags: text("tags").array().notNull().default(sql`'{}'`),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("documents_drive_file_id_idx").on(t.driveFileId),
    index("documents_category_idx").on(t.category),
    index("documents_uploaded_at_idx").on(t.uploadedAt),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    category: text("category").notNull(),
    date: date("date").notNull().default(sql`current_date`),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    paymentMode: text("payment_mode"),
    notes: text("notes"),
    receiptDocId: uuid("receipt_doc_id").references(() => documents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("expenses_date_idx").on(t.date),
    index("expenses_category_idx").on(t.category),
    index("expenses_contact_idx").on(t.contactId),
  ],
);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  groupType: text("group_type").notNull().default("week"),
  goalLabel: text("goal_label"),
  dueDate: date("due_date"),
  status: text("status").notNull().default("todo"),
  gcalEventId: text("gcal_event_id"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  calendarSyncError: text("calendar_sync_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  projectName: text("project_name").notNull().default("My Construction"),
  budgetTotal: numeric("budget_total", { precision: 14, scale: 2 }),
  budgetByCategory: jsonb("budget_by_category").$type<Record<string, number>>().notNull().default({}),
  driveFolderId: text("drive_folder_id"),
  googleRefreshToken: text("google_refresh_token"),
  gcalConnected: boolean("gcal_connected").notNull().default(false),
  lastBackupAt: timestamp("last_backup_at", { withTimezone: true }),
  passwordHash: text("password_hash"),
  setupComplete: boolean("setup_complete").notNull().default(false),
});

export const loginAttempts = pgTable("login_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  ip: text("ip").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schema = {
  contacts,
  documents,
  expenses,
  tasks,
  settings,
  loginAttempts,
};
