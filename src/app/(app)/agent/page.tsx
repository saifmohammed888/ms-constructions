"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, MessageSquare, Trash2 } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";

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
const EMPTY_REPLY_FALLBACK = "No answer came back from the agent. Please try asking again.";

/** Trim AI output and never render/persist a blank bubble. */
function normalizeMessage<T extends ChatMessage>(message: T): T {
  const content = (message.content ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  return { ...message, content: content.length > 0 ? content : EMPTY_REPLY_FALLBACK };
}

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

/** Append rows, skipping ids already present (the history GET can race a send). */
function appendUnique(prev: ChatMessage[], next: ChatMessage[]): ChatMessage[] {
  const seen = new Set(prev.map((m) => m.id));
  return [...prev, ...next.filter((m) => !seen.has(m.id))].slice(-MAX_STORED_MESSAGES);
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
    const messages = parsed.filter(isChatMessage).slice(-MAX_STORED_MESSAGES);
    if (messages.length === 0) return [];
    // Older versions could save blank assistant rows; heal them on load.
    return messages.map(normalizeMessage);
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
  // Always start empty so the server HTML and the first client render match;
  // stored history is loaded in the effect below (runs once, after hydration).
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [pending, setPending] = useState<PendingMessage | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Thinking…");
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  // Jump (no animation) to the newest message right after mount — e.g. the
  // stored thread is rehydrated and should open at the latest exchange.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    const frame = requestAnimationFrame(() => {
      const list = scrollRef.current;
      if (list) list.scrollTop = list.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Persist the thread whenever it changes (only after hydration has seeded it,
  // so the first effect doesn't overwrite saved history with an empty list).
  useEffect(() => {
    if (!historyLoaded || !isStorageReady()) return;
    saveStoredHistory(messages);
  }, [historyLoaded, messages]);

  // Seed from localStorage, then reconcile with the server copy. Doing this
  // after mount (instead of in a useState initialiser) keeps SSR output equal to
  // the first client render, so React doesn't report a hydration mismatch.
  useEffect(() => {
    const local = loadStoredHistory();
    const serverCopy = (async () => {
      try {
        const res = await fetch("/api/agent", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          // Server history unavailable; the localStorage thread stays.
          return local;
        }
        const serverMessages = Array.isArray(data?.messages)
          ? data.messages.filter(isChatMessage).map(normalizeMessage)
          : [];
        return mergeHistory(local, serverMessages);
      } catch {
        setError("Could not load chat history");
        return local;
      }
    })();

    let cancelled = false;
    void serverCopy.then((merged) => {
      if (cancelled) return;
      setMessages(merged);
      setHistoryLoaded(true);
    });
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

  // Make long model/tool calls legible instead of leaving a static dot
  // animation on-screen with no sense of progress.
  useEffect(() => {
    if (!loading) return;
    const dataTimer = window.setTimeout(() => setLoadingStatus("Checking project data…"), 700);
    const answerTimer = window.setTimeout(() => setLoadingStatus("Writing a clear answer…"), 2_500);
    return () => {
      window.clearTimeout(dataTimer);
      window.clearTimeout(answerTimer);
    };
  }, [loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    // Optimistic: show the message immediately.
    const optimistic: PendingMessage = { id: `pending-${crypto.randomUUID()}`, content: question };
    setPending(optimistic);
    setInput("");
    setError("");
    setLoadingStatus("Understanding your question…");
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // Error path: keep the question, show the server's error bubble (or a
        // fallback), and surface the error banner. Every piece of state used
        // for rendering is normalised so nothing blank is ever shown.
        const userMessage = isChatMessage(data?.userMessage)
          ? normalizeMessage(data.userMessage as ChatMessage)
          : { id: optimistic.id, role: "user" as const, content: question };
        const errorMessage = isChatMessage(data?.message)
          ? normalizeMessage({ ...(data.message as ChatMessage), isError: true })
          : {
              id: `error-${crypto.randomUUID()}`,
              role: "assistant" as const,
              content: EMPTY_REPLY_FALLBACK,
              isError: true,
            };
        setMessages((prev) => appendUnique([...prev], [userMessage, errorMessage]));
        setError(data?.error || "The agent could not answer. Try again.");
        return;
      }

      // Success path. The server sends `message`; fall back to `answer`, then
      // to a friendly fallback so a blank/whitespace reply renders as text.
      const userMessage = isChatMessage(data?.userMessage)
        ? normalizeMessage(data.userMessage as ChatMessage)
        : { id: optimistic.id, role: "user" as const, content: question };
      const rawAnswer =
        typeof data?.message?.content === "string"
          ? data.message.content
          : typeof data?.answer === "string"
            ? data.answer
            : "";
      const assistantMessage = normalizeMessage({
        id: typeof data?.message?.id === "string" ? data.message.id : `assistant-${crypto.randomUUID()}`,
        role: "assistant" as const,
        content: rawAnswer,
        createdAt: data?.message?.createdAt,
      });
      setMessages((prev) => appendUnique([...prev], [userMessage, assistantMessage]));
    } catch (err) {
      setMessages((prev) =>
        appendUnique(prev, [
          { id: optimistic.id, role: "user", content: question },
          { id: `error-${crypto.randomUUID()}`, role: "assistant", content: EMPTY_REPLY_FALLBACK, isError: true },
        ]),
      );
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(null);
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
      setConfirmClear(false);
    }
  }

  return (
    // Fills the shell's chat pane (`h-dvh` flex column) with `h-full`, so no
    // matter how tall the desktop header/padding are, the composer is the last
    // visible row and the page itself never scrolls.
    // - Only the message list scrolls (`min-h-0 flex-1 overflow-y-auto`).
    // - `shrink-0` pins the composer to the bottom, above the mobile keyboard.
    // - The shell drops its chrome on this route on mobile, so nothing overlaps.
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-white px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 md:pt-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
            AI
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Project Agent</p>
            <p className="text-xs text-muted-foreground">
              {loading ? "Working…" : historyLoaded ? "Read-only project data · online" : "Loading chat history…"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          disabled={clearing || messages.length === 0}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-red-200 hover:bg-red-50 hover:text-destructive disabled:opacity-40 disabled:hover:border-zinc-200 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          aria-label="Clear chat"
          title="Clear chat"
        >
          {clearing ? <Spinner className="size-3.5" label="Clearing chat" /> : <Trash2 className="size-3.5" />}
          <span className="hidden sm:inline">Clear Chat</span>
        </button>
      </header>

      <div
        ref={scrollRef}
        aria-live="polite"
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4 [-webkit-overflow-scrolling:touch]"
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

      </div>

      {/* Composer: shrink-0 keeps it pinned to the bottom of the flex column
          while only the list above scrolls; the safe-area padding keeps it off
          the iPhone home indicator. It never needs scrolling to reach. */}
      <div className="shrink-0 border-t bg-background p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:p-4 md:pb-4">
        {loading && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800" role="status" aria-live="polite">
            <Spinner className="size-4 text-emerald-600" label={loadingStatus} />
            <span>{loadingStatus}</span>
          </div>
        )}
        {error && (
          <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={send} className="relative flex items-end gap-2">
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
            enterKeyHint="send"
            placeholder="Type a message…"
            aria-label="Message the project agent"
            className="max-h-36 min-h-11 flex-1 resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-base outline-none focus:border-emerald-500 focus:bg-white disabled:opacity-60 md:text-sm"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-40"
          >
            {loading ? <Spinner className="size-4" label="Sending message" /> : <ArrowUp className="size-5" />}
          </button>
        </form>
      </div>
      <ConfirmDialog open={confirmClear} title="Clear chat history?" body="This permanently removes this conversation from this device and the server." confirmLabel="Clear chat" pending={clearing} onCancel={() => setConfirmClear(false)} onConfirm={clearHistory} />
    </div>
  );
}
