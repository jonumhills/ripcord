"use client";

import { useState } from "react";

/** Copies `text` to the clipboard and flashes a brief confirmation, with an execCommand
 * fallback for contexts where the async Clipboard API is unavailable. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
      } catch {
        setCopied(false);
      }
    }
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      className={`btn btn-secondary !py-1.5 !px-3 !text-xs ${copied ? "!text-primary !border-primary" : ""}`}
      onClick={handleCopy}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
