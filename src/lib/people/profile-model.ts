// The people-profile model (docs/people-profile-architecture.md). One bundle
// of structured records per profile; every module on the page reads from it
// rather than from its own copy of the facts. Pure: the queries that fill a
// bundle live in src/lib/db/profile-records.ts.

import { isRecipientKind, type RecipientKind } from "@/lib/money/recipient-kinds";

// ── Records ─────────────────────────────────────────────────────────────

export type SourceKind = "primary" | "secondary" | "transcript" | "article" | "filing" | "video" | "official_statement";

export interface SourceRecord {
  id: string;
  key: string;
  title: string;
  url: string;
  publisher: string;
  author: string;
  kind: SourceKind;
  publishedAt: string; // YYYY-MM-DD or ""
  accessedAt: string;
  documentId: string;
  /** Key of the source this one repeats (a syndicated copy); "" if original. */
  repeatsKey: string;
  notes: string;
}

/** Original documents, filings, transcripts and official records. */
export const primaryKinds: ReadonlySet<SourceKind> = new Set(["primary", "filing", "transcript", "official_statement", "video"]);

export const sourceKindLabels: Record<SourceKind, string> = {
  primary: "Primary document",
  filing: "Official filing",
  transcript: "Interview or transcript",
  official_statement: "Official record",
  video: "Video",
  article: "News report",
  secondary: "Reference",
};

export interface FactRecord {
  id: string;
  key: string;
  label: string;
  value: string;
  detail: string;
  asOf: string;
  featured: boolean;
  sourceIds: string[];
}

export type RecordStatus = "verified" | "disputed" | "unresolved";

export interface RelationshipRecord {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relType: string;
  label: string;
  role: string;
  validFrom: string;
  validTo: string;
  notes: string;
  status: RecordStatus;
  prominence: number;
  sourceIds: string[];
}

export const eventCategories = ["career", "finance", "politics", "ideas", "legal", "personal"] as const;
export type EventCategory = (typeof eventCategories)[number];

export const eventCategoryLabels: Record<EventCategory, string> = {
  career: "Career",
  finance: "Money",
  politics: "Politics",
  ideas: "Ideas",
  legal: "Legal",
  personal: "Personal",
};

export interface EventRecord {
  id: string;
  key: string;
  subjectEntityId: string;
  dateStart: string;
  dateEnd: string;
  title: string;
  summary: string;
  category: EventCategory;
  significance: 1 | 2 | 3;
  chapterKey: string;
  status: RecordStatus;
  statusNote: string;
  participants: { entityId: string; role: string }[];
  sourceIds: string[];
  /** Set for timeline entries built from contributions, not editorial events. */
  derivedFrom?: "contributions" | "highlights";
}

export interface StatementRecord {
  id: string;
  /** The dossier's statement key ("democracy-2009"); "" for hand-entered claims. */
  key: string;
  issue: string;
  date: string; // YYYY-MM-DD
  datePrecision: "day" | "month" | "year";
  venue: string;
  quote: string;
  summary: string;
  /** explicit: the speaker's own words; reported: relayed by others; interpretation: an editorial reading. */
  stanceKind: "explicit" | "reported" | "interpretation";
  /** false: an important quotation whose exact wording couldn't be checked against the original. */
  verbatim: boolean;
  sourceId: string;
}

export interface ContributionRecord {
  id: string;
  donorEntityId: string;
  recipientEntityId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  cycle: number;
  kind: RecipientKind;
  party: string;
  committeeId: string;
  receiptType: string;
  /** FEC memo line: already counted elsewhere, never summed. */
  memo: boolean;
  sourceId: string;
  /** How an FEC row was tied to this person: "employer" | "city" | "" (not a name-search import). */
  matchBasis: string;
}

/** Independent expenditures by a committee the subject funded, for one cycle. */
export interface FlowRecord {
  committeeId: string;
  committeeEntityId: string;
  cycle: number;
  supportOppose: "support" | "oppose";
  candidateId: string;
  candidateName: string;
  candidateEntityId: string;
  total: number;
}

/** Outside spending in a candidate's races, with the committee's largest itemized donors that cycle. */
export interface OutsideSpending extends FlowRecord {
  committeeName: string;
  topDonors: { entityId: string; total: number }[];
}

