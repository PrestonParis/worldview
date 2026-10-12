// Parsers for Wikipedia's U.S. election overview pages ("2026 United States
// Senate elections", "... gubernatorial elections", "... House of
// Representatives elections" and "... House of Representatives election
// ratings"). Pure string -> data; scripts/sync-wiki-races.mjs does the I/O.
// Unit-tested in wiki-races.test.mjs.

// --------------------------------------------------------------- markup

// Index of the first `|` outside {{templates}} and [[links]], or -1.
function topLevelPipe(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const two = text.slice(i, i + 2);
    if (two === "{{" || two === "[[") { depth += 1; i += 1; continue; }
    if (two === "}}" || two === "]]") { depth -= 1; i += 1; continue; }
    if (text[i] === "|" && depth === 0) return i;
  }
  return -1;
}

export function stripMarkup(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/\{\{efn[^{}]*(\{\{[^{}]*\}\}[^{}]*)*\}\}/gi, "")
    .replace(/\{\{sortname\|([^|}]+)\|([^|}]+)[^}]*\}\}/gi, "$1 $2")
    .replace(/\{\{(?:small|nowrap)\|([^{}]*)\}\}/gi, "$1")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/'''?/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The table that starts after `marker` (first "{|" past it) up to its "|}".
export function tableAfter(wikitext, marker, from = 0) {
  const at = wikitext.indexOf(marker, from);
  if (at === -1) return null;
  const start = wikitext.indexOf("{|", at);
  if (start === -1) return null;
  const end = wikitext.indexOf("\n|}", start);
  return wikitext.slice(start, end === -1 ? undefined : end);
}

// Rows of a wikitable, each a list of cells { header, raw, text }. A cell
// starts at a line beginning with "|" or "!"; following lines (bulleted
// candidate lists) belong to it. Attributes before a top-level "|" drop.
export function tableRows(table) {
  return table
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\n\|-[^\n]*/)
    .slice(1)
    .map((row) => {
      const cells = [];
      for (const line of row.split("\n")) {
        const trimmed = line.trimStart();
        if (/^[|!]/.test(trimmed) && !/^\|[}+]/.test(trimmed)) {
          const header = trimmed[0] === "!";
          let body = trimmed.slice(1);
          const pipe = topLevelPipe(body);
          if (pipe !== -1 && !/^\s*\{\{\s*(?:plainlist|Plainlist)/.test(body)) body = body.slice(pipe + 1);
          cells.push({ header, raw: body });
        } else if (cells.length) {
          cells[cells.length - 1].raw += `\n${line}`;
        }
      }
      return cells.map((cell) => ({ ...cell, text: stripMarkup(cell.raw) }));
    })
    .filter((cells) => cells.length > 0);
}

// --------------------------------------------------------------- races

// Header cell -> race key: "GA", "OH:special", "CO-01", "AK-AL".
export function raceKeyFromCell(raw, stateAbbr) {
  const ushr = raw.match(/\{\{ushr\|([A-Z]{2})\|(\w+)\|/i);
  if (ushr) {
    const district = /^\d+$/.test(ushr[2]) ? ushr[2].padStart(2, "0") : "AL";
    return `${ushr[1].toUpperCase()}-${district}`;
  }
  const link = raw.match(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/);
  if (!link) return null;
  const target = link[1];
  const name = stripMarkup(link[2] ?? link[1]).replace(/\s*\(special\)\s*$/i, "");
  const abbr = stateAbbr[name] ?? stateAbbr[target.match(/(?:in|of) ([A-Z][\w .]+?)$/)?.[1] ?? ""];
  const named = target.match(/(\d{4}) ([A-Z][\w .]+?) gubernatorial election/);
  const state = abbr ?? (named ? stateAbbr[named[2]] : null);
  if (!state) return null;
  return /special/i.test(target) || /special/i.test(raw) ? `${state}:special` : state;
}

const PARTY_NAMES = /\(([^()]*)\)\s*$/;

// Bulleted "{{Party stripe|...}}Name (Party)" lines -> [{ name, party, link }].
export function parseCandidates(raw) {
  const out = [];
  // The first bullet sometimes shares a line with "{{Plainlist |".
  for (const line of raw.replace(/\*+\s*\{\{Party stripe/gi, "\n*{{Party stripe").split("\n")) {
    if (!/^\s*\*/.test(line) || !/party stripe/i.test(line)) continue;
    const body = line
      .replace(/^\s*\*+\s*/, "")
      .replace(/\{\{Party stripe\|[^}]*\}\}/gi, "")
      .replace(/<ref[^>]*\/>/g, "")
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");
    const link = body.match(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/)?.[1]?.trim() ?? null;
    const text = stripMarkup(body);
    const party = text.match(PARTY_NAMES)?.[1]?.trim() ?? "";
    const name = text.replace(PARTY_NAMES, "").replace(/\s*\(write-in\)\s*$/i, "").trim();
    if (name) out.push({ name, party, link });
  }
  return out;
}

// {{sortname|First|Last|dab=...}} -> { name, link }.
export function parseIncumbent(raw) {
  const match = raw.match(/\{\{sortname\|([^|}]+)\|([^|}]+)((?:\|[^}]*)?)\}\}/i);
  if (!match) {
    // Some tables link the senator directly: [[Ashley Moody]].
    const link = raw.trim().match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/);
    return link ? { name: (link[2] ?? link[1]).trim(), link: link[1].trim() } : null;
  }
  const name = `${match[1].trim()} ${match[2].trim()}`;
  const dab = match[3].match(/dab=([^|}]+)/)?.[1]?.trim();
  return { name, link: dab ? `${name} (${dab})` : name };
}

// One row of a race-summary table (Senate / governor "Race summary", or a
// House state section). Returns null for rows that are not races.
export function parseRaceRow(cells, stateAbbr) {
  const head = cells.find((cell) => cell.header);
  if (!head) return null;
  const key = raceKeyFromCell(head.raw, stateAbbr);
  if (!key) return null;
  const candidatesCell = cells.find((cell) => /party stripe/i.test(cell.raw));
  if (!candidatesCell) return null;
  const incumbentCell =
    cells.find((cell) => /\{\{sortname/i.test(cell.raw)) ??
    cells.find((cell) => !cell.header && /^\s*\[\[[^\]]+\]\]\s*$/.test(cell.raw));
  const statusCell = cells.find((cell) => /incumbent|new seat|vacant|open seat/i.test(cell.text) && cell !== incumbentCell);
  return {
    key,
    incumbent: incumbentCell ? parseIncumbent(incumbentCell.raw) : null,
    status: statusCell?.text ?? "",
    candidates: parseCandidates(candidatesCell.raw),
  };
}

// --------------------------------------------------------------- ratings

const RATING_SOURCES = [
  { id: "cook", pattern: /\bCook\b/ },
  { id: "inside-elections", pattern: /\bIE\b|Inside Elections/ },
  { id: "sabato", pattern: /\bSabato\b/ },
];
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

function headerDate(text) {
  const match = text.match(/([A-Z][a-z]{2,4})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  return month ? `${match[3]}-${String(month).padStart(2, "0")}-${match[2].padStart(2, "0")}` : null;
}

// {{USRaceRating|Lean|R|Flip}} -> "lean_r"; Tilt counts as lean, Solid as safe.
export function parseRating(raw) {
  const match = raw.match(/\{\{USRaceRating\|([^|}]+)(?:\|([^|}]+))?/i);
  if (!match) return null;
  const level = match[1].trim().toLowerCase();
  if (/toss/.test(level)) return "tossup";
  const party = (match[2] ?? "").trim().toUpperCase()[0];
  if (!["D", "R", "I"].includes(party)) return null;
  const strength = /safe|solid/.test(level) ? "safe" : /likely/.test(level) ? "likely" : /lean|tilt/.test(level) ? "lean" : null;
  if (!strength) return null;
  if (party === "I") return strength === "safe" ? "safe_i" : null;
  return `${strength}_${party.toLowerCase()}`;
}

// A ratings table -> [{ key, ratings: [{ source, rating, asOf }] }] for the
// three long-running handicappers (Cook, Inside Elections, Sabato). Columns
// are matched by header name, so their order on the page does not matter.
export function parseRatingsTable(table, stateAbbr) {
  const rows = tableRows(table);
  const headerRow = rows.find((cells) => cells.filter((cell) => cell.header && headerDate(cell.text)).length >= 2);
  if (!headerRow) return [];
  const columns = headerRow
    .filter((cell) => cell.header && headerDate(cell.text))
    .map((cell) => ({
      source: RATING_SOURCES.find((item) => item.pattern.test(cell.text))?.id ?? null,
      asOf: headerDate(cell.text),
    }));
  const out = [];
  for (const cells of rows) {
    const head = cells.find((cell) => cell.header);
    const key = head ? raceKeyFromCell(head.raw, stateAbbr) : null;
    if (!key) continue;
    const ratingCells = cells.filter((cell) => /USRaceRating/i.test(cell.raw));
    const ratings = ratingCells
      .map((cell, index) => ({ ...columns[index], rating: parseRating(cell.raw) }))
      .filter((item) => item.source && item.rating && item.asOf);
    if (ratings.length) out.push({ key, ratings });
  }
  return out;
}
