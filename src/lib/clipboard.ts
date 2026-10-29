export type CopyResult = "clipboard" | "execCommand" | "share" | "download";

const TOO_LARGE_FOR_SHARE = 60_000;

/**
 * Copy text to the clipboard, working around mobile browser limitations.
 *
 * `navigator.clipboard.writeText` is only available in secure contexts (HTTPS or
 * localhost) and is frequently rejected on mobile Safari/Chrome outside a direct
 * user gesture (permission prompts, `NotAllowedError`, `not focused`). When it is
 * missing or fails we fall back, in order, to:
 *
 * 1. `navigator.share()` — lets the user pick "Copy" (or any app) from the native
 *    share sheet. Must be called synchronously inside the click handler.
 * 2. A hidden `<textarea>` + `document.execCommand("copy")`, which still works in
 *    older WebViews and on plain-http dev hosts.
 * 3. A generated text file download, so the data is never lost.
 *
 * Returns which strategy succeeded. Throws only if every strategy fails.
 */
export async function copyText(text: string): Promise<CopyResult> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return "clipboard";
    } catch {
      // Fall through to the legacy/mobile strategies below.
    }
  }

  if (legacyCopy(text)) return "execCommand";

  // The clipboard API can also exist on insecure origins; try it after the
  // synchronous fallback so we still get a real clipboard write when possible.
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return "clipboard";
    } catch {
      // ignore
    }
  }

  if (await shareText(text)) return "share";

  downloadText(text);
  return "download";
}

/** Synchronous copy via a temporary textarea — works without HTTPS. */
export function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  // Keep it invisible but focusable; iOS requires it to be on-screen-ish and
  // must not be `display:none` for execCommand("copy") to target it.
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.padding = "0";
  textarea.style.border = "none";
  textarea.style.outline = "none";
  textarea.style.boxShadow = "none";
  textarea.style.background = "transparent";
  textarea.style.opacity = "0";

  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  document.body.appendChild(textarea);
  try {
    if (typeof textarea.focus === "function") textarea.focus({ preventScroll: true } as FocusOptions);
    textarea.select();
    if (typeof textarea.setSelectionRange === "function") textarea.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (selection && previousRange) {
      try {
        selection.removeAllRanges();
        selection.addRange(previousRange);
      } catch {
        // Selection restore is best-effort only.
      }
    }
  }
}

/**
 * Try the native share sheet. Returns true when the user completed the share
 * (or there is no share API to attempt). Abort is reported as failure so the
 * caller can fall back to a download.
 */
async function shareText(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  if (text.length > TOO_LARGE_FOR_SHARE) return false;
  try {
    await navigator.share({ title: "MS Constructions project data", text });
    return true;
  } catch {
    return false;
  }
}

/** Last resort: save the text as a JSON file the user can open/share. */
function downloadText(text: string) {
  if (typeof document === "undefined") return;
  if (typeof Blob === "undefined" || typeof URL?.createObjectURL !== "function") {
    throw new Error("Copying is not supported in this browser");
  }
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `project-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so mobile Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function copyResultMessage(result: CopyResult) {
  switch (result) {
    case "share":
      return "Project data ready — choose Copy in the share sheet";
    case "download":
      return "Clipboard unavailable — project data downloaded as JSON";
    default:
      return "Project data copied as JSON";
  }
}
