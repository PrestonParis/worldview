// Imports Federal Register documents into `executive_documents`:
//   • every presidential document (executive orders, proclamations,
//     memoranda, determinations, notices) since 1994
//   • every rule / proposed rule flagged "significant" under EO 12866
//
// Queried one year (and for rules one quarter) at a time — the API caps
// any single result set at 2,000 documents. Incremental: re-runs start
// from the latest publication date already stored minus 30 days unless
// --full.
//
// Source: https://www.federalregister.gov/developers/documentation/api/v1 —
// free, no key.
//
// Usage:
//   node scripts/import-federal-register.mjs [--full] [--from=1994] [--skip-rules]
//   ENV_FILE=.env.cloud node scripts/import-federal-register.mjs

import { arg, fetchJson, flag, int, runImport, str, upsertRows } from "./lib/bulk.mjs";

const FIELDS = [
  "document_number", "type", "subtype", "executive_order_number", "title", "abstract",
  "president", "signing_date", "publication_date", "citation", "significant",
  "agencies", "html_url", "pdf_url",
];

const SUBTYPE = {
  "Executive Order": "executive_order",
  Proclamation: "proclamation",
  Memorandum: "memorandum",
  Determination: "determination",
  Notice: "notice",
};

async function fetchRange(conditions, label) {
  const out = [];
  let url = new URL("https://www.federalregister.gov/api/v1/documents.json");
  for (const [k, v] of Object.entries(conditions)) {
    for (const x of Array.isArray(v) ? v : [v]) url.searchParams.append(k, x);
  }
  for (const f of FIELDS) url.searchParams.append("fields[]", f);
  url.searchParams.set("per_page", "1000");
  url.searchParams.set("order", "oldest");
  for (;;) {
    const page = await fetchJson(url, {}, { label });
    out.push(...(page.results ?? []));
    if (!page.next_page_url) break;
    url = new URL(page.next_page_url);
  }
  if (out.length >= 2000) console.log(`    warning: ${label} hit the 2,000 cap — narrow the window`);
  return out;
}

function toRow(d) {
  return {
    document_number: d.document_number,
    doc_type: d.type,
    subtype: d.type === "Presidential Document" ? SUBTYPE[d.subtype] ?? str(d.subtype?.toLowerCase()) : str(d.subtype),
    eo_number: int(d.executive_order_number),
    title: d.title ?? "(untitled)",
    abstract: str(d.abstract),
    president: str(d.president?.name),
    signing_date: str(d.signing_date),
    publication_date: str(d.publication_date),
    citation: str(d.citation),
    significant: d.significant ?? null,
    agencies: (d.agencies ?? []).map((a) => a.name ?? a.raw_name).filter(Boolean),
    html_url: str(d.html_url),
    pdf_url: str(d.pdf_url),
  };
}

await runImport("federal-register", async (pg) => {
  let fromYear = Number(arg("from", "1994"));
  if (!flag("full")) {
    const r = await pg.query("select max(publication_date) as d from executive_documents");
    if (r.rows[0].d) fromYear = new Date(r.rows[0].d).getFullYear();
  }
  const thisYear = new Date().getFullYear();
  console.log(`Federal Register, ${fromYear}–${thisYear}`);

  let total = 0;
  const save = async (docs) => {
    if (!docs.length) return;
    const rows = docs.map(toRow);
    total += await upsertRows(pg, "executive_documents", Object.keys(rows[0]), rows, ["document_number"]);
  };

  for (let y = fromYear; y <= thisYear; y++) {
    const pres = await fetchRange(
      {
        "conditions[type][]": "PRESDOCU",
        "conditions[publication_date][gte]": `${y}-01-01`,
        "conditions[publication_date][lte]": `${y}-12-31`,
      },
      `presidential ${y}`,
    );
    await save(pres);
    let rules = 0;
    if (!flag("skip-rules")) {
      for (const [a, b] of [["01-01", "03-31"], ["04-01", "06-30"], ["07-01", "09-30"], ["10-01", "12-31"]]) {
        const docs = await fetchRange(
          {
            "conditions[type][]": ["RULE", "PRORULE"],
            "conditions[significant]": "1",
            "conditions[publication_date][gte]": `${y}-${a}`,
            "conditions[publication_date][lte]": `${y}-${b}`,
          },
          `significant rules ${y} ${a}`,
        );
        rules += docs.length;
        await save(docs);
      }
    }
    console.log(`  ${y}: ${pres.length} presidential, ${rules} significant rules`);
  }
  return { inserted: total };
});
