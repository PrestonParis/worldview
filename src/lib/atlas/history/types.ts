// The historical record for each tradition: where it came from, who made it,
// what they wrote, what happened, and where it was put into practice.

export interface PrimaryText {
  title: string;
  author: string;
  year: string;
  href?: string;
}

// Later reading: an introduction, a history of the movement, or a work that
// carries its ideas forward. Primary texts live in `texts`.
export type BookKind = "introduction" | "history" | "ideas";

export interface Book {
  title: string;
  author: string;
  year: string;
  kind: BookKind;
}

export interface TraditionHistory {
  origins: { when: string; where: string; founders: string[] };
  figures: string[];
  texts: PrimaryText[];
  timeline: { year: string; event: string }[];
  // Regimes, parties, and movements that put it into practice.
  practice: { name: string; detail: string }[];
  // Real governments the tradition resembles. `kind` says how close the link is:
  // adopted = ran on the doctrine; analogue = a modern state whose policies match
  // its core; precursor = a state that ran on the same core ideas before the
  // doctrine had a name.
  comparisons: Comparison[];
  books: Book[];
}

export type ComparisonKind = "adopted" | "analogue" | "precursor";

export interface Comparison {
  government: string;
  years: string;
  kind: ComparisonKind;
  // What the government was, who ran it, what it did, and how it ended.
  about: string;
}

type ComparisonRow = [government: string, years: string, kind: ComparisonKind, about: string];

// Comparisons are authored in ./comparisons, keyed by tradition id.
export function cmp(rows: Record<string, ComparisonRow[]>): Record<string, Comparison[]> {
  return Object.fromEntries(Object.entries(rows).map(([id, list]) => [id, list.map(([government, years, kind, about]) => ({ government, years, kind, about }))]));
}

type BookRow = [title: string, author: string, year: string, kind: BookKind];

// Books are authored in ./books, keyed by tradition id.
export function books(rows: Record<string, BookRow[]>): Record<string, Book[]> {
  return Object.fromEntries(Object.entries(rows).map(([id, list]) => [id, list.map(([title, author, year, kind]) => ({ title, author, year, kind }))]));
}

type TextRow = [title: string, author: string, year: string, href?: string];

// Compact authoring form: tuples for the list fields.
export function h(x: {
  when: string;
  where: string;
  founders: string[];
  figures: string[];
  texts: TextRow[];
  timeline: [year: string, event: string][];
  practice: [name: string, detail: string][];
}): TraditionCore {
  return {
    origins: { when: x.when, where: x.where, founders: x.founders },
    figures: x.figures,
    texts: x.texts.map(([title, author, year, href]) => (href ? { title, author, year, href } : { title, author, year })),
    timeline: x.timeline.map(([year, event]) => ({ year, event })),
    practice: x.practice.map(([name, detail]) => ({ name, detail })),
  };
}

// A tradition's record before its comparisons are merged in (see ./index).
export type TraditionCore = Omit<TraditionHistory, "comparisons" | "books">;
