import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { pool, query } from "./db.js";

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.MCP_API_KEY;
if (!API_KEY) throw new Error("MCP_API_KEY is required");

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const nullableText = z.string().max(2_000).nullable().optional();
const expenseCategories = z.enum(["land", "approvals", "foundation", "structure", "electrical", "plumbing", "finishing", "labour", "materials", "misc"]);

function result(data: unknown) {
  const structuredContent = Array.isArray(data) ? { items: data } : (data as Record<string, unknown>);
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

function createAppMcpServer() {
  const mcp = new McpServer({ name: "ms-constructions", version: "1.0.0" });

  mcp.registerTool("dashboard_read", {
    title: "Read construction dashboard",
    description: "Returns the project dashboard including budget, spending, task, payment, and work-log summaries.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => {
    try {
      const { rows } = await query(`
        WITH expense_stats AS (
          SELECT COALESCE(SUM(amount) FILTER (WHERE payment_status = 'paid'), 0)::float8 AS paid,
                 COALESCE(SUM(amount) FILTER (WHERE payment_status = 'due'), 0)::float8 AS due,
                 COUNT(*) FILTER (WHERE payment_status = 'due' AND due_date < CURRENT_DATE)::int AS overdue_payments
          FROM expenses
        ), task_stats AS (
          SELECT COUNT(*) FILTER (WHERE status <> 'done')::int AS open,
                 COUNT(*) FILTER (WHERE status <> 'done' AND due_date < CURRENT_DATE)::int AS overdue,
                 COUNT(*) FILTER (WHERE status = 'done' AND completed_at >= CURRENT_DATE - INTERVAL '7 days')::int AS completed_week
          FROM tasks
        )
        SELECT s.project_name AS "projectName", s.budget_total::float8 AS "budgetTotal",
               s.budget_by_category AS "budgetByCategory", e.*, t.*,
               COALESCE((SELECT json_agg(x ORDER BY x.date DESC) FROM (
                 SELECT id, amount::float8, category, date, payment_status AS "paymentStatus", notes
                 FROM expenses ORDER BY date DESC, created_at DESC LIMIT 5
               ) x), '[]') AS "recentExpenses",
               COALESCE((SELECT json_agg(x ORDER BY x."dueDate" NULLS LAST) FROM (
                 SELECT id, title, due_date AS "dueDate", status, priority
                 FROM tasks WHERE status <> 'done' ORDER BY due_date NULLS LAST, created_at DESC LIMIT 8
               ) x), '[]') AS "focusTasks",
               (SELECT row_to_json(x) FROM (
                 SELECT id, date, work_completed AS "workCompleted", work_planned AS "workPlanned", blockers, status
                 FROM site_updates ORDER BY date DESC, created_at DESC LIMIT 1
               ) x) AS "latestWorkLog",
               COALESCE((SELECT json_object_agg(category, total) FROM (
                 SELECT category, SUM(amount)::float8 total FROM expenses GROUP BY category
               ) c), '{}') AS "spendByCategory"
        FROM settings s CROSS JOIN expense_stats e CROSS JOIN task_stats t WHERE s.id = 1
      `);
      return result(rows[0] ?? {});
    } catch (error) { return failure(error); }
  });

  mcp.registerTool("tasks_read", {
    title: "Read tasks",
    description: "Lists tasks with optional status, due-date, priority, and result-limit filters.",
    inputSchema: z.object({
      id: uuid.optional(), status: z.enum(["todo", "done"]).optional(),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      dueBefore: isoDate.optional(), limit: z.number().int().min(1).max(200).default(100),
    }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ id, status, priority, dueBefore, limit }) => {
    try {
      const values: unknown[] = []; const where: string[] = [];
      for (const [column, value] of [["id", id], ["status", status], ["priority", priority]] as const) {
        if (value !== undefined) { values.push(value); where.push(`${column} = $${values.length}`); }
      }
      if (dueBefore) { values.push(dueBefore); where.push(`due_date <= $${values.length}`); }
      values.push(limit);
      const { rows } = await query(`SELECT id, project_id AS "projectId", title, group_type AS "groupType", goal_label AS "goalLabel", due_date AS "dueDate", status, priority, assignee_id AS "assigneeId", notes, sort_order AS "sortOrder", created_at AS "createdAt", completed_at AS "completedAt" FROM tasks ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT $${values.length}`, values);
      return result(rows);
    } catch (error) { return failure(error); }
  });

  const taskInput = z.object({
    title: z.string().min(1).max(200), groupType: z.enum(["week", "month", "goal"]).default("week"),
    goalLabel: z.string().max(80).nullable().optional(), dueDate: isoDate.nullable().optional(),
    status: z.enum(["todo", "done"]).default("todo"), priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    assigneeId: uuid.nullable().optional(), notes: nullableText, sortOrder: z.number().int().default(0),
  });
  mcp.registerTool("task_create", { title: "Create task", description: "Creates a construction task.", inputSchema: taskInput, annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false } }, async (input) => {
    try {
      const p = await defaultProjectId();
      const { rows } = await query(`INSERT INTO tasks (project_id,title,group_type,goal_label,due_date,status,priority,assignee_id,notes,sort_order,completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $6 = 'done' THEN NOW() ELSE NULL END) RETURNING *`, [p,input.title,input.groupType,input.goalLabel ?? null,input.dueDate ?? null,input.status,input.priority,input.assigneeId ?? null,input.notes ?? null,input.sortOrder]);
      return result(rows[0]);
    } catch (error) { return failure(error); }
  });

  mcp.registerTool("task_update", { title: "Update task", description: "Updates only the supplied fields on an existing task.", inputSchema: taskInput.partial().extend({ id: uuid }), annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false } }, async ({ id, ...patch }) => updateRow("tasks", id, patch, { groupType: "group_type", goalLabel: "goal_label", dueDate: "due_date", assigneeId: "assignee_id", sortOrder: "sort_order" }, true));

  mcp.registerTool("expenses_read", {
    title: "Read expenses", description: "Lists expenses with optional filters and includes the matching total.",
    inputSchema: z.object({ id: uuid.optional(), category: expenseCategories.optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional(), paymentStatus: z.enum(["paid", "due"]).optional(), limit: z.number().int().min(1).max(500).default(100) }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ id, category, month, paymentStatus, limit }) => {
    try {
      const values: unknown[] = []; const where: string[] = [];
      for (const [column, value] of [["e.id", id], ["e.category", category], ["e.payment_status", paymentStatus]] as const) if (value !== undefined) { values.push(value); where.push(`${column} = $${values.length}`); }
      if (month) { values.push(`${month}-01`, `${month}-01`); where.push(`e.date >= $${values.length - 1}::date AND e.date < $${values.length}::date + INTERVAL '1 month'`); }
      values.push(limit);
      const { rows } = await query(`SELECT e.id, e.project_id AS "projectId", e.amount::float8, e.category, e.date, e.contact_id AS "contactId", c.name AS "contactName", e.payment_mode AS "paymentMode", e.payment_status AS "paymentStatus", e.due_date AS "dueDate", e.notes, e.receipt_doc_id AS "receiptDocId", e.created_at AS "createdAt" FROM expenses e LEFT JOIN contacts c ON c.id=e.contact_id ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY e.date DESC,e.created_at DESC LIMIT $${values.length}`, values);
      return result({ items: rows, total: rows.reduce((sum, row) => sum + Number(row.amount), 0) });
    } catch (error) { return failure(error); }
  });

  const expenseInput = z.object({ amount: z.number().positive(), category: expenseCategories, date: isoDate, contactId: uuid.nullable().optional(), paymentMode: z.enum(["cash", "upi", "bank", "cheque"]).nullable().optional(), paymentStatus: z.enum(["paid", "due"]).default("paid"), dueDate: isoDate.nullable().optional(), notes: nullableText, receiptDocId: uuid.nullable().optional() });
  mcp.registerTool("expense_create", { title: "Create expense", description: "Creates a paid or due construction expense.", inputSchema: expenseInput, annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false } }, async (input) => {
    try {
      const p = await defaultProjectId();
      const { rows } = await query(`INSERT INTO expenses (project_id,amount,category,date,contact_id,payment_mode,payment_status,due_date,notes,receipt_doc_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [p,input.amount,input.category,input.date,input.contactId ?? null,input.paymentMode ?? null,input.paymentStatus,input.dueDate ?? null,input.notes ?? null,input.receiptDocId ?? null]);
      return result(rows[0]);
    } catch (error) { return failure(error); }
  });
  mcp.registerTool("expense_update", { title: "Update expense", description: "Updates only the supplied fields on an expense.", inputSchema: expenseInput.partial().extend({ id: uuid }), annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false } }, async ({ id, ...patch }) => updateRow("expenses", id, patch, { contactId: "contact_id", paymentMode: "payment_mode", paymentStatus: "payment_status", dueDate: "due_date", receiptDocId: "receipt_doc_id" }));

  mcp.registerTool("work_logs_read", {
    title: "Read work logs", description: "Lists daily site work logs, optionally filtered by id or date range.",
    inputSchema: z.object({ id: uuid.optional(), from: isoDate.optional(), to: isoDate.optional(), limit: z.number().int().min(1).max(365).default(100) }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ id, from, to, limit }) => {
    try {
      const values: unknown[] = []; const where: string[] = [];
      if (id) { values.push(id); where.push(`id=$${values.length}`); }
      if (from) { values.push(from); where.push(`date >= $${values.length}`); }
      if (to) { values.push(to); where.push(`date <= $${values.length}`); }
      values.push(limit);
      const { rows } = await query(`SELECT id,project_id AS "projectId",date,work_completed AS "workCompleted",work_in_progress AS "workInProgress",work_planned AS "workPlanned",worker_count AS "workerCount",materials_received AS "materialsReceived",blockers,floor_area AS "floorArea",status,notes,created_at AS "createdAt" FROM site_updates ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY date DESC,created_at DESC LIMIT $${values.length}`, values);
      return result(rows);
    } catch (error) { return failure(error); }
  });

  const logInput = z.object({ date: isoDate, workCompleted: z.string().min(1).max(10_000), workInProgress: nullableText, workPlanned: nullableText, workerCount: z.number().int().nonnegative().nullable().optional(), materialsReceived: nullableText, blockers: nullableText, floorArea: z.string().max(200).nullable().optional(), status: z.string().max(40).default("normal"), notes: nullableText });
  mcp.registerTool("work_log_create", { title: "Create work log", description: "Creates a daily work log; replaces an automatic placeholder for the same date.", inputSchema: logInput, annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false } }, async (input) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const p = await defaultProjectId(client);
      const existing = await client.query(`SELECT id FROM site_updates WHERE project_id=$1 AND date=$2 AND status='auto_generated' FOR UPDATE`, [p,input.date]);
      const values = [p,input.date,input.workCompleted,input.workInProgress ?? null,input.workPlanned ?? null,input.workerCount ?? null,input.materialsReceived ?? null,input.blockers ?? null,input.floorArea ?? null,input.status === "auto_generated" ? "normal" : input.status,input.notes ?? null];
      const saved = existing.rows[0]
        ? await client.query(`UPDATE site_updates SET project_id=$1,date=$2,work_completed=$3,work_in_progress=$4,work_planned=$5,worker_count=$6,materials_received=$7,blockers=$8,floor_area=$9,status=$10,notes=$11 WHERE id=$12 RETURNING *`, [...values,existing.rows[0].id])
        : await client.query(`INSERT INTO site_updates (project_id,date,work_completed,work_in_progress,work_planned,worker_count,materials_received,blockers,floor_area,status,notes) VALUES (${values.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`, values);
      await client.query("COMMIT");
      return result(saved.rows[0]);
    } catch (error) { await client.query("ROLLBACK"); return failure(error); } finally { client.release(); }
  });
  mcp.registerTool("work_log_update", { title: "Update work log", description: "Updates only the supplied fields on a daily work log.", inputSchema: logInput.partial().extend({ id: uuid }), annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false } }, async ({ id, ...patch }) => updateRow("site_updates", id, patch, { workCompleted: "work_completed", workInProgress: "work_in_progress", workPlanned: "work_planned", workerCount: "worker_count", materialsReceived: "materials_received", floorArea: "floor_area" }));

  return mcp;
}

async function defaultProjectId(client: { query: typeof pool.query } = pool) {
  const found = await client.query("SELECT id FROM projects ORDER BY created_at LIMIT 1");
  if (!found.rows[0]?.id) throw new Error("No project configured");
  return found.rows[0].id as string;
}

async function updateRow(table: "tasks" | "expenses" | "site_updates", id: string, patch: Record<string, unknown>, names: Record<string, string>, task = false) {
  try {
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
    if (!entries.length) throw new Error("Provide at least one field to update");
    const values = entries.map(([, value]) => value);
    const sets = entries.map(([key], index) => `${names[key] ?? key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)}=$${index + 1}`);
    if (task && "status" in patch) sets.push(`completed_at=${patch.status === "done" ? "COALESCE(completed_at,NOW())" : "NULL"}`);
    values.push(id);
    const { rows } = await query(`UPDATE ${table} SET ${sets.join(",")} WHERE id=$${values.length} RETURNING *`, values);
    if (!rows[0]) throw new Error("Not found");
    // Defense in depth: MCP mutations are strictly one-record operations.
    if (rows.length !== 1) throw new Error("Safety check failed: update affected more than one record");
    return result(rows[0]);
  } catch (error) { return failure(error); }
}

const mcpHandler = createMcpHandler(() => createAppMcpServer());

function authorized(req: IncomingMessage) {
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = Buffer.from(API_KEY!); const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function toWebRequest(req: IncomingMessage) {
  const origin = `http://${req.headers.host || "localhost"}`;
  const chunks: Buffer[] = [];
  if (req.method !== "GET" && req.method !== "HEAD") {
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(new URL(req.url || "/", origin), { method: req.method, headers: req.headers as HeadersInit, body });
}

async function sendWebResponse(response: Response, res: ServerResponse) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (!response.body) return res.end();
  const reader = response.body.getReader();
  while (true) { const { done, value } = await reader.read(); if (done) break; res.write(Buffer.from(value)); }
  res.end();
}

const http = createServer(async (req, res) => {
  try {
    if (req.url === "/health") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ ok: true })); }
    if (req.url?.split("?")[0] !== "/mcp") { res.writeHead(404); return res.end("Not found"); }
    if (!authorized(req)) { res.writeHead(401, { "content-type": "application/json", "www-authenticate": "Bearer" }); return res.end(JSON.stringify({ error: "Unauthorized" })); }
    await sendWebResponse(await mcpHandler.fetch(await toWebRequest(req)), res);
  } catch (error) {
    console.error(error); if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

http.listen(PORT, "0.0.0.0", () => console.log(`MS Constructions MCP listening on :${PORT}/mcp`));

async function shutdown() { await mcpHandler.close(); await pool.end(); http.close(); }
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
