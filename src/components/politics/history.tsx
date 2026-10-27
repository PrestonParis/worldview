// History and reading, shared by the quiz results and Atlas entries:
// historical parallels on a timeline, a tradition's own timeline, and a
// categorised reading list.

import type { ReactNode } from "react";
import { ArrowUpRight, History as HistoryIcon, Landmark, Scale, type LucideIcon } from "lucide-react";
import type { Book, BookKind, Comparison, ComparisonKind, PrimaryText } from "@/lib/atlas/history";
import { formatYear, parseYearSpan, type YearSpan } from "@/lib/politics/years";
import { ExpandableAnalysis } from "./expandable";
import { chartLabel, focusRing, metaText, subhead } from "./type";

// ── Historical parallels ──

export const COMPARISON_KINDS: Record<ComparisonKind, { label: string; note: string; icon: LucideIcon }> = {
  adopted: { label: "In government", note: "Governed on this tradition's doctrine", icon: Landmark },
  analogue: { label: "Historical parallel", note: "A state whose policies resemble its core ideas", icon: Scale },
  precursor: {
    label: "Earlier parallel",
    note: "Ran on similar core ideas before this tradition existed",
    icon: HistoryIcon,
  },
};

const KIND_ORDER: ComparisonKind[] = ["adopted", "analogue", "precursor"];

export function ComparisonKindChip({ kind, color }: { kind: ComparisonKind; color: string }) {
  const { label, icon: Icon } = COMPARISON_KINDS[kind];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={{ color, borderColor: `${color}80` }}
    >
      <Icon size={12} strokeWidth={2.25} aria-hidden />
      {label}
    </span>
  );
}

