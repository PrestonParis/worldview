"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { GLOSSARY, type GlossaryId } from "@/lib/glossary";

// A glossary term inline in text: click once to explain, again to condense.
// The popover is fixed-positioned and clamped to the viewport so it never
// causes horizontal scroll on a phone.
export function Term({ id, children }: { id: GlossaryId; children?: ReactNode }) {
  const entry = GLOSSARY[id];
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const tip = useId();

  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const w = Math.min(320, window.innerWidth - 32);
    const left = Math.max(16, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - 16 - w));
    const above = r.bottom + 200 > window.innerHeight && r.top > 220;
    setPos({ top: above ? r.top - 8 : r.bottom + 8, left, above });
  };
  const toggle = () => {
    if (open) setOpen(false);
    else {
      place();
      setOpen(true);
    }
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      if (
        e.type === "pointerdown" &&
        (btn.current?.contains(e.target as Node) || pop.current?.contains(e.target as Node))
      )
        return;
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
        className="inline cursor-pointer text-left underline decoration-slate-400 decoration-dotted underline-offset-[3px] hover:decoration-slate-700 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-sky-500 dark:decoration-slate-500 dark:hover:decoration-slate-200"
      >
        {children ?? entry.term}
      </button>
      {open && pos && (
        <span
          ref={pop}
          id={tip}
          role="tooltip"
          className="fixed z-50 block w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 text-left text-sm leading-6 font-normal tracking-normal text-slate-600 normal-case shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          style={{ top: pos.top, left: pos.left, transform: pos.above ? "translateY(-100%)" : undefined }}
        >
          <span className="block font-semibold text-slate-900 dark:text-white">{entry.term}</span>
          <span className="mt-1 block">{entry.definition}</span>
          {"source" in entry && (
            <a
              href={entry.source.href}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-blue-700 hover:underline dark:text-blue-300"
            >
              {entry.source.label} ↗
            </a>
          )}
        </span>
      )}
    </>
  );
}

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function forms(id: GlossaryId): string[] {
  const term = GLOSSARY[id].term;
  const withoutNote = term.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const parenthetical = [...term.matchAll(/\(([^)]+)\)/g)].map((match) => match[1]);
  const parts = withoutNote.split(/\s+vs\.\s+/i);
  const slug = id.replaceAll("-", " ");
  const base = new Set([term, withoutNote, slug, ...parenthetical, ...parts].filter((value) => value.length > 2));
  for (const value of [...base]) {
    if (/[^s]y$/i.test(value)) base.add(`${value.slice(0, -1)}ies`);
    else if (!/s$/i.test(value)) base.add(`${value}s`);
  }
  return [...base];
}

// Turns the glossary terms declared for a system node into the same inline,
// reversible explanation used by hand-authored <Term> instances elsewhere.
export function ExplainTerms({ children, ids }: { children: string; ids?: readonly GlossaryId[] }) {
  const candidates = useMemo(
    () =>
      (ids ?? [])
        .flatMap((id) => forms(id).map((form) => ({ form, id })))
        .sort((a, b) => b.form.length - a.form.length),
    [ids],
  );
  if (!candidates.length) return children;

  const byForm = new Map(candidates.map((candidate) => [candidate.form.toLowerCase(), candidate.id]));
  const pattern = new RegExp(`\\b(${candidates.map((candidate) => escapePattern(candidate.form)).join("|")})\\b`, "gi");
  return children.split(pattern).map((part, index) => {
    const id = byForm.get(part.toLowerCase());
    return id ? (
      <Term key={`${id}:${index}`} id={id}>
        {part}
      </Term>
    ) : (
      part
    );
  });
}
