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
    projectId: uuid("project_id"),
    name: text("name").notNull(),
    company: text("company"),
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
    projectId: uuid("project_id"),
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
    projectId: uuid("project_id"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    category: text("category").notNull(),
    date: date("date").notNull().default(sql`current_date`),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    paymentMode: text("payment_mode"),
    paymentStatus: text("payment_status").notNull().default("paid"),
    dueDate: date("due_date"),
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

export const expenseDocuments = pgTable(
  "expense_documents",
  {
    expenseId: uuid("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("expense_documents_pair_idx").on(t.expenseId, t.documentId)],
);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id"),
  title: text("title").notNull(),
  groupType: text("group_type").notNull().default("week"),
  goalLabel: text("goal_label"),
  dueDate: date("due_date"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("normal"),
  assigneeId: uuid("assignee_id"),
  gcalEventId: text("gcal_event_id"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  calendarSyncError: text("calendar_sync_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  stage: text("stage").notNull().default("Planning & coordination"),
  location: text("location"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteUpdates = pgTable("site_updates", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  date: date("date").notNull().default(sql`current_date`),
  workCompleted: text("work_completed").notNull(),
  workInProgress: text("work_in_progress"),
  workPlanned: text("work_planned"),
  workerCount: integer("worker_count"),
  materialsReceived: text("materials_received"),
  blockers: text("blockers"),
  floorArea: text("floor_area"),
  status: text("status").notNull().default("normal"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteUpdateDocuments = pgTable(
  "site_update_documents",
  {
    siteUpdateId: uuid("site_update_id").notNull().references(() => siteUpdates.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("site_update_documents_pair_idx").on(t.siteUpdateId, t.documentId)],
);

export const materials = pgTable("materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  material: text("material").notNull(),
  requiredQuantity: numeric("required_quantity", { precision: 12, scale: 2 }),
  receivedQuantity: numeric("received_quantity", { precision: 12, scale: 2 }),
  unit: text("unit"),
  supplierId: uuid("supplier_id"),
  rate: numeric("rate", { precision: 12, scale: 2 }),
  total: numeric("total", { precision: 12, scale: 2 }),
  deliveryDate: date("delivery_date"),
  storageLocation: text("storage_location"),
  floorArea: text("floor_area"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const snags = pgTable("snags", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  issue: text("issue").notNull(),
  location: text("location"),
  responsibleId: uuid("responsible_id"),
  priority: text("priority").notNull().default("normal"),
  dueDate: date("due_date"),
  status: text("status").notNull().default("open"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const decisions = pgTable("decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  date: date("date").notNull().default(sql`current_date`),
  responsibleId: uuid("responsible_id"),
  status: text("status").notNull().default("open"),
  costImpact: numeric("cost_impact", { precision: 12, scale: 2 }),
  designImpact: text("design_impact"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  approvalType: text("approval_type").notNull(),
  authority: text("authority"),
  applicationNumber: text("application_number"),
  submissionDate: date("submission_date"),
  approvalDate: date("approval_date"),
  expiryDate: date("expiry_date"),
  status: text("status").notNull().default("not_checked"),
  requiredDocuments: text("required_documents").array().notNull().default(sql`'{}'`),
  nocStatus: text("noc_status"),
  notes: text("notes"),
});

export const drawingRevisions = pgTable("drawing_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  drawingType: text("drawing_type").notNull(),
  floorArea: text("floor_area"),
  revisionNumber: text("revision_number").notNull(),
  revisionDate: date("revision_date"),
  preparedBy: text("prepared_by"),
  status: text("status").notNull().default("draft"),
  documentId: uuid("document_id"),
  isCurrent: boolean("is_current").notNull().default(false),
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

export const projectTrackers = pgTable("project_trackers", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id"),
  tracker: text("tracker").notNull(),
  title: text("title").notNull(),
  data: jsonb("data").$type<Record<string, string | number | null>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schema = {
  projects,
  contacts,
  documents,
  expenses,
  tasks,
  settings,
  loginAttempts,
  siteUpdates,
  siteUpdateDocuments,
  materials,
  snags,
  decisions,
  approvals,
  drawingRevisions,
  projectTrackers,
};
