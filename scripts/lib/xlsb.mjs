// Minimal .xlsb (Excel binary workbook) reader, the BIFF12 counterpart of
// xlsx.mjs: sheet names, shared strings, and cell values (formulas read as
// their cached value). Same output shape as readXlsx. HUD publishes its
// homelessness point-in-time counts only in this format.
//
//   const book = readXlsb(buffer);      // { "2024": [[...], ...], ... }

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Record header: type and size are little-endian base-128 varints.
function* records(buf) {
  let p = 0;
  while (p < buf.length) {
    let type = buf[p++];
    if (type & 0x80) type = (type & 0x7f) | ((buf[p++] & 0x7f) << 7);
    let size = 0;
    for (let shift = 0; shift < 28; shift += 7) {
      const b = buf[p++];
      size |= (b & 0x7f) << shift;
      if (!(b & 0x80)) break;
    }
    yield [type, p, size];
    p += size;
  }
}

const wideString = (buf, p) => {
  const n = buf.readUInt32LE(p);
  return n === 0xffffffff ? [null, p + 4] : [buf.toString("utf16le", p + 4, p + 4 + n * 2), p + 4 + n * 2];
};

const rk = (v) => {
  let n;
  if (v & 2) n = v >> 2;
  else {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(v & 0xfffffffc, 4);
    n = b.readDoubleLE(0);
  }
  return v & 1 ? n / 100 : n;
};

export function parseSheetBin(buf, shared) {
  const rows = [];
  let row = null;
  for (const [type, p] of records(buf)) {
    if (type === 0) {
      row = buf.readUInt32LE(p);
      continue;
    }
    if (type < 1 || type > 11 || row === null) continue;
    const col = buf.readUInt32LE(p);
    const at = p + 8;
    let v = null;
    switch (type) {
      case 2: v = rk(buf.readUInt32LE(at)); break;
      case 4: case 10: v = buf[at] === 1; break;
      case 5: case 9: v = buf.readDoubleLE(at); break;
      case 6: case 8: v = wideString(buf, at)[0]; break;
      case 7: v = shared[buf.readUInt32LE(at)] ?? null; break;
      default: continue;
    }
    (rows[row] ??= [])[col] = v;
  }
  return Array.from(rows, (r) => Array.from(r ?? [], (c) => c ?? null));
}

export function readXlsb(buffer) {
  const dir = mkdtempSync(join(tmpdir(), "xlsb-"));
  const file = join(dir, "book.xlsb");
  writeFileSync(file, buffer);
  const part = (name) => {
    try {
      return execFileSync("unzip", ["-p", file, name], { maxBuffer: 512 * 1024 * 1024 });
    } catch {
      return Buffer.alloc(0);
    }
  };
  try {
    const sst = part("xl/sharedStrings.bin");
    const shared = [];
    for (const [type, p] of records(sst)) if (type === 19) shared.push(wideString(sst, p + 1)[0]);
    const rels = Object.fromEntries(
      [...part("xl/_rels/workbook.bin.rels").toString("utf8").matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => [
        tag.match(/\bId="([^"]+)"/)[1],
        tag.match(/\bTarget="([^"]+)"/)[1].replace(/^\/?(xl\/)?/, "xl/"),
      ]),
    );
    const wb = part("xl/workbook.bin");
    const book = {};
    for (const [type, p] of records(wb)) {
      if (type !== 156) continue; // BrtBundleSh
      const [rid, next] = wideString(wb, p + 8);
      const [name] = wideString(wb, next);
      book[name] = parseSheetBin(part(rels[rid]), shared);
    }
    return book;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
