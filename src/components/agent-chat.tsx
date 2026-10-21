"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, MessageCircle, Minimize2, Send, X } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import { cn } from "@/lib/utils";

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

function LinkRenderer({ href, children }: { href?: string; children?: React.ReactNode }) {
  const external = Boolean(href && /^https?:\/\//i.test(href));
  return (
    <a
      href={href}
      className="underline underline-offset-2"
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
    >
      {children}
    </a>
  );
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h3 className="mt-3 mb-1.5 text-base font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 mb-1.5 text-base font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h3 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h3>,
  code: ({ children }) => (
    <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-black/80 p-3 text-xs text-white">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-current/20 px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-current/10 px-2 py-1">{children}</td>,
  a: LinkRenderer,
  hr: () => <hr className="my-2 border-current/20" />,
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-current/30 pl-3 italic">{children}</blockquote>
  ),
};

export function AgentChat() {
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open, isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isExpanded]);

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
    <div
      className={cn(
        "fixed z-50 flex flex-col items-end gap-3",
        isExpanded && open ? "inset-0" : "right-4 bottom-20 md:right-6 md:bottom-6",
      )}
    >
      {open && (
        <div
          className={cn(
            "flex flex-col overflow-hidden border bg-background shadow-xl",
            isExpanded
              ? "fixed inset-4 z-50 w-auto rounded-2xl md:inset-10"
              : "h-[min(32rem,calc(100dvh-9rem))] w-[min(22rem,calc(100vw-2rem))] rounded-2xl",
          )}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                AI
              </span>
              <h2 className="text-sm font-semibold">Project Agent</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                aria-label={isExpanded ? "Minimize chat" : "Expand chat"}
                aria-pressed={isExpanded}
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setIsExpanded(false);
                }}
                aria-label="Close chat"
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div
            ref={listRef}
            aria-live="polite"
            className={cn("flex-1 space-y-3 overflow-y-auto px-4 py-3", isExpanded && "mx-auto w-full max-w-3xl")}
          >
            {messages.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">
                Ask about projects, expenses, contacts, tasks, or documents.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {m.content}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "max-w-[92%] break-words rounded-xl px-3 py-2 text-sm",
                      m.isError ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground",
                    )}
                  >
                    <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-headings:mb-1.5 prose-headings:mt-3 prose-ul:my-1.5 prose-ol:my-1.5 prose-pre:my-2 prose-pre:rounded-lg prose-pre:bg-black/80 prose-code:rounded prose-code:bg-black/10 prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-table:my-2 prose-table:text-xs">
                      <ReactMarkdown components={markdownComponents}>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Thinking…
              </div>
            )}
          </div>

          <form
            onSubmit={submit}
            className={cn("flex items-center gap-2 border-t p-3", isExpanded && "mx-auto w-full max-w-3xl")}
          >
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

      {!isExpanded && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close project agent" : "Open project agent"}
          aria-expanded={open}
          className="inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:opacity-90"
        >
          {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
        </button>
      )}
    </div>
  );
}
