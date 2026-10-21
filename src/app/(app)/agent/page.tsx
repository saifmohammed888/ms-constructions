"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, MessageSquare, Trash2 } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  createdAt?: string;
};

type PendingMessage = {
  id: string;
  content: string;
};

const STORAGE_KEY = "agent-chat-history";
const MAX_STORED_MESSAGES = 300;

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ChatMessage>;
  return (
    typeof record.id === "string" &&
    (record.role === "user" || record.role === "assistant") &&
    typeof record.content === "string"
  );
}

// Prefer the server copy (ids + timestamps) but keep any local-only messages,
// such as a thread saved before the server table existed or an offline session.
function mergeHistory(local: ChatMessage[], server: ChatMessage[]): ChatMessage[] {
  if (server.length === 0) return local;
  if (local.length === 0) return server;

  const serverContents = new Set(
    server.map((m) => `${m.role}:${normalizeContent(m.content)}`),
  );
  const localOnly = local.filter((m) => !serverContents.has(`${m.role}:${normalizeContent(m.content)}`));

  return [...localOnly, ...server].slice(-MAX_STORED_MESSAGES);
}

function normalizeContent(content: string) {
  return content.replace(/\s+/g, " ").trim();
}

function isStorageReady() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function loadStoredHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isChatMessage).slice(-MAX_STORED_MESSAGES);
  } catch {
    // Corrupt or unavailable storage — start with an empty thread.
    return [];
  }
}

function saveStoredHistory(messages: ChatMessage[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  } catch {
    // Quota exceeded or storage disabled — the page still works.
  }
}

function clearStoredHistory() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h3 className="mt-3 mb-1 text-base font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 mb-1 text-base font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h3 className="mt-3 mb-1 text-sm font-semibold first:mt-0">{children}</h3>,
  code: ({ children }) => (
    <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-zinc-800 p-3 text-xs text-zinc-50">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-current/20 px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-current/10 px-2 py-1">{children}</td>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="underline underline-offset-2"
      {...(href && /^https?:\/\//i.test(href) ? { target: "_blank", rel: "noreferrer noopener" } : {})}
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-2 border-current/20" />,
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-current/30 pl-3 italic">{children}</blockquote>
  ),
};

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStoredHistory());
  const [pending, setPending] = useState<PendingMessage | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  // Persist the thread whenever it changes.
  useEffect(() => {
    if (!isStorageReady()) return;
    saveStoredHistory(messages);
  }, [messages]);

  // Reconcile with the server copy on mount. localStorage paints instantly from
  // the useState initialiser above; this only upgrades it to DB-backed rows.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/agent", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          // Server history unavailable; whatever came from localStorage stays.
          return;
        }
        const serverMessages = Array.isArray(data?.messages) ? data.messages.filter(isChatMessage) : [];
        setMessages((local) => mergeHistory(local, serverMessages));
      } catch {
        if (!cancelled) setError("Could not load chat history");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, pending, scrollToBottom]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [input]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    // Optimistic: show the message immediately.
    const optimistic: PendingMessage = { id: `pending-${crypto.randomUUID()}`, content: question };
    setPending(optimistic);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json().catch(() => null);

      // Replace the optimistic bubble with the persisted user row (if present).
      if (data?.userMessage) {
        setMessages((prev) => [...prev, data.userMessage as ChatMessage]);
      } else {
        setMessages((prev) => [...prev, { id: optimistic.id, role: "user", content: question }]);
      }
      setPending(null);

      if (data?.message) {
        setMessages((prev) => [...prev, data.message as ChatMessage]);
      }
      if (!res.ok) setError(data?.error || "The agent could not answer. Try again.");
    } catch (err) {
      setMessages((prev) => [...prev, { id: optimistic.id, role: "user", content: question }]);
      setPending(null);
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function clearHistory() {
    if (clearing || messages.length === 0) return;
    setClearing(true);
    setError("");

    // Local history is cleared straight away; the server copy is best-effort so
    // the button still works offline.
    setMessages([]);
    setPending(null);
    clearStoredHistory();

    try {
      const res = await fetch("/api/agent", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Cleared here, but the server copy could not be removed.");
      }
    } catch {
      setError("Cleared here, but the server copy could not be removed.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col overflow-hidden rounded-2xl border bg-[#efeae2] md:h-[calc(100dvh-7rem)]">
      <header className="flex items-center justify-between gap-3 border-b bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
            AI
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Project Agent</p>
            <p className="text-xs text-muted-foreground">
              {loading ? "typing…" : "Read-only project data · online"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearHistory}
          disabled={clearing || messages.length === 0}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-red-200 hover:bg-red-50 hover:text-destructive disabled:opacity-40 disabled:hover:border-zinc-200 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          aria-label="Clear chat"
          title="Clear chat"
        >
          {clearing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          <span className="hidden sm:inline">Clear Chat</span>
        </button>
      </header>

      <div
        ref={scrollRef}
        aria-live="polite"
        className="flex-1 space-y-2 overflow-y-auto px-3 py-4 md:px-6"
      >
        {messages.length === 0 && !pending && !loading && (
          <div className="mx-auto mt-6 max-w-sm rounded-xl bg-white/80 px-4 py-3 text-center text-sm text-muted-foreground shadow-sm">
            <MessageSquare className="mx-auto mb-2 size-5" />
            Ask about expenses, tasks, contacts, documents, or site updates.
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm md:max-w-[70%]",
                m.role === "user"
                  ? "rounded-tr-none bg-[#d9fdd3] text-zinc-900"
                  : m.isError
                    ? "rounded-tl-none bg-red-50 text-red-700"
                    : "rounded-tl-none bg-white text-zinc-900",
              )}
            >
              {m.role === "assistant" && !m.isError ? (
                <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:mb-1 prose-headings:mt-3 prose-ul:my-1 prose-ol:my-1 prose-pre:my-2 prose-code:before:content-none prose-code:after:content-none">
                  <ReactMarkdown components={markdownComponents}>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
              )}
              {m.createdAt && (
                <p className="mt-1 text-right text-[10px] text-zinc-500">{formatTime(m.createdAt)}</p>
              )}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-sm text-zinc-900 shadow-sm md:max-w-[70%]">
              <p className="whitespace-pre-wrap break-words">{pending.content}</p>
              <p className="mt-1 text-right text-[10px] text-zinc-500">sending…</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-lg rounded-tl-none bg-white px-3 py-2.5 shadow-sm">
              <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-zinc-400" />
              <span className="ml-1 text-xs text-muted-foreground">Thinking…</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</div>
      )}

      <form onSubmit={send} className="flex items-end gap-2 border-t bg-white px-3 py-2.5 md:px-4">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(e);
            }
          }}
          rows={1}
          maxLength={500}
          disabled={loading}
          placeholder="Type a message…"
          aria-label="Message the project agent"
          className="max-h-36 min-h-10 flex-1 resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send message"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-40"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-5" />}
        </button>
      </form>
    </div>
  );
}
