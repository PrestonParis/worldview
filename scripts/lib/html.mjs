// Minimal HTML reading for importers that scrape government pages: table
// cells as text, and a page as one text token per line. Regex-based — fine
// for the flat, well-formed tables CRS, Census and the UN publish; not a
// general parser.

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘" };

export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const cellText = (html) => decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

/** Every <table> on the page as rows of cell text (nested tables are not split out). */
export function htmlTables(html) {
  return [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(([, body]) =>
    [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, tr]) =>
      [...tr.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(([, td]) => cellText(td)),
    ),
  );
}

/** The page's text, one token per tag-delimited run, blanks dropped. */
export function htmlLines(html) {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
    .split(/<[^>]*>/)
    .map((s) => decodeEntities(s).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
