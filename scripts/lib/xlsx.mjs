// Minimal .xlsx reader for the importers — no dependency, just the system
// `unzip` (as the EAVS importer uses) and the handful of SpreadsheetML
// parts a statistical table needs: workbook sheet names, shared strings,
// and cell values (formulas read as their cached value). Dates come back as
// Excel serial numbers; styles, merged cells, and rich formatting are
// ignored.
//
//   const book = readXlsx(buffer);      // { "Table 1": [[...], ...], ... }

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) =>
    e[0] === "#"
      ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
      : ENTITIES[e],
  );
// Concatenates every <t> run in a shared/inline string (rich text splits one
// string into several runs).
const textRuns = (xml) => decode([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));

// "BC12" -> 54 (zero-based column index)
export function columnIndex(ref) {
  let n = 0;
  for (const ch of ref.match(/^[A-Z]+/)[0]) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

export function parseSheetXml(xml, shared) {
  const rows = [];
  for (const [, rowAttrs, body] of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const r = Number(rowAttrs.match(/\br="(\d+)"/)?.[1] ?? rows.length + 1) - 1;
    const row = [];
    for (const [, attrs, inner] of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const col = ref ? columnIndex(ref) : row.length;
      const type = attrs.match(/\bt="(\w+)"/)?.[1];
      if (!inner) continue;
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = null;
      if (type === "s") value = v === undefined ? null : shared[Number(v)];
      else if (type === "inlineStr") value = textRuns(inner);
      else if (type === "str" || type === "e") value = v === undefined ? null : decode(v);
      else if (type === "b") value = v === "1";
      else if (v !== undefined) value = Number(v);
      row[col] = value;
    }
    rows[r] = Array.from(row, (c) => (c === undefined ? null : c));
  }
  return Array.from(rows, (r) => r ?? []);
}

export function readXlsx(buffer) {
  const dir = mkdtempSync(join(tmpdir(), "xlsx-"));
  const file = join(dir, "book.xlsx");
  writeFileSync(file, buffer);
  const part = (name) => {
    try {
      return execFileSync("unzip", ["-p", file, name], { maxBuffer: 512 * 1024 * 1024 }).toString("utf8");
    } catch {
      return "";
    }
  };
  try {
    const shared = [...part("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textRuns(m[1]));
    const rels = Object.fromEntries(
      [...part("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => [
        tag.match(/\bId="([^"]+)"/)[1],
        tag.match(/\bTarget="([^"]+)"/)[1].replace(/^\/?(xl\/)?/, "xl/"),
      ]),
    );
    const book = {};
    for (const [tag] of part("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)) {
      const name = decode(tag.match(/\bname="([^"]*)"/)[1]);
      const rid = tag.match(/\br:id="([^"]+)"/)[1];
      book[name] = parseSheetXml(part(rels[rid]), shared);
    }
    return book;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
