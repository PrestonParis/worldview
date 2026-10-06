import type { Entity, EntityType } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";
import type { LobbyingRegistration } from "@/lib/validation/lobbying";
import { industryLabel } from "./industries";

export * from "./industries";
export * from "./us-states";

// ── Donor-edge recognition ────────────────────────────────────────────────
// Donor/funding relationships aren't a distinct edge "type" in the data
// model — they're ordinary labeled edges — so this pattern is how every
// donor-aware view (entity profiles, the money graph) recognizes the
// hand-entered ones. Structured FEC money lives in the `contributions`
// table instead; see the aggregation types below.
export const donorLabelPattern = /(donat|contribut|campaign financ|funded|funding)/i;

// A typed edge is a donation only if its relType says so — label text
// alone misfires on non-money verbs like "contributes to" (writes for).
// The label pattern is the fallback for legacy edges with no relType.
export function isDonorEdge(edge: { label: string; relType?: string }): boolean {
  if (edge.relType) return edge.relType === "donated-to";
  return donorLabelPattern.test(edge.label);
}

export const individualEntityTypes = new Set<EntityType>([
  "politician",
  "pundit",
  "journalist",
]);

// ── Money formatting ──────────────────────────────────────────────────────
export function formatAmount(amount: number, currency: string | undefined): string {
  const code = currency || "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Intl throws on an unrecognized currency code (free text, not
    // validated against ISO 4217) — fall back to a plain labeled number.
    return `${amount.toLocaleString()} ${code}`;
  }
}

export function moneyEdgeLabel(total: number, count: number, currency: string): string {
  const amount = formatAmount(total, currency);
  return count > 1 ? `${amount} · ${count}×` : amount;
}

// ── Aggregation shapes (returned by src/lib/db/contributions.ts) ───────────
// Defined here, not in the DB module, so client components can import the
// types (and `formatAmount`) without pulling the Postgres client into their
// bundle. The DB module imports these back.
export interface ContributionFlow {
  donorEntityId: string;
  recipientEntityId: string;
  currency: string;
  total: number;
  count: number;
  firstDate: string; // ISO, "" when unknown
  lastDate: string;
}

export interface CurrencyTotal {
  currency: string;
  total: number;
  count: number;
}

export interface CounterpartyTotal {
  entityId: string;
  currency: string;
  total: number;
  count: number;
}

export interface EntityContributionSummary {
  raised: CurrencyTotal[]; // entity as recipient
  given: CurrencyTotal[]; // entity as donor
  topDonors: CounterpartyTotal[]; // who gave to this entity
  topRecipients: CounterpartyTotal[]; // who this entity gave to
}

// ── Industry Support Explorer (/money/industries) ─────────────────────────
// One row per (recipient, donor industry, donor, currency). The view pivots
// this entirely client-side — sector rollup, recipient filter/compare, and
// per-sector donor drill-down — so it's one query and no round-trips.
export interface IndustryBreakdownRow {
  recipientEntityId: string;
  industry: string; // slug, or "" when the donor is unclassified
  donorEntityId: string;
  currency: string;
  total: number;
  count: number;
}

export interface IndustrySlice {
  industry: string; // slug or ""
  label: string;
  total: number;
  count: number;
  share: number; // 0..1 of the in-scope total
}

function inScope(
  rows: IndustryBreakdownRow[],
  currency: string,
  recipientIds?: string[],
): IndustryBreakdownRow[] {
  const pick = recipientIds && recipientIds.length > 0 ? new Set(recipientIds) : null;
  return rows.filter(
    (r) => r.currency === currency && (!pick || pick.has(r.recipientEntityId)),
  );
}

