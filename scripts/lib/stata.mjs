// Minimal reader for Stata .dta files, formats 118 and 119 (Stata 14+), as
// distributed by NORC (GSS) and ANES. Reads only the requested variables,
// so a 600 MB cumulative file loads in seconds. Strings longer than the
// fixed-width limit (strL) are not decoded. Missing values (. and .a–.z)
// come back as null.
//
// readDta(buffer, ["year", "abany"]) →
//   { n, columns: { year: [...], abany: [...] }, labels: { abany: { 1: "yes", ... } },
//     varLabels: { abany: "..." }, names: [...every variable], missing: [...] }

const TAG = (buf, pos, name) => {
  const open = `<${name}>`;
  if (buf.toString("latin1", pos, pos + open.length) !== open) throw new Error(`dta: expected ${open} at ${pos}`);
  return pos + open.length;
};

// Numeric missing thresholds (values above are missing).
const MISSING = { byte: 100, int: 32740, long: 2147483620 };

function typeOf(code) {
  if (code >= 1 && code <= 2045) return { kind: "str", width: code };
  switch (code) {
    case 32768: return { kind: "strl", width: 8 };
    case 65526: return { kind: "double", width: 8 };
    case 65527: return { kind: "float", width: 4 };
    case 65528: return { kind: "long", width: 4 };
    case 65529: return { kind: "int", width: 2 };
    case 65530: return { kind: "byte", width: 1 };
    default: throw new Error(`dta: unknown variable type ${code}`);
  }
}

const cstr = (buf, start, len) => {
  const end = buf.indexOf(0, start);
  return buf.toString("utf8", start, end >= 0 && end < start + len ? end : start + len);
};

export function readDta(buf, wanted) {
  let p = TAG(buf, 0, "stata_dta");
  p = TAG(buf, p, "header");
  p = TAG(buf, p, "release");
  const release = Number(buf.toString("latin1", p, p + 3));
  if (release !== 118 && release !== 119) throw new Error(`dta: unsupported release ${release}`);
  p += 3 + "</release>".length;
  p = TAG(buf, p, "byteorder");
  const le = buf.toString("latin1", p, p + 3) === "LSF";
  if (!le) throw new Error("dta: big-endian files are not supported");
  p += 3 + "</byteorder>".length;
  p = TAG(buf, p, "K");
  const K = release === 119 ? buf.readUInt32LE(p) : buf.readUInt16LE(p);
  p += (release === 119 ? 4 : 2) + "</K>".length;
  p = TAG(buf, p, "N");
  const N = Number(buf.readBigUInt64LE(p));
  p = buf.indexOf("<map>", p, "latin1") + 5;
  const map = Array.from({ length: 14 }, (_, i) => Number(buf.readBigUInt64LE(p + i * 8)));
  const [, , oTypes, oNames, , , oVlNames, oVarLabels, , oData, , oValueLabels] = map;

  const types = Array.from({ length: K }, (_, i) => typeOf(buf.readUInt16LE(TAG(buf, oTypes, "variable_types") + i * 2)));
  const namesAt = TAG(buf, oNames, "varnames");
  const names = Array.from({ length: K }, (_, i) => cstr(buf, namesAt + i * 129, 129));
  const vlAt = TAG(buf, oVlNames, "value_label_names");
  const vlNames = Array.from({ length: K }, (_, i) => cstr(buf, vlAt + i * 129, 129));
  const labAt = TAG(buf, oVarLabels, "variable_labels");
  const offsets = [];
  let rowWidth = 0;
  for (const t of types) {
    offsets.push(rowWidth);
    rowWidth += t.width;
  }

  const idx = wanted.map((w) => names.indexOf(w));
  const columns = {};
  const varLabels = {};
  const dataAt = TAG(buf, oData, "data");
  wanted.forEach((w, j) => {
    const i = idx[j];
    if (i < 0) return;
    varLabels[w] = cstr(buf, labAt + i * 321, 321);
    const { kind, width } = types[i];
    const col = new Array(N);
    for (let r = 0, at = dataAt + offsets[i]; r < N; r++, at += rowWidth) {
      let v;
      if (kind === "byte") { v = buf.readInt8(at); v = v > MISSING.byte ? null : v; }
      else if (kind === "int") { v = buf.readInt16LE(at); v = v > MISSING.int ? null : v; }
      else if (kind === "long") { v = buf.readInt32LE(at); v = v > MISSING.long ? null : v; }
      else if (kind === "float") { v = buf.readFloatLE(at); v = v > 1.7014117e38 ? null : v; }
      else if (kind === "double") { v = buf.readDoubleLE(at); v = v > 8.988465674311579e307 ? null : v; }
      else if (kind === "str") v = cstr(buf, at, width);
      else v = null;
      col[r] = v;
    }
    columns[w] = col;
  });

  // Value labels: <lbl> len(int32) name(129) pad(3) n(int32) txtlen(int32) off[n] val[n] txt
  const tables = {};
  let q = TAG(buf, oValueLabels, "value_labels");
  while (buf.toString("latin1", q, q + 5) === "<lbl>") {
    q += 5;
    const len = buf.readInt32LE(q);
    const name = cstr(buf, q + 4, 129);
    const t = q + 4 + 129 + 3;
    const n = buf.readInt32LE(t);
    const txtAt = t + 8 + n * 8;
    const table = {};
    for (let k = 0; k < n; k++) {
      const off = buf.readInt32LE(t + 8 + k * 4);
      const val = buf.readInt32LE(t + 8 + n * 4 + k * 4);
      table[val] = cstr(buf, txtAt + off, len);
    }
    tables[name] = table;
    q += 4 + 129 + 3 + len + "</lbl>".length;
  }
  const labels = {};
  wanted.forEach((w, j) => {
    if (idx[j] >= 0 && vlNames[idx[j]]) labels[w] = tables[vlNames[idx[j]]] ?? {};
  });
  return { n: N, columns, labels, varLabels, names, missing: wanted.filter((_, j) => idx[j] < 0) };
}