export interface EntitySummary {
  id: string;
  name: string;
  type: string;
  href: string;
  imageUrl: string;
  description: string;
}

// ── Editorial layer ─────────────────────────────────────────────────────

export interface ProfileRole {
  label: string;
  detail: string;
  sources: string[]; // source keys
}

export interface ProfileChapter {
  key: string;
  title: string;
  dek: string;
  body: string;
}

export interface IdeaTradition {
  label: string;
  atlasId: string;
  basis: string;
  context: string;
  sources: string[];
}

export interface IdeaInfluence {
  name: string;
  note: string;
  sources: string[];
}

export interface IdeaWork {
  title: string;
  year: string;
  kind: string;
  detail: string;
  source: string;
}

export interface ProfileIdeas {
  traditions: IdeaTradition[];
  influences: IdeaInfluence[];
  works: IdeaWork[];
  /** Statement keys to preview on the overview, in order. */
  featuredQuotes: string[];
}

export interface ProfileEditorial {
  summary: string;
  roles: ProfileRole[];
  chapters: ProfileChapter[];
  ideas: ProfileIdeas;
  coverage: { money?: string };
  editorialReviewedAt: string;
  sourcesVerifiedAt: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const list = <T>(v: unknown, map: (r: Record<string, unknown>) => T | null): T[] =>
  Array.isArray(v) ? v.flatMap((x) => (isRecord(x) ? (map(x) ?? []) : [])) : [];

export function parseEditorial(row: {
  summary: string;
  roles: unknown;
  chapters: unknown;
  ideas: unknown;
  coverage: unknown;
  editorialReviewedAt: string | null;
  sourcesVerifiedAt: string | null;
}): ProfileEditorial {
  const ideas = isRecord(row.ideas) ? row.ideas : {};
  const coverage = isRecord(row.coverage) ? row.coverage : {};
  return {
    summary: row.summary,
    roles: list(row.roles, (r) => (str(r.label) ? { label: str(r.label), detail: str(r.detail), sources: strs(r.sources) } : null)),
    chapters: list(row.chapters, (r) =>
      str(r.key) && str(r.body) ? { key: str(r.key), title: str(r.title), dek: str(r.dek), body: str(r.body) } : null,
    ),
    ideas: {
      traditions: list(ideas.traditions, (r) => ({
        label: str(r.label),
        atlasId: str(r.atlasId),
        basis: str(r.basis),
        context: str(r.context),
        sources: strs(r.sources),
      })),
      influences: list(ideas.influences, (r) => ({ name: str(r.name), note: str(r.note), sources: strs(r.sources) })),
      works: list(ideas.works, (r) => ({
        title: str(r.title),
        year: str(r.year),
        kind: str(r.kind),
        detail: str(r.detail),
        source: str(r.source),
      })),
      featuredQuotes: strs(ideas.featuredQuotes),
    },
    coverage: { money: str(coverage.money) || undefined },
    editorialReviewedAt: row.editorialReviewedAt ?? "",
    sourcesVerifiedAt: row.sourcesVerifiedAt ?? "",
  };
}

// ── Chapter text ────────────────────────────────────────────────────────
// Chapters are plain paragraphs separated by blank lines. "> " starts a
// quotation; [[key]] or [[key, key]] cites sources by key.

export type Segment = { text: string } | { cite: string[] };
export interface Block {
  kind: "paragraph" | "quote";
  segments: Segment[];
}

export function parseChapterBody(body: string): Block[] {
  return body
    .split(/\n\s*\n/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const quote = raw.startsWith(">");
      const text = quote ? raw.replace(/^>\s?/gm, "") : raw;
      const segments: Segment[] = [];
      let last = 0;
      for (const m of text.matchAll(/\s*\[\[([^\]]+)\]\]/g)) {
        if (m.index! > last) segments.push({ text: text.slice(last, m.index) });
        segments.push({ cite: m[1].split(",").map((k) => k.trim()).filter(Boolean) });
        last = m.index! + m[0].length;
      }
      if (last < text.length) segments.push({ text: text.slice(last) });
      return { kind: quote ? "quote" : "paragraph", segments };
    });
}

