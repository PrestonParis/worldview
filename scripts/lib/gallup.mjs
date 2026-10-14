// Reads trend tables from Gallup's "In Depth: Topics A to Z" pages
// (news.gallup.com/poll/<id>/<topic>.aspx) into area_stats rows. Each table
// has a caption like "Guns > Have Gun in Home Table", a header row of answer
// options, then one row per poll, newest first; a year with several polls
// keeps the latest.

const ENTITIES = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", nbsp: " " };
const unescape = (s) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? all;
  });
const text = (s) => unescape(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/**
 * @param html   the topic page
 * @param tables table title fragment -> { column header: metric }
 * @param source the area_stats source slug
 * Throws when a metric in `tables` finds no values, so a page redesign fails
 * loudly instead of loading nothing.
 */
export function parseGallupTables(html, tables, source) {
  const rows = [];
  for (const table of html.matchAll(/<table[\s\S]*?<\/table>/g)) {
    const t = table[0];
    const title = text(t.match(/<caption[\s\S]*?<\/caption>|<th[^>]*>[\s\S]*?<\/th>/)?.[0] ?? "");
    const spec = Object.entries(tables).find(([name]) => title.includes(name))?.[1];
    if (!spec) continue;
    const trs = [...t.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => [...m[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1])));
    const header = trs.find((r) => Object.keys(spec).some((k) => r.includes(k)));
    if (!header) throw new Error(`Gallup "${title}": no header row`);
    // Header rows start with a blank corner cell when data rows have a label.
    const offset = header[0] === "" ? 0 : 1;
    const seen = new Set();
    for (const r of trs) {
      const year = r[0]?.match(/^(\d{4})\b/)?.[1];
      if (!year || seen.has(year)) continue;
      seen.add(year);
      header.forEach((h, i) => {
        const metric = spec[h];
        const cell = r[i + offset];
        const value = cell && /^\d+$/.test(cell) ? Number(cell) : null;
        if (metric && value !== null) {
          rows.push({
            source, metric, geo_level: "nation", geoid: "US", geo_name: "United States", period: year, period_start: `${year}-01-01`,
            value, unit: "percent", metadata: r[0] !== year ? { poll: r[0] } : null,
          });
        }
      });
    }
  }
  // The same table can appear twice on a page; keep the first copy.
  const unique = new Map(rows.map((r) => [`${r.metric}|${r.period}`, r]));
  const metrics = new Set(rows.map((r) => r.metric));
  const missing = Object.values(tables).flatMap((s) => Object.values(s)).filter((m) => !metrics.has(m));
  if (missing.length) throw new Error(`Gallup tables missing: ${missing.join(", ")} — page layout changed?`);
  return [...unique.values()];
}
