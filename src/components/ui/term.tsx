"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { GLOSSARY, type GlossaryId } from "@/lib/glossary";

// A glossary term inline in text: dotted underline, definition in a popover
// on hover, focus, or tap. The popover is fixed-positioned and clamped to the
// viewport so it never causes horizontal scroll on a phone.
export function Term({ id, children }: { id: GlossaryId; children?: ReactNode }) {
  const entry = GLOSSARY[id];
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const openedAt = useRef(0);
  const tip = useId();

  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const w = Math.min(320, window.innerWidth - 32);
    const left = Math.max(16, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - 16 - w));
    const above = r.bottom + 200 > window.innerHeight && r.top > 220;
    setPos({ top: above ? r.top - 8 : r.bottom + 8, left, above });
  };
  const show = () => {
    if (!open) openedAt.current = Date.now();
    place();
    setOpen(true);
  };
  // A tap fires focus (or hover) and then click; the click that follows the
  // open shouldn't close it again.
  const toggle = () => (open && Date.now() - openedAt.current > 400 ? setOpen(false) : show());

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      if (e.type === "pointerdown" && btn.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, { passive: true });
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-describedby={open ? tip : undefined}
        aria-expanded={open}
        onClick={toggle}
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
        onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
        className="inline cursor-help text-left underline decoration-slate-400 decoration-dotted underline-offset-[3px] hover:decoration-slate-700 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-sky-500 dark:decoration-slate-500 dark:hover:decoration-slate-200"
      >
        {children ?? entry.term}
      </button>
      {open && pos && (
        <span
          id={tip}
          role="tooltip"
          className="fixed z-50 block w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 text-left text-sm leading-6 font-normal tracking-normal text-slate-600 normal-case shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          style={{ top: pos.top, left: pos.left, transform: pos.above ? "translateY(-100%)" : undefined }}
        >
          <span className="block font-semibold text-slate-900 dark:text-white">{entry.term}</span>
          <span className="mt-1 block">{entry.definition}</span>
        </span>
      )}
    </>
  );
}
