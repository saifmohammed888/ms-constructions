"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Maximize, Minimize, Pause, Play, X } from "lucide-react";
import { documentFileUrl } from "@/components/document-image";
import { formatDate } from "@/lib/format";
import { DOC_CATEGORY_LABELS, type DocCategory } from "@/lib/constants";

type Doc = {
  id: string;
  name: string;
  mimeType: string | null;
  category: string;
  uploadedAt: string;
};

const SECONDS_PER_SLIDE = 6;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?)$/i;

/** Images and drawings only, oldest upload first, so the show always plays the same order. */
function presentationSlides(docs: Doc[]) {
  return docs
    .filter((d) => d.category === "drawings" || d.mimeType?.startsWith("image/") || IMAGE_EXT.test(d.name))
    .filter((d) => d.mimeType !== "application/pdf" || d.category === "drawings")
    .sort((a, b) => (a.uploadedAt < b.uploadedAt ? -1 : a.uploadedAt > b.uploadedAt ? 1 : 0));
}

export default function PresentationPage() {
  const docs = useQuery({
    queryKey: ["presentation-docs"],
    queryFn: async () => {
      const res = await fetch("/api/documents", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load documents");
      return res.json() as Promise<Doc[]>;
    },
  });
  const slides = useMemo(() => presentationSlides(docs.data ?? []), [docs.data]);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const stageRef = useRef<HTMLDivElement>(null);

  const count = slides.length;
  const current = count ? slides[index % count] : null;
  const next = useCallback(() => setIndex((i) => (count ? (i + 1) % count : 0)), [count]);
  const prev = useCallback(() => setIndex((i) => (count ? (i - 1 + count) % count : 0)), [count]);

  // Continuous loop: advance every few seconds, wrapping back to the oldest.
  useEffect(() => {
    if (!playing || count < 2) return;
    const timer = window.setInterval(next, SECONDS_PER_SLIDE * 1000);
    return () => window.clearInterval(timer);
  }, [playing, count, next]);

  // Keep the screen awake while presenting, where the browser supports it.
  useEffect(() => {
    if (!playing || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, [playing]);

  // Keyboard: arrows move, space pauses, F toggles fullscreen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key.toLowerCase() === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // toggleFullscreen is stable for the lifetime of the page.
  }, [next, prev]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Preload the next image so the loop never shows a blank frame.
  useEffect(() => {
    if (count < 2) return;
    const upcoming = slides[(index + 1) % count];
    if (upcoming && !upcoming.mimeType?.includes("pdf") && upcoming.category !== "drawings") {
      const img = new Image();
      img.src = documentFileUrl(upcoming.id);
    }
  }, [index, count, slides]);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else stageRef.current?.requestFullscreen?.().catch(() => {});
  }

  const isPdf = current ? current.mimeType === "application/pdf" || /\.pdf$/i.test(current.name) : false;
  const broken = current ? failed.has(current.id) : false;

  return (
    <div className="fixed inset-0 flex flex-col bg-zinc-950 text-white">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{current ? current.name : "Presentation"}</p>
          <p className="text-xs text-zinc-400">
            {current
              ? `${index + 1} of ${count} · ${DOC_CATEGORY_LABELS[current.category as DocCategory] ?? current.category} · uploaded ${formatDate(current.uploadedAt)}`
              : docs.isLoading ? "Loading…" : "No images or drawings yet"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} className="flex size-11 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20">
            {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
          </button>
          <Link href="/" aria-label="Close presentation" className="flex size-11 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20">
            <X className="size-5" />
          </Link>
        </div>
      </header>

      <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
        {docs.isError && <p className="px-6 text-center text-sm text-red-300">Could not load the presentation. Check your connection.</p>}
        {!docs.isError && count === 0 && !docs.isLoading && (
          <p className="px-6 text-center text-sm text-zinc-400">Upload photos or drawings in Documents and they will appear here.</p>
        )}
        {current && isPdf && (
          <iframe key={current.id} title={current.name} src={`${documentFileUrl(current.id)}#toolbar=0&navpanes=0`} className="size-full bg-white" />
        )}
        {current && !isPdf && !broken && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.id}
            src={documentFileUrl(current.id)}
            alt={current.name}
            className="max-h-full max-w-full object-contain"
            onError={() => setFailed((s) => new Set(s).add(current.id))}
          />
        )}
        {current && !isPdf && broken && (
          <div className="px-6 text-center text-sm text-zinc-300">
            <p>This image cannot be previewed in this browser.</p>
            <a className="mt-2 inline-block underline" href={documentFileUrl(current.id, { download: true })}>Download {current.name}</a>
          </div>
        )}

        {count > 1 && (
          <>
            <button type="button" onClick={prev} aria-label="Previous" className="absolute left-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 hover:bg-black/60">
              <ChevronLeft className="size-6" />
            </button>
            <button type="button" onClick={next} aria-label="Next" className="absolute right-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 hover:bg-black/60">
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>

      <footer className="flex flex-col gap-3 px-4 py-3">
        <div className="h-1 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
          <div key={`${index}-${playing}`} className="h-full bg-amber-500" style={{ width: "100%", animation: playing && count > 1 ? `presentation-progress ${SECONDS_PER_SLIDE}s linear forwards` : "none" }} />
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            disabled={count < 2}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-amber-600 px-5 text-sm font-medium hover:bg-amber-500 disabled:opacity-40"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            {playing ? "Pause" : "Play"}
          </button>
          <span className="text-xs text-zinc-400">Every {SECONDS_PER_SLIDE}s · loops · space pauses</span>
        </div>
      </footer>

      <style>{`@keyframes presentation-progress { from { transform: scaleX(0); transform-origin: left; } to { transform: scaleX(1); transform-origin: left; } }`}</style>
    </div>
  );
}