// Sector rollup, sorted by total desc. `recipientIds` empty/undefined = all.
export function industryBreakdown(
  rows: IndustryBreakdownRow[],
  opts: { currency: string; recipientIds?: string[] },
): { slices: IndustrySlice[]; total: number } {
  const scoped = inScope(rows, opts.currency, opts.recipientIds);
  const total = scoped.reduce((s, r) => s + r.total, 0);
  const byIndustry = new Map<string, { total: number; count: number }>();
  for (const r of scoped) {
    const cur = byIndustry.get(r.industry) ?? { total: 0, count: 0 };
    cur.total += r.total;
    cur.count += r.count;
    byIndustry.set(r.industry, cur);
  }
  const slices = [...byIndustry.entries()]
    .map(([industry, v]) => ({
      industry,
      label: industry ? industryLabel(industry) : "Unclassified",
      total: v.total,
      count: v.count,
      share: total > 0 ? v.total / total : 0,
    }))
    .sort((a, b) => b.total - a.total);
  return { slices, total };
}

// Donors within one sector, summed per donor, sorted by total desc.
export function industryDonors(
  rows: IndustryBreakdownRow[],
  opts: { industry: string; currency: string; recipientIds?: string[] },
): { donorEntityId: string; total: number; count: number }[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of inScope(rows, opts.currency, opts.recipientIds)) {
    if (r.industry !== opts.industry) continue;
    const cur = map.get(r.donorEntityId) ?? { total: 0, count: 0 };
    cur.total += r.total;
    cur.count += r.count;
    map.set(r.donorEntityId, cur);
  }
  return [...map.entries()]
    .map(([donorEntityId, v]) => ({ donorEntityId, ...v }))
    .sort((a, b) => b.total - a.total);
}

// ── Geographic Donor Map (/money/map) ────────────────────────────────────
// Same one-query, client-pivots-everything shape as the industry breakdown.
export interface StateBreakdownRow {
  recipientEntityId: string;
  state: string; // 2-letter, upper-cased; "" when the filing had no state
  donorEntityId: string;
  currency: string;
  total: number;
  count: number;
}

export interface StateTotal {
  state: string; // "" = unknown
  total: number;
  count: number;
  share: number; // 0..1 of the in-scope total
}

function stateInScope(
  rows: StateBreakdownRow[],
  currency: string,
  recipientIds?: string[],
): StateBreakdownRow[] {
  const pick = recipientIds && recipientIds.length > 0 ? new Set(recipientIds) : null;
  return rows.filter(
    (r) => r.currency === currency && (!pick || pick.has(r.recipientEntityId)),
  );
}

export function stateBreakdown(
  rows: StateBreakdownRow[],
  opts: { currency: string; recipientIds?: string[] },
): { states: StateTotal[]; total: number; unknown: StateTotal | null } {
  const scoped = stateInScope(rows, opts.currency, opts.recipientIds);
  const total = scoped.reduce((s, r) => s + r.total, 0);
  const byState = new Map<string, { total: number; count: number }>();
  for (const r of scoped) {
    const cur = byState.get(r.state) ?? { total: 0, count: 0 };
    cur.total += r.total;
    cur.count += r.count;
    byState.set(r.state, cur);
  }
  const all = [...byState.entries()].map(([state, v]) => ({
    state,
    total: v.total,
    count: v.count,
    share: total > 0 ? v.total / total : 0,
  }));
  return {
    states: all.filter((s) => s.state !== "").sort((a, b) => b.total - a.total),
    total,
    unknown: all.find((s) => s.state === "") ?? null,
  };
}

export function stateDonors(
  rows: StateBreakdownRow[],
  opts: { state: string; currency: string; recipientIds?: string[] },
): { donorEntityId: string; total: number; count: number }[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of stateInScope(rows, opts.currency, opts.recipientIds)) {
    if (r.state !== opts.state) continue;
    const cur = map.get(r.donorEntityId) ?? { total: 0, count: 0 };
    cur.total += r.total;
    cur.count += r.count;
    map.set(r.donorEntityId, cur);
  }
  return [...map.entries()]
    .map(([donorEntityId, v]) => ({ donorEntityId, ...v }))
    .sort((a, b) => b.total - a.total);
}

// ── Money graph model ─────────────────────────────────────────────────────
// The `/money` graph draws two layers: verified FEC flows (from
// `contributions`, aggregated per donor→recipient→currency) and
// hand-entered donor edges (unverified overlay). `buildMoneyGraph` merges
// them into the `{ entities, edges }` shape `EntityGraph` already consumes,
// plus a per-edge style map and flat rows for the table view.

