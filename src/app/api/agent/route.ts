import { NextRequest, NextResponse } from "next/server";
import { generateText, stepCountIs, tool } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { asc, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { agentMessages, projects } from "@/lib/schema";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });

const MAX_QUERY_LENGTH = 4000;
const DEFAULT_ROW_LIMIT = 100;
const MAX_ROW_LIMIT = 200;
const QUERY_TIMEOUT_MS = 10_000;
const HISTORY_LIMIT = 300;
const CONTEXT_MESSAGES = 12;

// Shown whenever the model finishes without producing any text (for example a
// `length` finish after only tool calls), so the chat never renders a blank
// assistant bubble.
const EMPTY_ANSWER_FALLBACK =
  "The agent couldn't produce an answer for that. Try rephrasing the question or asking about a specific expense, task, contact, or document.";

/** Trim AI output and fall back to a readable message when it is empty. */
function normalizeAnswer(input: unknown): string {
  if (typeof input !== "string") return EMPTY_ANSWER_FALLBACK;
  const text = input.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  return text.length > 0 ? text : EMPTY_ANSWER_FALLBACK;
}

// Statements that can mutate data or objects. Anything else (INSERT, UPDATE,
// DELETE, DDL, CALL, COPY, GRANT, ...) is also rejected because the statement
// must start with SELECT or WITH.
const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|merge|truncate|drop|alter|create|grant|revoke|comment|copy|vacuum|analyze|reindex|cluster|refresh|call|do|listen|notify|unlisten|lock|set|reset|discard|begin|commit|rollback|savepoint|release|prepare|execute|deallocate|import|security\s+label|into)\b/i;

// Functions that can touch the filesystem, network, sessions, or the catalog.
const FORBIDDEN_FUNCTIONS =
  /\b(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|pg_sleep|pg_sleep_for|pg_sleep_until|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_rotate_logfile|pg_switch_wal|pg_promote|pg_create_physical_replication_slot|pg_drop_replication_slot|pg_logical_emit_message|lo_import|lo_export|lo_create|lo_unlink|dblink|dblink_exec|query_to_xml|query_to_xmlschema|pg_get_userbyid|current_setting|set_config|txid_current|pg_trigger_depth|nextval|setval|set_config)\s*\(/i;

type SqlGuardResult = { ok: true; query: string } | { ok: false; error: string };

function stripSqlNoise(query: string) {
  // Remove line comments, block comments, and string/int literals so that
  // keyword checks only inspect executable SQL.
  return query
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n\r]*/g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/\$\$[\s\S]*?\$\$/g, "''")
    .replace(/\$([A-Za-z_][A-Za-z_0-9]*)?\$[\s\S]*?\$\1\$/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');
}

function guardReadOnlySql(raw: string): SqlGuardResult {
  const query = raw.trim().replace(/;+\s*$/, "").trim();

  if (!query) return { ok: false, error: "Query is empty." };
  if (query.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: `Query is too long (max ${MAX_QUERY_LENGTH} characters).` };
  }
  if (/;\s*\S/.test(query)) return { ok: false, error: "Only a single statement is allowed." };
  if (!/^(select|with)\b/i.test(stripSqlNoise(query).trim())) {
    return { ok: false, error: "Only read-only SELECT / WITH queries are allowed." };
  }

  const cleaned = stripSqlNoise(query);

  if (FORBIDDEN_KEYWORDS.test(cleaned)) {
    return { ok: false, error: "Query contains a statement that could modify data. Read-only SELECT only." };
  }
  if (FORBIDDEN_FUNCTIONS.test(cleaned)) {
    return { ok: false, error: "Query uses a function that is not allowed." };
  }

  return { ok: true, query };
}

// ---------------------------------------------------------------------------
// Write guard
//
// Delete is never allowed: not as a statement, and not as an FK action
// (`ON DELETE CASCADE` would let an innocent-looking INSERT wipe rows).
// Anything that is not explicitly INSERT/UPDATE/SELECT is refused, so the tool
// can add tasks or fix an expense but can never remove or reshape data.
// ---------------------------------------------------------------------------

const WRITE_FORBIDDEN = /\b(delete|drop|truncate|alter)\b/i;

// `ON DELETE CASCADE` is a cascading delete, so it is refused even inside a
// string literal or comment. Plain prose mentions of deleting ("mark the slab
// delete as done") cannot cascade anything, so only that phrase is checked in
// literals — everything else is checked on literal-free SQL.
const WRITE_FORBIDDEN_IN_LITERAL = /\bon\s+delete\b/i;

