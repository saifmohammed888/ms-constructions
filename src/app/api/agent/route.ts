import { NextRequest, NextResponse } from "next/server";
import { generateText, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { projectTools } from "@/lib/project-agent";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Project AI is not configured" }, { status: 503 });
  const body = await req.json().catch(() => null) as { question?: string } | null;
  const question = body?.question?.trim();
  if (!question || question.length > 500) return NextResponse.json({ error: "Ask a short project question" }, { status: 400 });

  const result = await generateText({
    model: openai(process.env.PROJECT_AI_MODEL || "gpt-4o-mini"),
    system: "You are Ask Project, a concise read-only construction assistant. Answer in 2-5 short sentences or bullets. Use tools for every project fact; never invent data. You may discuss only the project data returned by tools. You cannot modify data, upload files, inspect photos, or read document contents. If a data area is unavailable, say so plainly.",
    prompt: question,
    tools: projectTools(),
    stopWhen: stepCountIs(3),
    maxOutputTokens: 350,
    temperature: 0.1,
  });
  return NextResponse.json({ answer: result.text });
}
