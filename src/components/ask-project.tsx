"use client";

import { useState } from "react";
import { ArrowUp, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AskProject() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswer("");
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not answer");
      setAnswer(data.answer);
      setQuestion("");
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Could not answer right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-zinc-950 text-white"><Bot className="size-4" /></span><div><p className="text-sm font-semibold">Ask Project</p><p className="text-xs text-muted-foreground">Read-only answers from your project data</p></div></div>
      {answer && <p className="mb-3 whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-sm leading-6">{answer}</p>}
      <form className="flex gap-2" onSubmit={ask}><Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="How much have I spent?" maxLength={500} /><Button size="icon" type="submit" disabled={loading || !question.trim()} aria-label="Ask">{loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}</Button></form>
    </section>
  );
}
