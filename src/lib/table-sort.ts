// Sorting for every data table. Table views are built from already-formatted
// strings ("$1.2M", "Aug 2026", "FY 2024", "34.5%"), so sortKey reads those
// back into something comparable: a number, a period position, or text.

export type SortValue = string | number | null;
export type SortDir = 1 | -1;

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };

// Number written by formatValue / formatSigned: "1,234", "$1.2M", "−3.4%",
// "+12", "56.7". Null when the text isn't purely a number.
function parseNumber(s: string): number | null {
  const m = /^([+\-−]?)\$?([\d,]*\.?\d+)\s*([KMBT])?%?$/i.exec(s);
  if (!m) return null;
  const n = Number(m[2].replace(/,/g, "")) * (m[3] ? SUFFIX[m[3].toLowerCase()] : 1);
  return m[1] === "-" || m[1] === "−" ? -n : n;
}

// "2024", "FY 2024", "Aug 2026", "Q3 2025", "Jan 5, 2026", "2026-08-01",
// "2025–26" -> a position in time (fractional years). Null otherwise.
function parsePeriod(s: string): number | null {
  let m = /^(?:FY\s?)?(\d{4})(?:[–-]\d{2,4})?$/.exec(s);
  if (m) return Number(m[1]);
  m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s);
  if (m) return Number(m[1]) + (Number(m[2]) - 1) / 12 + (m[3] ? (Number(m[3]) - 1) / 372 : 0);
  m = /^Q([1-4])\s+(\d{4})$/.exec(s);
  if (m) return Number(m[2]) + (Number(m[1]) - 1) / 4;
  m = /^([A-Za-z]{3})[a-z]*\.?\s+(?:(\d{1,2}),?\s+)?(\d{4})$/.exec(s);
  if (m && m[1].toLowerCase() in MONTHS) return Number(m[3]) + MONTHS[m[1].toLowerCase()] / 12 + (m[2] ? (Number(m[2]) - 1) / 372 : 0);
  return null;
}

// Comparable key for one cell. Empty and "—" cells are null (always last).
export function sortKey(v: unknown): SortValue {
  if (v === null || v === undefined || typeof v === "boolean") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || s === "—" || s === "-" || s === "N/A") return null;
  return parseNumber(s) ?? parsePeriod(s) ?? s.toLowerCase();
}

// Numbers before text; nulls last whichever way the column is sorted.
export function compareKeys(a: SortValue, b: SortValue, dir: SortDir): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * dir;
  if (typeof a === "number") return -1;
  if (typeof b === "number") return 1;
  return a.localeCompare(b, "en", { numeric: true }) * dir;
}

// Sensible first click: biggest/latest first for numbers, A→Z for text.
export function defaultDir(keys: SortValue[]): SortDir {
  return keys.some((k) => typeof k === "number") && !keys.some((k) => typeof k === "string") ? -1 : 1;
}

// Stable sort of rows by one column's keys; original order breaks ties.
export function sortRows<T>(rows: T[], key: (row: T) => SortValue, dir: SortDir): T[] {
  return rows
    .map((row, i) => ({ row, i, k: key(row) }))
    .sort((a, b) => compareKeys(a.k, b.k, dir) || a.i - b.i)
    .map((x) => x.row);
}
