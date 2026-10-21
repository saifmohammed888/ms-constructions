import { NextRequest, NextResponse } from "next/server";
import { generateText, stepCountIs, tool } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });

const MAX_QUERY_LENGTH = 4000;
const DEFAULT_ROW_LIMIT = 100;
const MAX_ROW_LIMIT = 200;
const QUERY_TIMEOUT_MS = 10_000;

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

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => null)) as { question?: string; messages?: unknown } | null;
    const question = body?.question?.trim();
    const messages = Array.isArray(body?.messages)
      ? (body.messages as Parameters<typeof generateText>[0]["messages"])
      : null;

    if (!question && !messages) {
      return NextResponse.json({ error: "A question or messages are required." }, { status: 400 });
    }
    if (question && question.length > 500) {
      return NextResponse.json({ error: "Ask a shorter question (max 500 characters)." }, { status: 400 });
    }

    const result = await generateText({
      model: deepseek("deepseek-chat"),
      system:
        "You are a read-only construction project assistant. Answer in 2-6 short sentences or bullets. " +
        "Query the database with the query_project_data tool for every factual claim. " +
        "The database is read-only: you cannot insert, update, or delete anything. " +
        "If data is missing or a query fails, say so plainly instead of guessing.",
      ...(messages ? { messages } : { prompt: question! }),
      tools: { query_project_data: queryProjectData },
      stopWhen: stepCountIs(5),
      temperature: 0.1,
      maxOutputTokens: 600,
    });

    return NextResponse.json({ answer: result.text });
  } catch (error) {
    console.error("Agent request failed", error);
    const detail =
      error instanceof Error
        ? error.message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 240)
        : "Unknown provider error";
    return NextResponse.json({ error: `Agent request failed: ${detail}` }, { status: 502 });
  }
}
