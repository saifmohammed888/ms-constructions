"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, MessageCircle, Minimize2, Send, Trash2, X } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
};

type ViewState = "small" | "half" | "full";

const STORAGE_KEY = "agent-chat-history";
const MAX_STORED_MESSAGES = 100;
const VIEW_ORDER: ViewState[] = ["small", "half", "full"];

const VIEW_CLASSES: Record<ViewState, string> = {
  small: "h-96 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-7rem)]",
  half: "h-[80vh] w-[500px] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)]",
  full: "inset-4 h-auto w-auto md:inset-10",
};

const VIEW_LABELS: Record<ViewState, string> = {
  small: "Expand chat to half screen",
  half: "Expand chat to full screen",
  full: "Minimize chat",
};

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<Message>;
  return (
    typeof record.id === "string" &&
    (record.role === "user" || record.role === "assistant") &&
    typeof record.content === "string"
  );
}

function loadHistory(): Message[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isMessage) : [];
  } catch {
    return [];
  }
}

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
  const [viewState, setViewState] = useState<ViewState>("small");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // localStorage only exists after mount, so hydrate in an effect instead of a
  // useState initialiser (which would also run during SSR).
  useEffect(() => {
    setMessages(loadHistory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
    } catch {
      // Quota exceeded or storage disabled — chat still works for this session.
    }
  }, [messages, hydrated]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open, viewState]);

  useEffect(() => {
    if (viewState !== "full") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewState("small");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewState]);

  function cycleView() {
    setViewState((current) => VIEW_ORDER[(VIEW_ORDER.indexOf(current) + 1) % VIEW_ORDER.length]);
  }

  function clearHistory() {
    setMessages([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

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

  const isFull = viewState === "full";

  return (
    <div className={cn("fixed z-50 flex flex-col items-end gap-3", isFull ? "inset-0" : "right-4 bottom-4")}>
      {open && (
        <div
          className={cn(
            "flex flex-col overflow-hidden rounded-2xl border bg-background shadow-xl",
            isFull ? "fixed" : "relative",
            VIEW_CLASSES[viewState],
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
                onClick={clearHistory}
                disabled={messages.length === 0}
                aria-label="Clear chat history"
                title="Clear chat history"
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              >
                <Trash2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={cycleView}
                aria-label={VIEW_LABELS[viewState]}
                title={VIEW_LABELS[viewState]}
                aria-pressed={isFull}
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {isFull ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setViewState("small");
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
            className={cn("flex-1 space-y-3 overflow-y-auto px-4 py-3", isFull && "mx-auto w-full max-w-3xl")}
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
            className={cn("flex items-center gap-2 border-t p-3", isFull && "mx-auto w-full max-w-3xl")}
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

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close project agent" : "Open project agent"}
        aria-expanded={open}
        className={cn(
          "inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:opacity-90",
          open && isFull && "absolute right-6 bottom-6",
        )}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </div>
  );
}
