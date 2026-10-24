"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Canonical URL for a stored document's bytes. Always same-origin so it works
 * behind the login cookie (and on mobile, where a bare Drive link would 403).
 */
export function documentFileUrl(id: string, opts: { download?: boolean } = {}) {
  const base = `/api/documents/${encodeURIComponent(id)}/file`;
  return opts.download ? `${base}?download=1` : base;
}

export function DocumentImage({
  id,
  alt,
  className,
  imgClassName,
}: {
  id: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const src = documentFileUrl(id);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  // Reset during render (not in an effect) when the document changes, so a new
  // photo starts in the loading state without a cascading re-render.
  const [loadedSrc, setLoadedSrc] = useState(src);
  if (loadedSrc !== src) {
    setLoadedSrc(src);
    setStatus("loading");
  }

  if (status === "error") {
    return (
      <span className={cn("flex flex-col items-center justify-center gap-1 bg-stone-100 p-2 text-center text-[11px] text-muted-foreground", className)}>
        <ImageOff className="size-5" aria-hidden="true" />
        <span className="line-clamp-2 break-words">{alt}</span>
        <span>Preview unavailable</span>
      </span>
    );
  }

  return (
    <span className={cn("relative block overflow-hidden bg-stone-100", className)}>
      {status === "loading" && <span className="absolute inset-0 animate-pulse bg-stone-200/70" aria-hidden="true" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn("relative transition-opacity", status === "ready" ? "opacity-100" : "opacity-0", imgClassName)}
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("error")}
      />
    </span>
  );
}