const firstSentence = (text: string) => text.match(/^.+?[.!?](?=\s+[A-Z"“]|$)/)?.[0] ?? text;

// Each parallel's years against the tradition's own start, one lane each.
// Spans that can't be read from the text are listed but left off the chart.
function ParallelTimeline({
  comparisons,
  origin,
  originLabel,
  color,
}: {
  comparisons: Comparison[];
  origin: YearSpan | null;
  originLabel: string;
  color: string;
}) {
  const lanes = comparisons.flatMap((c) => {
    const span = parseYearSpan(c.years);
    return span ? [{ c, span }] : [];
  });
  if (lanes.length === 0) return null;
  const now = new Date().getFullYear();
  const lo = Math.min(...lanes.map((l) => l.span.start), origin?.start ?? Infinity);
  const hi = Math.max(...lanes.map((l) => l.span.end), origin ? Math.max(origin.start, origin.end) : -Infinity, lo + 1);
  const pad = Math.max(5, Math.round((hi - lo) * 0.04));
  const a = lo - pad;
  const b = Math.min(now + 2, hi + pad);
  const pct = (y: number) => Math.max(0, Math.min(100, ((y - a) / (b - a)) * 100));
  const ticks = [lo, Math.round((lo + hi) / 2), hi];

  const lane =
    "grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] items-center gap-x-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]";
  const originLine = origin && (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 z-10 border-l-2 border-dashed"
      style={{ left: `${pct(origin.start)}%`, borderColor: color }}
    />
  );

  return (
    <figure
      className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/60"
      aria-label={`Timeline of ${lanes.length} historical comparisons${origin ? ` and when ${originLabel} began` : ""}`}
    >
      <ul>
        {lanes.map(({ c, span }, i) => (
          <li key={c.government} className={lane}>
            <span
              className="truncate py-1.5 text-right text-xs font-medium text-slate-800 dark:text-slate-200"
              title={`${c.government}, ${c.years}`}
            >
              {c.government}
            </span>
            <span className="relative block h-8">
              {originLine}
              <span
                className="wv-grow absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full"
                style={{
                  left: `${pct(span.start)}%`,
                  width: `max(0.5rem, ${pct(span.end) - pct(span.start)}%)`,
                  backgroundColor: c.kind === "adopted" ? color : `${color}99`,
                  ["--i" as string]: i,
                }}
              />
            </span>
          </li>
        ))}
      </ul>
      <div className={lane}>
        <span />
        <span className={`relative block h-5 border-t border-slate-300 dark:border-slate-700 ${chartLabel}`}>
          {ticks.map((t, i) => (
            <span
              key={t}
              className={`absolute top-1 tabular-nums ${i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: `${pct(t)}%` }}
            >
              {formatYear(t)}
            </span>
          ))}
        </span>
      </div>
      {origin && (
        <figcaption className={`mt-3 flex items-center gap-2 ${metaText}`}>
          <span aria-hidden className="h-3 border-l-2 border-dashed" style={{ borderColor: color }} />
          {originLabel} begins, {formatYear(origin.start)}
        </figcaption>
      )}
    </figure>
  );
}

export function HistoricalParallels({
  comparisons,
  color,
  traditionName,
  originText,
  timeline = true,
  idPrefix = "parallel",
}: {
  comparisons: Comparison[];
  color: string;
  traditionName: string;
  originText?: string;
  timeline?: boolean;
  idPrefix?: string;
}) {
  if (comparisons.length === 0) return null;
  const kinds = KIND_ORDER.filter((k) => comparisons.some((c) => c.kind === k));
  const origin = originText ? parseYearSpan(originText) : null;
  return (
    <div className="space-y-4">
      <dl className={`flex flex-wrap gap-x-5 gap-y-1.5 ${metaText}`}>
        {kinds.map((k) => (
          <div key={k} className="flex items-center gap-1.5">
            <dt>
              <ComparisonKindChip kind={k} color={color} />
            </dt>
            <dd>{COMPARISON_KINDS[k].note}</dd>
          </div>
        ))}
      </dl>
      {timeline && (
        <ParallelTimeline comparisons={comparisons} origin={origin} originLabel={traditionName} color={color} />
      )}
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {kinds.flatMap((k) =>
          comparisons
            .filter((c) => c.kind === k)
            .map((c) => (
              <li key={c.government} id={`${idPrefix}-${slugify(c.government)}`} className="scroll-mt-36">
                <ExpandableAnalysis
                  summaryClassName="items-start px-4 py-3 hover:bg-slate-50/70 dark:hover:bg-slate-900/40"
                  summary={
                    <span className="block">
                      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <ComparisonKindChip kind={c.kind} color={color} />
                        <span className="font-semibold text-slate-950 dark:text-white">{c.government}</span>
                        <span className="text-sm text-slate-600 tabular-nums dark:text-slate-400">{c.years}</span>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-sm leading-6 text-slate-700 group-open/x:hidden dark:text-slate-300">
                        {firstSentence(c.about)}
                      </span>
                    </span>
                  }
                >
                  <p className="max-w-3xl px-4 pb-4 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
                    {c.about}
                  </p>
                </ExpandableAnalysis>
              </li>
            )),
        )}
      </ul>
    </div>
  );
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// ── A tradition's own timeline ──

export function HistoricalTimeline({ entries, color }: { entries: { year: string; event: string }[]; color: string }) {
  return (
    <ol className="relative grid gap-5 border-l-2 border-slate-300 pl-6 md:flex md:snap-x md:gap-0 md:overflow-x-auto md:border-t-2 md:border-l-0 md:pt-0 md:pb-2 md:pl-0 dark:border-slate-700 [scrollbar-width:thin]">
      {entries.map((t, i) => (
        <li
          key={i}
          className="wv-rise relative md:w-60 md:shrink-0 md:snap-start md:pt-5 md:pr-6"
          style={{ ["--i" as string]: i }}
        >
          <span
            aria-hidden
            className="absolute top-1.5 -left-[1.95rem] size-3.5 rounded-full ring-4 ring-white md:-top-[0.5rem] md:left-0 dark:ring-[#080b12]"
            style={{ backgroundColor: color }}
          />
          <p className="text-sm font-bold tabular-nums" style={{ color }}>
            {t.year}
          </p>
          <p className="mt-1 text-[15px] leading-6 text-slate-700 dark:text-slate-300">{t.event}</p>
        </li>
      ))}
    </ol>
  );
}

// ── Reading ──

export const BOOK_GROUPS: { kind: BookKind; label: string; note: string }[] = [
  { kind: "introduction", label: "Introductions", note: "Overviews for a first reading" },
  { kind: "history", label: "Histories", note: "Accounts of the tradition and its record" },
  { kind: "ideas", label: "Ideas & theory", note: "Works setting out or developing its ideas" },
];

const BOOK_LABEL: Record<BookKind, string> = {
  introduction: "Introduction",
  history: "History",
  ideas: "Ideas & theory",
};

const initials = (title: string) =>
  title
    .replace(/^(The|A|An)\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const findUrl = (title: string, author: string) =>
  `https://openlibrary.org/search?${new URLSearchParams({ title, author })}`;

function Spine({ title, color }: { title: string; color: string }) {
  return (
    <span
      aria-hidden
      className="relative flex h-14 w-10 shrink-0 items-end justify-center overflow-hidden rounded-[3px] pb-1.5 text-[11px] font-bold tracking-tight text-white shadow-sm"
      style={{ backgroundColor: color }}
    >
      <span className="absolute inset-y-0 left-1 w-px bg-white/30" />
      <span className="absolute inset-x-0 top-2 mx-auto h-px w-5 bg-white/40" />
      {initials(title)}
    </span>
  );
}

function ReadingRow({
  title,
  author,
  year,
  tag,
  action,
  color,
}: {
  title: string;
  author: string;
  year: string;
  tag: string;
  action: ReactNode;
  color: string;
}) {
  return (
    <li className="flex gap-3.5 py-3">
      <Spine title={title} color={color} />
      <div className="min-w-0 flex-1">
        <p className="leading-snug font-semibold text-balance text-slate-950 dark:text-white">{title}</p>
        <p className={`mt-0.5 ${metaText}`}>
          {author} · <span className="tabular-nums">{year}</span>
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {tag}
          </span>
          {action}
        </p>
      </div>
    </li>
  );
}

const actionLink = `inline-flex items-center gap-0.5 font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-950 hover:decoration-current dark:text-slate-300 dark:decoration-slate-600 dark:hover:text-white ${focusRing}`;

export function ReadingList({
  texts = [],
  books,
  color,
  limit,
  grouped = true,
}: {
  texts?: PrimaryText[];
  books: Book[];
  color: string;
  limit?: number;
  grouped?: boolean;
}) {
  const textRows = texts.map((t) => (
    <ReadingRow
      key={`t-${t.title}`}
      title={t.title}
      author={t.author}
      year={t.year}
      tag="Primary text"
      color={color}
      action={
        t.href ? (
          <a href={t.href} rel="noreferrer" target="_blank" className={actionLink}>
            Read it <ArrowUpRight size={12} aria-hidden />
          </a>
        ) : (
          <a href={findUrl(t.title, t.author)} rel="noreferrer" target="_blank" className={actionLink}>
            Find it <ArrowUpRight size={12} aria-hidden />
          </a>
        )
      }
    />
  ));
  const bookRow = (b: Book) => (
    <ReadingRow
      key={`b-${b.title}`}
      title={b.title}
      author={b.author}
      year={b.year}
      tag={BOOK_LABEL[b.kind]}
      color={`${color}cc`}
      action={
        <a href={findUrl(b.title, b.author)} rel="noreferrer" target="_blank" className={actionLink}>
          Find it <ArrowUpRight size={12} aria-hidden />
        </a>
      }
    />
  );

  if (!grouped) {
    const rows = [...textRows, ...books.map(bookRow)].slice(0, limit);
    return <ul className="grid divide-y divide-slate-200 sm:grid-cols-1 dark:divide-slate-800">{rows}</ul>;
  }

  const groups = [
    ...(textRows.length
      ? [
          {
            key: "texts",
            label: "Primary texts",
            note: "Written by the tradition's founders and adherents",
            rows: textRows,
          },
        ]
      : []),
    ...BOOK_GROUPS.flatMap((g) => {
      const rows = books.filter((b) => b.kind === g.kind).map(bookRow);
      return rows.length ? [{ key: g.kind, label: g.label, note: g.note, rows }] : [];
    }),
  ];
  return (
    <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label} className="min-w-0">
          <h3 className={subhead}>
            {g.label}{" "}
            <span className="text-sm font-normal text-slate-500 tabular-nums dark:text-slate-400">{g.rows.length}</span>
          </h3>
          <p className={metaText}>{g.note}</p>
          <ul className="mt-1 divide-y divide-slate-200 dark:divide-slate-800">{g.rows}</ul>
        </section>
      ))}
    </div>
  );
}

// Compatibility for earlier imports.
export const KIND_LABEL: Record<ComparisonKind, string> = {
  adopted: COMPARISON_KINDS.adopted.label,
  analogue: COMPARISON_KINDS.analogue.label,
  precursor: COMPARISON_KINDS.precursor.label,
};