// Green = typeColors.money border; grey = the default edge color.
export const MONEY_EDGE_COLOR = "#16A34A";
export const MANUAL_EDGE_COLOR = "#94A3B8";

export interface MoneyEdgeStyle {
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;
}

export interface MoneyGraphRow {
  donorEntityId: string;
  recipientEntityId: string;
  kind: "fec" | "manual";
  currency: string;
  total: number | null; // null for manual edges (no amount)
  count: number | null;
  firstDate: string;
  lastDate: string;
  label: string;
  notes: string;
}

export interface MoneyGraph {
  entities: Entity[];
  edges: Edge[];
  edgeStyles: Record<string, MoneyEdgeStyle>;
  rows: MoneyGraphRow[];
}

// Log-scaled so a handful of huge gifts don't flatten everything else to a
// hairline. Range ~1.25–6px.
function strokeWidthFor(total: number, min: number, max: number): number {
  if (!(max > min)) return 2.5;
  const t =
    (Math.log(total + 1) - Math.log(min + 1)) /
    (Math.log(max + 1) - Math.log(min + 1));
  return 1.25 + 4.75 * Math.max(0, Math.min(1, t));
}

export function buildMoneyGraph({
  entities,
  flows,
  manualDonorEdges,
}: {
  entities: Entity[];
  flows: ContributionFlow[];
  manualDonorEdges: Edge[];
}): MoneyGraph {
  const totals = flows.map((f) => f.total);
  const min = totals.length ? Math.min(...totals) : 0;
  const max = totals.length ? Math.max(...totals) : 0;
  const now = new Date().toISOString();

  const edges: Edge[] = [];
  const edgeStyles: Record<string, MoneyEdgeStyle> = {};
  const rows: MoneyGraphRow[] = [];
  const fecPairs = new Set<string>();

  for (const f of flows) {
    const id = `fec:${f.donorEntityId}>${f.recipientEntityId}:${f.currency}`;
    fecPairs.add(`${f.donorEntityId}>${f.recipientEntityId}`);
    const label = moneyEdgeLabel(f.total, f.count, f.currency);
    edges.push({
      id,
      sourceEntityId: f.donorEntityId,
      targetEntityId: f.recipientEntityId,
      label,
      validFrom: f.firstDate ? f.firstDate.slice(0, 10) : "",
      validTo: "",
      notes: "",
      sourceRecordId: "",
      createdAt: now,
      updatedAt: now,
    });
    edgeStyles[id] = {
      stroke: MONEY_EDGE_COLOR,
      strokeWidth: strokeWidthFor(f.total, min, max),
    };
    rows.push({
      donorEntityId: f.donorEntityId,
      recipientEntityId: f.recipientEntityId,
      kind: "fec",
      currency: f.currency,
      total: f.total,
      count: f.count,
      firstDate: f.firstDate,
      lastDate: f.lastDate,
      label,
      notes: "",
    });
  }

  // Hand-entered donor edges: keep only pairs FEC data doesn't already
  // cover, and mark them visually distinct (dashed, grey, thin).
  for (const e of manualDonorEdges) {
    if (fecPairs.has(`${e.sourceEntityId}>${e.targetEntityId}`)) continue;
    edges.push(e);
    edgeStyles[e.id] = { stroke: MANUAL_EDGE_COLOR, strokeWidth: 1.25, dashed: true };
    rows.push({
      donorEntityId: e.sourceEntityId,
      recipientEntityId: e.targetEntityId,
      kind: "manual",
      currency: "",
      total: null,
      count: null,
      firstDate: e.validFrom || "",
      lastDate: "",
      label: e.label,
      notes: e.notes || "",
    });
  }

  const connected = new Set(edges.flatMap((e) => [e.sourceEntityId, e.targetEntityId]));
  return { entities: entities.filter((e) => connected.has(e.id)), edges, edgeStyles, rows };
}

