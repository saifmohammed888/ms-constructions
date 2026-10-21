import { NextRequest, NextResponse } from "next/server";
import { generateText, stepCountIs, tool } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const queryProjectData = tool({
  description:
    "Run a single read-only SQL query (SELECT / WITH) against the construction project database and return the rows. Use it for every project fact; never invent data.",
  inputSchema: z.object({
    queryString: z
      .string()
      .trim()
      .min(1)
      .describe("A single PostgreSQL SELECT or WITH statement. No DDL, DML, or multiple statements."),
  }),
  execute: async ({ queryString }) => {
    const statement = queryString.replace(/;+\s*$/, "").trim();
    if (!/^(select|with)\b/i.test(statement)) {
      return { error: "Only read-only SELECT / WITH queries are allowed." };
    }
    if (/;\s*\S/.test(statement)) {
      return { error: "Only a single statement is allowed." };
    }
    try {
      const db = await getDb();
      const result = await db.execute(sql.raw(`SELECT * FROM (${statement}) AS agent_result LIMIT 200`));
      return { rows: Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []), truncated: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Query failed" };
    }
  },
});

export async function POST(req: NextRequest) {
  try {
    if (!process.env.AI_GATEWAY_API_KEY) {
      return NextResponse.json({ error: "Agent is not configured. Add AI_GATEWAY_API_KEY." }, { status: 503 });
    }

    const body = (await req.json().catch(() => null)) as { question?: string; messages?: unknown } | null;
    const question = body?.question?.trim();
    const messages = Array.isArray(body?.messages)
      ? (body.messages as Parameters<typeof generateText>[0]["messages"])
      : null;

    if (!question && !messages) {
      return NextResponse.json({ error: "A question or messages are required." }, { status: 400 });
    }

    const result = await generateText({
      model: gateway("deepseek/deepseek-chat"),
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
