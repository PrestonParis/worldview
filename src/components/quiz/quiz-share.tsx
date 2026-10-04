"use client";

import { useState, type CSSProperties } from "react";

// Native share sheet where available, otherwise copy the link.
export function QuizShareButton({
  title,
  className = "",
  style,
}: {
  title: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href.split("?")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" onClick={share} className={className} style={style}>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-4" aria-hidden>
        <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 11v4.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