// ── Lobbying network (/money/lobbying) ───────────────────────────────────
// Aggregates LDA registrations into a client → firm graph. Bills and
// lobbyist people stay in the table/detail, not the graph, to keep it
// readable.
export const LOBBYING_EDGE_COLOR = "#0D9488"; // teal-600, matches the lobbyist entity color

export interface LobbyingGraphRow {
  clientEntityId: string;
  registrantEntityId: string;
  // LDA self-filer: the company registered its own in-house lobbying, so
  // client === registrant. Kept as a row (the spend is real) but drawn as no
  // graph edge — a self-loop reads as noise.
  inHouse: boolean;
  filings: number;
  total: number; // summed reported amount, whole USD
  firstYear: number;
  lastYear: number;
  issues: string[]; // distinct issue labels/codes across the filings
  billIds: string[]; // distinct linked bill ids
}

export interface LobbyingGraph {
  entities: Entity[];
  edges: Edge[];
  edgeStyles: Record<string, MoneyEdgeStyle>;
  rows: LobbyingGraphRow[];
}

export function buildLobbyingGraph({
  registrations,
  entities,
}: {
  registrations: LobbyingRegistration[];
  entities: Entity[];
}): LobbyingGraph {
  const agg = new Map<string, LobbyingGraphRow>();
  for (const r of registrations) {
    const key = `${r.clientEntityId}>${r.registrantEntityId}`;
    const cur =
      agg.get(key) ??
      ({
        clientEntityId: r.clientEntityId,
        registrantEntityId: r.registrantEntityId,
        inHouse: r.clientEntityId === r.registrantEntityId,
        filings: 0,
        total: 0,
        firstYear: r.year,
        lastYear: r.year,
        issues: [],
        billIds: [],
      } satisfies LobbyingGraphRow);
    cur.filings += 1;
    cur.total += r.amount ?? 0;
    cur.firstYear = Math.min(cur.firstYear, r.year);
    cur.lastYear = Math.max(cur.lastYear, r.year);
    for (const iss of r.issues) {
      const label = iss.issueLabel || iss.issueCode;
      if (label && !cur.issues.includes(label)) cur.issues.push(label);
      if (iss.billId && !cur.billIds.includes(iss.billId)) cur.billIds.push(iss.billId);
    }
    agg.set(key, cur);
  }

  const rows = [...agg.values()].sort((a, b) => b.total - a.total || b.filings - a.filings);
  const totals = rows.map((r) => r.total);
  const min = totals.length ? Math.min(...totals) : 0;
  const max = totals.length ? Math.max(...totals) : 0;
  const now = new Date().toISOString();

  const edges: Edge[] = [];
  const edgeStyles: Record<string, MoneyEdgeStyle> = {};
  for (const row of rows) {
    if (row.inHouse) continue; // no self-loop edge
    const id = `lda:${row.clientEntityId}>${row.registrantEntityId}`;
    const label =
      row.total > 0
        ? `${formatAmount(row.total, "USD")}${row.filings > 1 ? ` · ${row.filings} filings` : ""}`
        : `${row.filings} filing${row.filings === 1 ? "" : "s"}`;
    edges.push({
      id,
      sourceEntityId: row.clientEntityId,
      targetEntityId: row.registrantEntityId,
      label,
      validFrom: String(row.firstYear),
      validTo: String(row.lastYear),
      notes: row.issues.slice(0, 4).join(", "),
      sourceRecordId: "",
      createdAt: now,
      updatedAt: now,
    });
    edgeStyles[id] = {
      stroke: LOBBYING_EDGE_COLOR,
      strokeWidth:
        max > min
          ? 1.25 +
            4.75 *
              Math.max(
                0,
                Math.min(1, (Math.log(row.total + 1) - Math.log(min + 1)) / (Math.log(max + 1) - Math.log(min + 1))),
              )
          : 2.5,
    };
  }

  const connected = new Set(edges.flatMap((e) => [e.sourceEntityId, e.targetEntityId]));
  return { entities: entities.filter((e) => connected.has(e.id)), edges, edgeStyles, rows };
}
