// The People page's lead visual: every group of political actors in the
// graph, split left and right. Pure, so the grouping is unit-tested.

import { isCurated, leanOf } from "../graph/lean";
import { parseEntityMetadata, publicEntityPath } from "./public";
import type { AtlasMember } from "./atlas";
import type { Entity } from "../validation/entity";

export type SpectrumSide = "liberal" | "conservative" | "unplaced";

export interface SpectrumItem {
  id: string;
  name: string;
  href: string;
  side: SpectrumSide;
  // Shown after the name: a PAC's spending.
  note?: string;
}

export interface SpectrumRow {
  key: string;
  label: string;
  counts: Record<SpectrumSide, number>;
  // Attribute-explorer filter for everyone in this row.
  filter: { row?: string; group?: string };
  // Shown by name. Large groups list only their leading members
  // (`itemsLabel` says which); the counts cover everyone.
  items: SpectrumItem[];
  itemsLabel?: string;
}

export type RowKey = "executive" | "court" | "state" | "pundit" | "journalist" | "outlets" | "donors" | "money";

// Old links named the executive row "administration".
export function parseRowKey(value: string | undefined): RowKey | undefined {
  if (value === "administration") return "executive";
  return SPECTRUM_ROWS.some((row) => row.key === value) ? (value as RowKey) : undefined;
}

export const SPECTRUM_ROWS: { key: RowKey; label: string; itemsLabel?: string }[] = [
  { key: "executive", label: "Executive branch" },
  { key: "court", label: "Supreme Court" },
  { key: "state", label: "Governors & state officials", itemsLabel: "Governors" },
  { key: "pundit", label: "Commentators" },
  { key: "journalist", label: "Journalists" },
  { key: "outlets", label: "Outlets & movement groups" },
  { key: "donors", label: "Megadonors" },
  { key: "money", label: "PACs & companies", itemsLabel: "Biggest spenders, 2022–2026" },
];

const TOP_SPENDERS = 15;

const isGovernor = (entity: Pick<Entity, "description">) =>
  /\bgovernor\b/i.test(entity.description ?? "") && !/\b(lieutenant|lt\.?) governor/i.test(entity.description ?? "");

function metaNumber(entity: Pick<Entity, "metadata">, key: string): number {
  try {
    const value = (JSON.parse(entity.metadata || "{}") as Record<string, unknown>)[key];
    return typeof value === "number" ? value : 0;
  } catch {
    return 0;
  }
}

const money = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${n}`;

function source(entity: Pick<Entity, "metadata">): string {
  try {
    const meta = JSON.parse(entity.metadata || "{}") as { source?: unknown; importedFrom?: unknown };
    return String(meta.source ?? meta.importedFrom ?? "");
  } catch {
    return "";
  }
}

// Which row an entity belongs to, or null for those the spectrum leaves
// to the attribute explorer: members of Congress (drawn from Voteview instead),
// candidates, and institutions with no side. The executive row is whoever
// scripts/import-administration.mjs stamped as serving now, members of
// Congress who joined the cabinet included.
export function spectrumRowOf(entity: Entity): RowKey | null {
  if (entity.type === "judge") return parseEntityMetadata(entity.metadata).office ? "court" : null;
  if (entity.type === "politician") {
    if (entity.metadata?.includes('"branch"') && parseEntityMetadata(entity.metadata).branch === "executive") return "executive";
    // Before the Bioguide check: a governor who once sat in Congress holds
    // both records.
    if (source(entity) === "openstates" || isGovernor(entity)) return "state";
    return null;
  }
  if (entity.type === "pundit" || entity.type === "journalist") return entity.type;
  if (entity.type === "donor") return source(entity) ? null : "donors"; // FEC-scraped individuals aren't megadonors
  if (entity.type === "organization" && isCurated(entity)) return "outlets";
  if ((entity.type === "organization" || entity.type === "company") && leanOf(entity)) return "money";
  return null;
}

// Justices have no party; the Court row splits them by the party of the
// president who appointed them.
function appointedSide(entity: Entity): SpectrumSide | null {
  const party = String(parseEntityMetadata(entity.metadata).appointingParty ?? "").toLowerCase();
  return party.startsWith("republican") ? "conservative" : party.startsWith("democrat") ? "liberal" : null;
}

export function buildSpectrum(entities: Entity[], congress: AtlasMember[] | null): SpectrumRow[] {
  const rows = new Map<RowKey, SpectrumRow>(
    SPECTRUM_ROWS.map((row) => [
      row.key,
      {
        key: row.key,
        label: row.label,
        counts: { liberal: 0, conservative: 0, unplaced: 0 },
        filter: { row: row.key },
        items: [],
        itemsLabel: row.itemsLabel,
      },
    ]),
  );
  const spenders: { item: SpectrumItem; total: number }[] = [];
  for (const entity of entities) {
    const key = spectrumRowOf(entity);
    if (!key) continue;
    const side: SpectrumSide = (key === "court" ? appointedSide(entity) : leanOf(entity)) ?? "unplaced";
    const row = rows.get(key)!;
    row.counts[side]++;
    const item = { id: entity.id, name: entity.name, href: publicEntityPath(entity), side };
    if (key === "money") {
      const total = metaNumber(entity, "leanTotal");
      if (total) spenders.push({ item: { ...item, note: money(total) }, total });
    } else if (key !== "state" || isGovernor(entity)) {
      row.items.push(item);
    }
  }
  for (const row of rows.values()) row.items.sort((a, b) => a.name.localeCompare(b.name));
  // Governors are held twice (Open States' executive record and the
  // hand-entered one); list each person once.
  const state = rows.get("state")!;
  state.items = state.items.filter((item, i, list) => i === 0 || list[i - 1].name !== item.name);
  spenders.sort((a, b) => b.total - a.total);
  for (const side of ["liberal", "conservative"] as const) {
    rows.get("money")!.items.push(...spenders.filter((s) => s.item.side === side).slice(0, TOP_SPENDERS).map((s) => s.item));
  }

  const out = [...rows.values()];
  if (congress?.length) {
    const counts = { liberal: 0, conservative: 0, unplaced: 0 };
    for (const m of congress) counts[m.party === "D" ? "liberal" : m.party === "R" ? "conservative" : "unplaced"]++;
    out.unshift({ key: "congress", label: "Congress", counts, filter: { group: "politicians" }, items: [] });
  }
  return out;
}