/** Every source key a chapter cites, in first-cited order. */
export function chapterCitations(body: string): string[] {
  const keys: string[] = [];
  for (const m of body.matchAll(/\[\[([^\]]+)\]\]/g)) for (const k of m[1].split(",")) keys.push(k.trim());
  return [...new Set(keys.filter(Boolean))];
}

// ── Dates ───────────────────────────────────────────────────────────────

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

/** "2004" → "2004"; "2004-08" → "Aug. 2004"; "2016-07-21" → "July 21, 2016". */
export function formatPartialDate(value: string): string {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(value);
  if (!m) return value;
  const [, y, mo, d] = m;
  if (!mo) return y;
  const month = MONTHS[Number(mo) - 1] ?? mo;
  return d ? `${month} ${Number(d)}, ${y}` : `${month} ${y}`;
}

/** A statement's date at the precision it was recorded. */
export function quoteDate(s: Pick<StatementRecord, "date" | "datePrecision">): string {
  return formatPartialDate(s.datePrecision === "year" ? s.date.slice(0, 4) : s.datePrecision === "month" ? s.date.slice(0, 7) : s.date);
}

export function yearOf(value: string): number {
  return Number(value.slice(0, 4)) || 0;
}

/** Sortable number for a partial date: 2004-08 → 2004.58. */
export function dateValue(value: string): number {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(value);
  if (!m) return 0;
  return Number(m[1]) + (Number(m[2] ?? 1) - 1) / 12 + (Number(m[3] ?? 1) - 1) / 372;
}

export function spanLabel(from: string, to: string): string {
  if (!from && !to) return "";
  if (from && !to) return `${formatPartialDate(from)}–present`;
  if (!from) return `until ${formatPartialDate(to)}`;
  return from === to ? formatPartialDate(from) : `${formatPartialDate(from)}–${formatPartialDate(to)}`;
}

// ── Money ───────────────────────────────────────────────────────────────

export interface GivingSummary {
  total: number;
  count: number;
  first: string;
  last: string;
  memoLines: number;
  byCycle: { cycle: number; total: number; byKind: Partial<Record<RecipientKind, number>> }[];
  byKind: { kind: RecipientKind; total: number; count: number }[];
  byRecipient: { entityId: string; kind: RecipientKind; total: number; count: number; first: string; last: string }[];
  /** Candidate campaigns vs every kind of committee. */
  candidateTotal: number;
  committeeTotal: number;
  /** Party split, only where FEC records a party (candidates and party committees). */
  byParty: { party: string; total: number }[];
  largest: ContributionRecord[];
}

const PARTY_NAMES: Record<string, string> = { REP: "Republican", R: "Republican", DEM: "Democratic", D: "Democratic", LIB: "Libertarian" };

export function partyName(code: string): string {
  return PARTY_NAMES[code] ?? code;
}

export function summarizeGiving(rows: ContributionRecord[]): GivingSummary {
  const counted = rows.filter((r) => !r.memo);
  const byCycle = new Map<number, { cycle: number; total: number; byKind: Partial<Record<RecipientKind, number>> }>();
  const byKind = new Map<RecipientKind, { kind: RecipientKind; total: number; count: number }>();
  const byRecipient = new Map<string, GivingSummary["byRecipient"][number]>();
  const byParty = new Map<string, number>();
  let total = 0;
  for (const r of counted) {
    total += r.amount;
    const c = byCycle.get(r.cycle) ?? { cycle: r.cycle, total: 0, byKind: {} };
    c.total += r.amount;
    c.byKind[r.kind] = (c.byKind[r.kind] ?? 0) + r.amount;
    byCycle.set(r.cycle, c);
    const k = byKind.get(r.kind) ?? { kind: r.kind, total: 0, count: 0 };
    k.total += r.amount;
    k.count += 1;
    byKind.set(r.kind, k);
    const rec = byRecipient.get(r.recipientEntityId) ?? {
      entityId: r.recipientEntityId,
      kind: r.kind,
      total: 0,
      count: 0,
      first: r.date,
      last: r.date,
    };
    rec.total += r.amount;
    rec.count += 1;
    if (r.date < rec.first) rec.first = r.date;
    if (r.date > rec.last) rec.last = r.date;
    byRecipient.set(r.recipientEntityId, rec);
    if (r.party && (r.kind === "candidate" || r.kind === "party")) {
      const p = partyName(r.party);
      byParty.set(p, (byParty.get(p) ?? 0) + r.amount);
    }
  }
  const dates = counted.map((r) => r.date).sort();
  const candidateTotal = byKind.get("candidate")?.total ?? 0;
  return {
    total,
    count: counted.length,
    first: dates[0] ?? "",
    last: dates.at(-1) ?? "",
    memoLines: rows.length - counted.length,
    byCycle: [...byCycle.values()].sort((a, b) => a.cycle - b.cycle),
    byKind: [...byKind.values()].sort((a, b) => b.total - a.total),
    byRecipient: [...byRecipient.values()].sort((a, b) => b.total - a.total),
    candidateTotal,
    committeeTotal: total - candidateTotal,
    byParty: [...byParty.entries()].map(([party, t]) => ({ party, total: t })).sort((a, b) => b.total - a.total),
    largest: [...counted].sort((a, b) => b.amount - a.amount || a.date.localeCompare(b.date)).slice(0, 12),
  };
}

