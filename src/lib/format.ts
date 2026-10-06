// Number formatting for statistics, keyed by the `unit` stored with each
// area_stats row.

export type Unit = "people" | "encounters" | "offenses" | "per_100k" | "per_1000" | "percent" | "usd" | "days" | string;

const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const oneDp = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatNumber(value: number, { compact = false }: { compact?: boolean } = {}): string {
  if (compact && Math.abs(value) >= 10_000) return compactFmt.format(value);
  return intFmt.format(value);
}

export function formatValue(value: number | null | undefined, unit?: Unit, opts: { compact?: boolean } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  switch (unit) {
    case "percent":
      return `${oneDp.format(value)}%`;
    case "per_100k":
    case "per_1000":
    case "days":
      return oneDp.format(value);
    case "usd":
      return `$${formatNumber(value, opts)}`;
    default:
      return formatNumber(value, opts);
  }
}

export function formatSigned(value: number, unit?: Unit, opts: { compact?: boolean } = {}): string {
  const s = formatValue(Math.abs(value), unit, opts);
  return value > 0 ? `+${s}` : value < 0 ? `−${s}` : s;
}

// Percent change, or null when the base is zero/missing.
export function pctChange(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || !previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-08" -> "Aug 2026", "FY2024" -> "FY 2024", "2025" -> "2025"
export function formatPeriod(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  const fy = /^FY(\d{4})$/.exec(period);
  if (fy) return `FY ${fy[1]}`;
  return period;
}

// Numeric x position for a period: years as-is, months as fractional years.
export function periodToX(period: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) return Number(m[1]) + (Number(m[2]) - 1) / 12;
  const y = /(\d{4})/.exec(period);
  return y ? Number(y[1]) : NaN;
}

const SMALL = new Set(["of", "and", "the", "for", "in", "on", "at", "de", "del"]);
const KEEP_UPPER = new Set(["ICE", "US", "USA", "ERO", "CDF", "IGA", "USMS", "II", "III", "IV"]);

// Source files that shout ("CHINA, PEOPLES REPUBLIC", "STEWART DETENTION
// CENTER") -> "China, Peoples Republic". Mixed-case text is left alone.
export function tidyLabel(s: string): string {
  if (/[a-z]/.test(s)) return s;
  return s
    .toLowerCase()
    .split(/(\s+|-|\/)/)
    .map((w, i) => {
      const up = w.toUpperCase();
      if (KEEP_UPPER.has(up.replace(/[^A-Z]/g, ""))) return up;
      if (i > 0 && SMALL.has(w)) return w;
      return w.replace(/^([("']?)(\p{L})/u, (_, p: string, c: string) => p + c.toUpperCase());
    })
    .join("");
}