// Functions an UPDATE could use to delete or truncate rows indirectly.
const WRITE_FORBIDDEN_FUNCTIONS =
  /\b(pg_terminate_backend|pg_cancel_backend|pg_sleep|pg_sleep_for|pg_sleep_until|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|lo_unlink|dblink|dblink_exec|set_config|nextval|setval)\s*\(/i;

// Copy/bulk-load and session/transaction control have no place in a single
// agent statement.
const WRITE_FORBIDDEN_KEYWORDS =
  /\b(copy|grant|revoke|vacuum|cluster|reindex|refresh|begin|commit|rollback|savepoint|release|listen|notify|lock)\b/i;

// Tables the agent must never write to, whatever statement it uses.
const PROTECTED_TABLES = /\b(agent_messages|login_attempts|settings)\b/i;

// `WHERE` in a way that a statement could put in a string or comment is not
// one; stripSqlNoise already removed literals/comments when this is checked.
// `RETURNING ... WHERE` (old and new) counts, since that is a filter too.
const UPDATE_HAS_WHERE = /^\s*update\b[\s\S]*\bwhere\b/i;

function guardWriteSql(raw: string): SqlGuardResult {
  const query = raw.trim().replace(/;\s*$/, "").trim();

  if (!query) return { ok: false, error: "Query is empty." };
  if (query.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: `Query is too long (max ${MAX_QUERY_LENGTH} characters).` };
  }
  if (/;\s*\S/.test(query)) return { ok: false, error: "Only a single statement is allowed." };

  const cleaned = stripSqlNoise(query);

  if (WRITE_FORBIDDEN.test(cleaned)) {
    return { ok: false, error: "Deleting data is not allowed. DELETE, DROP, TRUNCATE and ALTER are blocked." };
  }
  // stripSqlNoise also blanks comments, so this pass looks for a delete hidden
  // in a comment such as `-- delete rows` without flagging normal sentence text.
  if (WRITE_FORBIDDEN_IN_LITERAL.test(query) || WRITE_FORBIDDEN.test(query.replace(/'(?:[^']|'')*'/g, "''"))) {
    return { ok: false, error: "Deleting data is not allowed." };
  }
  if (WRITE_FORBIDDEN_FUNCTIONS.test(cleaned)) {
    return { ok: false, error: "Query uses a function that is not allowed." };
  }
  if (WRITE_FORBIDDEN_KEYWORDS.test(cleaned)) {
    return { ok: false, error: "Query contains a statement that is not allowed." };
  }
  if (PROTECTED_TABLES.test(cleaned)) {
    return { ok: false, error: "Agent history, settings, and login data are not writable." };
  }

  const statement = cleaned.trim();
  const isSelect = /^select\b/i.test(statement);
  const isInsert = /^insert\s+into\b/i.test(statement);
  const isUpdate = /^update\b/i.test(statement);

  if (!isSelect && !isInsert && !isUpdate) {
    return {
      ok: false,
      error: "Only SELECT, INSERT INTO, and UPDATE statements are allowed.",
    };
  }
  if (isUpdate && !UPDATE_HAS_WHERE.test(statement)) {
    return { ok: false, error: "An UPDATE must include a WHERE clause." };
  }

  return { ok: true, query };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const queryProjectData = tool({
  description:
    "Run a single read-only SELECT / WITH SQL query against the construction project database and return at most 200 rows. Use it for every project fact; never invent data.",
  inputSchema: z.object({
    queryString: z
      .string()
      .trim()
      .min(1)
      .max(MAX_QUERY_LENGTH)
      .describe(
        "A single PostgreSQL SELECT or WITH statement. Joins and aggregates are allowed. No DDL, DML, multiple statements, or functions such as pg_read_file.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_ROW_LIMIT)
      .optional()
      .describe(`Maximum rows to return (default ${DEFAULT_ROW_LIMIT}, max ${MAX_ROW_LIMIT}).`),
  }),
  execute: async ({ queryString, limit }) => {
    const guarded = guardReadOnlySql(queryString);
    if (!guarded.ok) return { error: guarded.error };

    const rowLimit = Math.min(limit ?? DEFAULT_ROW_LIMIT, MAX_ROW_LIMIT);

    try {
      const db = await getDb();
      // Wrapping in a subquery means even a statement that slipped past the
      // keyword checks cannot return more than `rowLimit` rows.
      const result = await withTimeout(
        db.execute(sql.raw(`SELECT * FROM (${guarded.query}) AS agent_result LIMIT ${rowLimit}`)),
        QUERY_TIMEOUT_MS,
      );
      return {
        rows: Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []),
        limit: rowLimit,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Query failed" };
    }
  },
});

const executeWriteQuery = tool({
  description:
    "Run a single INSERT or UPDATE statement (with a WHERE clause) to change project records, e.g. add a task or correct an expense. Deleting is never allowed. Returns the number of affected rows.",
  inputSchema: z.object({
    queryString: z
      .string()
      .trim()
      .min(1)
      .max(MAX_QUERY_LENGTH)
      .describe(
        "One PostgreSQL INSERT INTO or UPDATE ... WHERE statement, ending with `RETURNING id` so the changed row can be reported back. DELETE, DROP, TRUNCATE, ALTER, and multiple statements are rejected.",
      ),
  }),
  execute: async ({ queryString }) => {
    let guarded: SqlGuardResult;
    try {
      guarded = guardWriteSql(queryString);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Query rejected" };
    }
    if (!guarded.ok) return { success: false, error: guarded.error };

    try {
      const db = await getDb();
      const result = await withTimeout(db.execute(sql.raw(guarded.query)), QUERY_TIMEOUT_MS);
      const rows = Array.isArray(result) ? result : [];
      const rowCount = rows.length > 0 ? rows.length : ((result as { rowCount?: number }).rowCount ?? 0);

      return {
        success: true,
        message: rowCount === 1 ? "Record updated" : `${rowCount} records updated`,
        rowCount,
        rows: rows.slice(0, 20),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Write query failed",
      };
    }
  },
});

async function defaultProjectId() {
  const db = await getDb();
  const [project] = await db.select({ id: projects.id }).from(projects).limit(1);
  return project?.id ?? null;
}

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(agentMessages)
      .orderBy(asc(agentMessages.createdAt))
      .limit(HISTORY_LIMIT);

    return NextResponse.json({
      messages: rows.map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        isError: row.isError,
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    console.error("Agent history failed", error);
    return NextResponse.json({ error: "Could not load chat history" }, { status: 500 });
  }
}

export async function DELETE() {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    await db.delete(agentMessages);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Agent history clear failed", error);
    return NextResponse.json({ error: "Could not clear chat history" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { question?: unknown; messages?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!question) {
    return NextResponse.json({ error: "A question is required." }, { status: 400 });
  }
  if (question.length > 500) {
    return NextResponse.json({ error: "Ask a shorter question (max 500 characters)." }, { status: 400 });
  }

  const db = await getDb();
  const projectId = await defaultProjectId();

  // Persist the user's message first so it survives a provider failure.
  const [userRow] = await db
    .insert(agentMessages)
    .values({ projectId, role: "user", content: question })
    .returning();

  try {
    const history = await db
      .select({ role: agentMessages.role, content: agentMessages.content })
      .from(agentMessages)
      .orderBy(asc(agentMessages.createdAt))
      .limit(HISTORY_LIMIT);

    const context = history
      .slice(-CONTEXT_MESSAGES)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const result = await generateText({
      model: deepseek("deepseek-chat"),
      system:
        "You have read access via query_project_data and write access via execute_write_query. " +
        "You can add tasks, update expenses, or modify records. NEVER attempt to delete data. " +
        "When a user asks you to make a change, use the write tool and then confirm to the user what you did. " +
        "Answer in 2-6 short sentences or bullets. Query the database with query_project_data for every " +
        "factual claim, and look up the real row ids before writing. UPDATE statements must include a " +
        "WHERE clause, and never write to agent_messages, settings, or login_attempts. " +
        "If data is missing or a query fails, say so plainly instead of guessing.",
      messages: context.length > 0 ? context : [{ role: "user", content: question }],
      tools: {
        query_project_data: queryProjectData,
        execute_write_query: executeWriteQuery,
      },
      stopWhen: stepCountIs(5),
      temperature: 0.1,
      // Tool calls and the final answer share this budget; too small a value
      // can end the run before any text is written.
      maxOutputTokens: 1500,
    });

    // Never persist or return a blank assistant message. Empty/whitespace-only
    // output becomes a visible, non-error fallback so the UI always has content.
    const answer = normalizeAnswer(result.text);
    const hadText = answer !== EMPTY_ANSWER_FALLBACK;

    const [assistantRow] = await db
      .insert(agentMessages)
      .values({ projectId, role: "assistant", content: answer, isError: false })
      .returning();

    return NextResponse.json({
      userMessage: {
        id: userRow.id,
        role: userRow.role,
        content: userRow.content,
        isError: userRow.isError,
        createdAt: userRow.createdAt,
      },
      message: {
        id: assistantRow.id,
        role: assistantRow.role,
        content: answer,
        isError: assistantRow.isError,
        createdAt: assistantRow.createdAt,
      },
      answer,
      empty: !hadText,
    });
  } catch (error) {
    console.error("Agent request failed", error);
    const rawDetail =
      error instanceof Error
        ? error.message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").trim().slice(0, 240)
        : "";
    const detail = rawDetail || "Unknown provider error";

    const [errorRow] = await db
      .insert(agentMessages)
      .values({ projectId, role: "assistant", content: `Agent request failed: ${detail}`, isError: true })
      .returning()
      .catch(() => []);

    return NextResponse.json(
      {
        error: `Agent request failed: ${detail}`,
        userMessage: {
          id: userRow.id,
          role: userRow.role,
          content: userRow.content,
          isError: userRow.isError,
          createdAt: userRow.createdAt,
        },
        message: errorRow
          ? {
              id: errorRow.id,
              role: errorRow.role,
              content: errorRow.content,
              isError: errorRow.isError,
              createdAt: errorRow.createdAt,
            }
          : null,
      },
      { status: 502 },
    );
  }
}