export function toRecipientKind(value: unknown): RecipientKind {
  return isRecipientKind(value) ? value : "other";
}

/**
 * Timeline entries for the largest gifts, one per recipient and cycle, so a
 * $10 million gift and its three top-ups read as one event. Built from the
 * contribution rows themselves, never from a separate description.
 */
export function givingEvents(
  rows: ContributionRecord[],
  names: Map<string, string>,
  subjectId: string,
  { min = 1_000_000 }: { min?: number } = {},
): EventRecord[] {
  const groups = new Map<string, ContributionRecord[]>();
  for (const r of rows) {
    if (r.memo) continue;
    const key = `${r.recipientEntityId}:${r.cycle}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()].flatMap((group) => {
    const total = group.reduce((t, r) => t + r.amount, 0);
    if (total < min) return [];
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const name = names.get(first.recipientEntityId) ?? "a committee";
    const n = group.length;
    return [
      {
        id: `giving:${first.recipientEntityId}:${first.cycle}`,
        key: `giving:${first.recipientEntityId}:${first.cycle}`,
        subjectEntityId: subjectId,
        dateStart: first.date,
        dateEnd: n > 1 ? sorted.at(-1)!.date : "",
        title: `Gives ${formatUsd(total)} to ${name}`,
        summary: n > 1 ? `${n} contributions in the ${first.cycle} cycle.` : `${first.cycle} cycle.`,
        category: "finance" as const,
        significance: total >= 5_000_000 ? 3 : 2,
        chapterKey: "",
        status: "verified" as const,
        statusNote: "",
        participants: [{ entityId: first.recipientEntityId, role: "recipient" }],
        sourceIds: [first.sourceId].filter(Boolean),
        derivedFrom: "contributions" as const,
      },
    ];
  });
}

export function formatUsd(value: number, { compact = true }: { compact?: boolean } = {}): string {
  if (compact && Math.abs(value) >= 1_000_000) {
    const m = value / 1_000_000;
    return `$${m >= 100 ? Math.round(m) : Number(m.toFixed(m >= 10 ? 1 : 2))} million`;
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** Short form for chart labels: $1.5M, $850K. */
export function formatUsdShort(value: number): string {
  const a = Math.abs(value);
  if (a >= 1_000_000) return `$${Number((value / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1))}M`;
  if (a >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

// ── Legacy profiles ─────────────────────────────────────────────────────
// Profiles without a dossier still carry dated highlights ("1998 — Co-founds
// Confinity"). They become unsourced timeline entries until a dossier
// replaces them.

export function highlightEvents(highlights: string[], subjectId: string): EventRecord[] {
  return highlights.flatMap((line, i) => {
    const m = /^(\d{4}(?:-\d{2}(?:-\d{2})?)?)\s*[—–-]\s*(.+)$/.exec(line);
    if (!m) return [];
    return [
      {
        id: `highlight:${i}`,
        key: `highlight:${i}`,
        subjectEntityId: subjectId,
        dateStart: m[1],
        dateEnd: "",
        title: m[2],
        summary: "",
        category: "career" as const,
        significance: 2 as const,
        chapterKey: "",
        status: "verified" as const,
        statusNote: "",
        participants: [],
        sourceIds: [],
        derivedFrom: "highlights" as const,
      },
    ];
  });
}
