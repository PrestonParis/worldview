import { MONEY_COLORS, partyColor as partyColorOf } from "@/lib/money/semantic";

export interface FlowCandidate {
  id: string;
  name: string;
  party: string;
  state: string;
  office: string;
  district: string;
  receipts: number;
  disbursements: number;
  cashOnHand: number;
  individual: number;
  pac: number;
  party_: number;
}

export interface FlowDonor {
  name: string;
  industry: string;
  total: number;
  count: number;
}

export type SourceKey = "individual" | "pac" | "party_" | "other";

export const SOURCES: { key: SourceKey; label: string; short: string; color: string }[] = [
  { key: "individual", label: "Individual donors", short: "Individuals", color: MONEY_COLORS.individual },
  { key: "pac", label: "PACs & other committees", short: "PACs", color: MONEY_COLORS.pac },
  { key: "party_", label: "Party committees", short: "Party", color: MONEY_COLORS.party },
  { key: "other", label: "Transfers, loans & other", short: "Other", color: MONEY_COLORS.other },
];

export const PARTIES = [
  { code: "DEM", label: "Democratic", color: partyColorOf("DEM") },
  { code: "REP", label: "Republican", color: partyColorOf("REP") },
] as const;

export type PartyCode = (typeof PARTIES)[number]["code"];

export const otherOf = (candidate: FlowCandidate) =>
  Math.max(0, candidate.receipts - candidate.individual - candidate.pac - candidate.party_);

export const valueOf = (candidate: FlowCandidate, source: SourceKey) =>
  source === "other" ? otherOf(candidate) : candidate[source];

export function race(candidate: FlowCandidate) {
  const seat =
    candidate.office === "S"
      ? "Senate"
      : candidate.office === "H"
        ? `House${candidate.district && candidate.district !== "00" ? ` ${candidate.district}` : ""}`
        : candidate.office;
  return [candidate.state, seat].filter(Boolean).join(" ");
}

/** The scatter's log x-domain: from the power of ten below min to just past
 *  max, with a tick at each power of ten inside it. */
export function logDomain(min: number, max: number): { lo: number; hi: number; ticks: number[] } {
  const lo = 10 ** Math.floor(Math.log10(Math.max(1, min)));
  const hi = Math.max(lo * 10, max * 1.25);
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t *= 10) ticks.push(t);
  return { lo, hi, ticks };
}

export interface LabelSeed {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface PlacedLabel extends LabelSeed {
  anchor: "start" | "end";
  lx: number;
}

// Places labels in priority order beside their dot (right, or left when it
// would run off the plot), skipping any whose box overlaps one already placed.
export function placeLabels(
  seeds: LabelSeed[],
  bounds: { left: number; right: number },
  limit: number,
  charW = 6.4,
  lineH = 14,
): PlacedLabel[] {
  const placed: (PlacedLabel & { box: [number, number, number, number] })[] = [];
  const seen = new Set<string>();
  for (const seed of seeds) {
    if (placed.length >= limit) break;
    if (seen.has(seed.id)) continue;
    seen.add(seed.id);
    const w = seed.text.length * charW;
    const toRight = seed.x + 7 + w <= bounds.right;
    const lx = toRight ? seed.x + 7 : seed.x - 7;
    const x0 = toRight ? lx : lx - w;
    if (x0 < bounds.left) continue;
    const box: [number, number, number, number] = [x0, seed.y - lineH / 2, x0 + w, seed.y + lineH / 2];
    const hit = placed.some((p) => box[0] < p.box[2] && box[2] > p.box[0] && box[1] < p.box[3] && box[3] > p.box[1]);
    if (hit) continue;
    placed.push({ ...seed, anchor: toRight ? "start" : "end", lx, box });
  }
  return placed.map(({ id, x, y, text, anchor, lx }) => ({ id, x, y, text, anchor, lx }));
}
