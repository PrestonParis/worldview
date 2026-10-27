// Year spans from the Atlas's free-text dates ("1939–1975", "c. 1474",
// "1920s", "2019–present"). Anything unreadable is null, never guessed, and
// stays off the timelines.

export interface YearSpan {
  start: number;
  end: number;
}

const BCE = /\b(BCE|BC)\b/i;

export function parseYearSpan(text: string, now = new Date().getFullYear()): YearSpan | null {
  if (!text) return null;
  const sign = BCE.test(text) ? -1 : 1;
  const decade = text.match(/\b(\d{3,4})s\b/);
  const years = [...text.matchAll(/\b(\d{3,4})s?\b/g)].map((m) => sign * Number(m[1]));
  if (years.length === 0) return null;
  const start = years[0];
  let end = years.length > 1 ? years[years.length - 1] : start;
  if (/present|today|now/i.test(text)) end = now;
  else if (years.length === 1 && decade) end = start + 9;
  if (end < start && sign === 1) return null;
  return sign === -1 ? { start: Math.min(start, end), end: Math.max(start, end) } : { start, end };
}

export const formatYear = (y: number) => (y < 0 ? `${-y} BCE` : String(y));
