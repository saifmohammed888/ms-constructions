"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
};

function readAnswer(data: unknown): { content: string; isError: boolean } {
  if (data && typeof data === "object") {
    const record = data as { answer?: unknown; error?: unknown };
    if (typeof record.answer === "string" && record.answer.trim()) {
      return { content: record.answer.trim(), isError: false };
    }
    if (typeof record.error === "string" && record.error.trim()) {
      return { content: record.error.trim(), isError: true };
    }
  }
  return { content: typeof data === "string" ? data : "No answer returned.", isError: true };
}

export function AgentChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data: unknown = await res.json().catch(() => null);
      const { content, isError } = readAnswer(data);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content, isError }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: error instanceof Error ? error.message : "Request failed",
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed right-4 bottom-20 z-50 flex flex-col items-end gap-3 md:right-6 md:bottom-6">
      {open && (
        <div className="flex h-[min(32rem,calc(100dvh-9rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                AI
              </span>
              <h2 className="text-sm font-semibold">Project Agent</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div ref={listRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">
                Ask about projects, expenses, contacts, tasks, or documents.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : m.isError
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Thinking…
              </div>
            )}
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              aria-label="Question for the project agent"
              disabled={loading}
              className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close project agent" : "Open project agent"}
        aria-expanded={open}
        className="inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:opacity-90"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </div>
  );
}
