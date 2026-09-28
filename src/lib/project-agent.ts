import { tool } from "ai";
import { z } from "zod";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { getDb, getSettingsRow } from "@/lib/db";
import { contacts, documents, expenses, tasks } from "@/lib/schema";
import { todayIso } from "@/lib/format";

const emptyInput = z.object({});

export function projectTools() {
  return {
    projectSummary: tool({
      description: "Read the current project name, budget, spend, open tasks, and connected services.",
      inputSchema: emptyInput,
      execute: async () => {
        const db = await getDb();
        const settings = await getSettingsRow();
        const rows = await db.select({ amount: expenses.amount }).from(expenses);
        const openTasks = await db.select({ title: tasks.title, dueDate: tasks.dueDate, status: tasks.status }).from(tasks).where(eq(tasks.status, "todo")).limit(10);
        return {
          projectName: settings?.projectName ?? "My Construction",
          budget: settings?.budgetTotal ? Number(settings.budgetTotal) : null,
          spent: rows.reduce((sum, row) => sum + Number(row.amount), 0),
          openTasks,
          googleConnected: Boolean(settings?.googleRefreshToken),
        };
      },
    }),
    expenses: tool({
      description: "Read expense totals and recent expenses. Use for spend, budget, category, or cost questions.",
      inputSchema: z.object({ category: z.string().optional(), limit: z.number().int().min(1).max(20).optional() }),
      execute: async ({ category, limit = 10 }) => {
        const db = await getDb();
        const rows = await db.select().from(expenses).where(category ? eq(expenses.category, category) : undefined).orderBy(desc(expenses.date), desc(expenses.createdAt)).limit(limit);
        return { total: rows.reduce((sum, row) => sum + Number(row.amount), 0), items: rows };
      },
    }),
    payments: tool({
      description: "Read payment activity from expenses, including payment modes and payees.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(20).optional() }),
      execute: async ({ limit = 10 }) => {
        const db = await getDb();
        return db.select({ amount: expenses.amount, date: expenses.date, paymentMode: expenses.paymentMode, contactId: expenses.contactId, notes: expenses.notes }).from(expenses).orderBy(desc(expenses.date), desc(expenses.createdAt)).limit(limit);
      },
    }),
    tasks: tool({
      description: "Read pending, overdue, or upcoming work tasks.",
      inputSchema: z.object({ status: z.enum(["todo", "done", "all"]).optional() }),
      execute: async ({ status = "todo" }) => {
        const db = await getDb();
        const today = todayIso();
        const where = status === "all" ? undefined : eq(tasks.status, status);
        const rows = await db.select().from(tasks).where(where).orderBy(desc(tasks.dueDate)).limit(30);
        return { today, overdue: rows.filter((row) => row.status !== "done" && row.dueDate && row.dueDate < today), items: rows };
      },
    }),
    documents: tool({
      description: "Read document names and categories. Do not inspect document contents.",
      inputSchema: z.object({ category: z.string().optional(), search: z.string().optional() }),
      execute: async ({ category, search }) => {
        const db = await getDb();
        const filters = [];
        if (category) filters.push(eq(documents.category, category));
        if (search) filters.push(or(sql`${documents.name} ilike ${"%" + search + "%"}`, sql`cast(${documents.tags} as text) ilike ${"%" + search + "%"}`)!);
        return db.select({ name: documents.name, category: documents.category, uploadedAt: documents.uploadedAt }).from(documents).where(filters.length ? and(...filters) : undefined).orderBy(desc(documents.uploadedAt)).limit(30);
      },
    }),
    contacts: tool({
      description: "Read project contacts and vendors.",
      inputSchema: z.object({ search: z.string().optional(), role: z.string().optional() }),
      execute: async ({ search, role }) => {
        const db = await getDb();
        const filters = [];
        if (role) filters.push(eq(contacts.role, role));
        if (search) filters.push(or(sql`${contacts.name} ilike ${"%" + search + "%"}`, sql`${contacts.phone} ilike ${"%" + search + "%"}`)!);
        return db.select({ name: contacts.name, role: contacts.role, phone: contacts.phone, email: contacts.email, notes: contacts.notes }).from(contacts).where(filters.length ? and(...filters) : undefined).orderBy(desc(contacts.updatedAt)).limit(30);
      },
    }),
    materials: tool({
      description: "Explain that materials are not yet modeled as a separate data set; use expenses and tasks when relevant.",
      inputSchema: emptyInput,
      execute: async () => ({ available: false, message: "Materials are not stored as a separate table yet. Check expenses and tasks for material-related entries." }),
    }),
    milestones: tool({
      description: "Explain that milestones are not yet modeled separately; use tasks grouped by goals.",
      inputSchema: emptyInput,
      execute: async () => ({ available: false, message: "Milestones are not stored separately yet. Check goal-based tasks for project milestones." }),
    }),
  };
}
