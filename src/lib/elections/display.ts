import { partyLetter } from "./overview";
import type { Candidacy } from "../validation/candidacy";

const SUFFIXES = new Set(["Jr", "Sr", "II", "III", "IV", "V"]);
const SMALL = new Set(["de", "del", "la", "van", "von"]);
const DISPLAY_ALIASES: Record<string, string> = {
  "t jonathan ossoff": "Jon Ossoff",
  "michael a collins jr": "Mike Collins",
  "michael dr mike katz": "Mike Katz",
};

function titleWord(word: string, index: number): string {
  const plain = word.replace(/[.,]/g, "");
  const upper = plain.toUpperCase();
  if (SUFFIXES.has(upper === "JR" ? "Jr" : upper === "SR" ? "Sr" : upper)) {
    const suffix = upper === "JR" ? "Jr." : upper === "SR" ? "Sr." : upper;
    return word.endsWith(",") ? `${suffix},` : suffix;
  }
  if (index > 0 && SMALL.has(plain.toLowerCase())) return plain.toLowerCase();
  if (/^[A-Z]$/.test(plain)) return `${plain}.`;
  return word.toLowerCase().replace(/(^|[-'])\p{L}/gu, (letter) => letter.toUpperCase());
}

export function normalizeCandidateName(raw: string): string {
  let value = raw.replace(/\s+/g, " ").trim();
  if (!value) return "Unknown candidate";
  if (value.includes(",")) {
    const [last, ...rest] = value.split(",");
    const given = rest.join(" ").trim().split(/\s+/).filter(Boolean);
    const maybeSuffix = given.at(-1)?.replace(/[.,]/g, "").toUpperCase() ?? "";
    const suffix = ["JR", "SR", "II", "III", "IV", "V"].includes(maybeSuffix) ? given.pop() : null;
    value = `${given.join(" ")} ${last.trim()}${suffix ? ` ${suffix}` : ""}`.trim();
  }
  const nickname = value.match(/"([^"]+)"/);
  const words = value.replace(/"[^"]+"/g, " ").replace(/\s+/g, " ").trim().split(" ");
  const last = words.at(-1) ?? "";
  if (nickname && last) return `${titleWord(nickname[1], 0)} ${titleWord(last, 1)}`;
  const titled = words.map(titleWord).join(" ");
  const aliasKey = titled.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  return DISPLAY_ALIASES[aliasKey] ?? titled;
}

export function candidateIdentityKey(name: string): string {
  const normalized = normalizeCandidateName(name).toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const words = normalized.split(/\s+/).filter(Boolean).filter((word) => !["jr", "sr", "ii", "iii", "iv", "v"].includes(word));
  return words.length > 1 ? `${words[0]} ${words.at(-1)}` : words.join(" ");
}

export function normalizePartyName(raw: string): string {
  const letter = partyLetter(raw);
  if (letter === "D") return "Democratic";
  if (letter === "R") return "Republican";
  if (letter === "I") return "Independent";
  if (!raw.trim()) return "Unaffiliated";
  return raw.replace(/\s+party$/i, "").split(/\s+/).map(titleWord).join(" ");
}

function candidateStage(candidacy: Candidacy): number {
  if (candidacy.withdrew || candidacy.status === "withdrew") return 0;
  if (candidacy.status === "nominee") return 5;
  if (candidacy.status === "primary_winner") return 4;
  if (candidacy.status === "filed") return 3;
  if (candidacy.status === "lost_primary") return 1;
  return 2;
}

// One row per person: a race can carry a scaffold row and an FEC filing for
// the same candidate. Keeps the furthest-along candidacy, preferring incumbents.
export function dedupeCandidacies(candidacies: Candidacy[], nameFor: (entityId: string) => string): Candidacy[] {
  const unique = new Map<string, Candidacy>();
  for (const candidacy of candidacies) {
    const key = candidateIdentityKey(nameFor(candidacy.candidateEntityId));
    const existing = unique.get(key);
    if (!existing || candidateStage(candidacy) > candidateStage(existing) || (candidacy.incumbent && !existing.incumbent)) unique.set(key, candidacy);
  }
  return [...unique.values()];
}
