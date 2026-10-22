// Small derivations the profile pages share: resolving source ids to records,
// the hero's roles and the key-facts strip. Every number here is computed
// from the bundle's records, never typed into prose.

import { parseEntityMetadata, entityPartyAndPlace, typeLabels } from "./public";
import { ageOnDate } from "./profile";
import { traitFacts, traitSourceLabels } from "./traits";
import { formatPartialDate, formatUsd, partyName, summarizeGiving, type RelationshipRecord, type SourceRecord } from "./profile-model";
import { relationshipCategoryOf, relationshipTypeBySlug, type RelationshipCategory } from "../relationships";
import type { ProfileBundle } from "../db/profile-records";

export function sourcesFor(bundle: ProfileBundle, ids: string[]): SourceRecord[] {
  return [...new Set(ids)].flatMap((id) => bundle.sources.get(id) ?? []);
}

export function sourcesByKey(bundle: ProfileBundle): Map<string, SourceRecord> {
  return new Map([...bundle.sources.values()].filter((s) => s.key).map((s) => [s.key, s]));
}

export function nameOf(bundle: ProfileBundle, id: string): string {
  return bundle.entities.get(id)?.name ?? "Unknown";
}

export interface HeroRole {
  label: string;
  detail: string;
}

export function heroRoles(bundle: ProfileBundle): HeroRole[] {
  if (bundle.editorial?.roles.length) return bundle.editorial.roles.map((r) => ({ label: r.label, detail: r.detail }));
  const metadata = parseEntityMetadata(bundle.entity.metadata);
  const roles: HeroRole[] = [{ label: typeLabels[bundle.entity.type] ?? bundle.entity.type, detail: "" }];
  if (officeLabel(metadata)) roles.push({ label: officeLabel(metadata), detail: "" });
  return roles;
}

export interface KeyFact {
  label: string;
  value: string;
  note: string;
  href?: string;
}

// At most five facts that tell a newcomer the most: what the person has run,
// what they have given, what they are worth (dated), when they were born.
export function keyFacts(bundle: ProfileBundle, base: string): KeyFact[] {
  const { entity } = bundle;
  const metadata = parseEntityMetadata(entity.metadata);
  const facts: KeyFact[] = [];
  const { party, place } = entityPartyAndPlace(entity);

  if (officeLabel(metadata)) {
    facts.push({ label: "Office", value: officeLabel(metadata), note: [party, place].filter(Boolean).join(" · ") });
  }

  const founded = bundle.relationships.filter(
    (r) => r.sourceEntityId === entity.id && (r.relType === "co-founded" || r.relType === "founded") && r.prominence >= 2,
  );
  if (founded.length) {
    const names = founded.map((r) => bundle.entities.get(r.targetEntityId)?.name ?? "").filter(Boolean);
    facts.push({ label: "Founded", value: names.slice(0, 2).join(", "), note: names.length > 2 ? `and ${names.length - 2} more` : "" });
  }

  const giving = summarizeGiving(bundle.given);
  if (giving.count) {
    facts.push({
      label: "Federal political giving",
      value: formatUsd(giving.total),
      note: `${giving.count} itemized FEC contributions, ${giving.first.slice(0, 4)}–${giving.last.slice(0, 4)}`,
      href: `${base}/money`,
    });
    const peak = [...giving.byCycle].sort((a, b) => b.total - a.total)[0];
    if (peak && giving.byCycle.length > 1) {
      facts.push({ label: "Largest cycle", value: formatUsd(peak.total), note: `${peak.cycle - 1}–${String(peak.cycle).slice(2)} election cycle`, href: `${base}/money` });
    }
  } else {
    const raised = bundle.received.raised.find((r) => r.currency === "USD");
    if (raised?.count) facts.push({ label: "Contributions received", value: formatUsd(raised.total), note: `${raised.count} recorded contributions`, href: `${base}/money` });
  }

  const worth = bundle.facts.find((f) => f.key === "net-worth");
  if (worth) facts.push({ label: worth.label, value: worth.value, note: [worth.detail, worth.asOf ? `as of ${formatPartialDate(worth.asOf)}` : ""].filter(Boolean).join(", ") });

  // Birth date, age and the other personal attributes live in the
  // attributes panel.
  return facts.slice(0, 5);
}

/** The newest of the profile's freshness dates, for the hero's "updated" line. */
export function updatedOn(bundle: ProfileBundle): string {
  const dates = [bundle.freshness.editorialReviewedAt, bundle.freshness.financeSyncedAt, bundle.entity.updatedAt?.slice(0, 10) ?? ""];
  return dates.filter(Boolean).sort().at(-1) ?? "";
}

export interface PanelFact {
  key: string;
  label: string;
  value: string;
  detail: string;
  asOf: string;
  sources: SourceRecord[];
  /** A source that is only a link (legacy facts and traits). */
  link?: { label: string; url: string };
}

export interface AttributeGroup {
  id: string;
  label: string;
  rows: PanelFact[];
}

// The attributes every profile shows when a source documents them, in order.
// Dossier fact keys are the canonical names; legacy keys map onto them.
const ATTRIBUTE_GROUPS: { id: string; label: string; keys: string[] }[] = [
  { id: "personal", label: "Personal details", keys: ["born", "sex", "ethnicity", "race", "citizenship", "sexual-orientation", "spouse", "children", "residence"] },
  { id: "beliefs", label: "Beliefs and affiliation", keys: ["religion", "party"] },
  { id: "career", label: "Career and wealth", keys: ["education", "current-roles", "net-worth"] },
];
const LEGACY_KEYS: Record<string, string> = {
  background: "ethnicity",
  current_roles: "current-roles",
  net_worth: "net-worth",
  political_identity: "party",
};
// traitFacts() labels → attribute keys. Race rows from Wikipedia categories
// cover race and ethnicity; ancestry ("of German descent") is ethnicity.
const TRAIT_KEYS: Record<string, string> = { Sex: "sex", Born: "born", "Race & ethnicity": "race", Ancestry: "ethnicity", Religion: "religion" };

function attributeFacts(bundle: ProfileBundle): PanelFact[] {
  if (bundle.facts.length) {
    return bundle.facts.map((f) => ({
      key: f.key,
      label: f.label,
      value: f.value,
      detail: f.detail,
      asOf: f.asOf,
      sources: sourcesFor(bundle, f.sourceIds),
    }));
  }
  // No dossier: legacy editorial facts, then traits from Wikidata and
  // Wikipedia. Wikidata categories also record former affiliations
  // ("American former Protestants"); only current ones are shown.
  const out = new Map<string, PanelFact>();
  for (const f of bundle.legacy?.facts ?? []) {
    if (/not publicly/i.test(f.value)) continue;
    const key = LEGACY_KEYS[f.key] ?? f.key;
    out.set(key, { key, label: f.label, value: f.value, detail: f.note ?? "", asOf: f.asOf ?? "", sources: [], link: f.source });
  }
  const current = bundle.traits.filter((t) => !/\bformer\b/i.test(t.detail));
  for (const fact of traitFacts(current)) {
    const key = TRAIT_KEYS[fact.label] ?? fact.label.toLowerCase();
    if (out.has(key)) continue;
    out.set(key, {
      key,
      label: key === "ethnicity" ? "Ethnicity" : key === "race" ? "Race" : fact.label,
      value: fact.value,
      // Trait details are the category or statement name ("Catholicism"); the source link carries it.
      detail: "",
      asOf: "",
      sources: [],
      link: fact.sourceUrl ? { label: traitSourceLabels[fact.source] ?? fact.source, url: fact.sourceUrl } : undefined,
    });
  }
  const metadata = parseEntityMetadata(bundle.entity.metadata);
  if (!out.has("party") && typeof metadata.party === "string" && metadata.party) {
    out.set("party", { key: "party", label: "Party", value: partyName(metadata.party), detail: "", asOf: "", sources: [] });
  }
  return [...out.values()];
}

/** The profile's attributes in their display groups; keys in `omit` are shown elsewhere. */
export function attributeGroups(bundle: ProfileBundle, omit: string[] = []): AttributeGroup[] {
  const facts = attributeFacts(bundle).filter((f) => !omit.includes(f.key));
  const metadata = parseEntityMetadata(bundle.entity.metadata);
  const born = typeof metadata.born === "string" ? metadata.born : "";
  const age = born ? ageOnDate(born, new Date()) : null;
  const placed = new Set<string>();
  const groups = ATTRIBUTE_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    rows: g.keys.flatMap((key) => {
      const fact = facts.find((f) => f.key === key);
      if (!fact) return [];
      placed.add(key);
      return [key === "born" && age !== null ? { ...fact, value: `${fact.value} (age ${age})` } : fact];
    }),
  }));
  const other = facts.filter((f) => !placed.has(f.key));
  if (other.length) groups.push({ id: "other", label: "Other", rows: other });
  return groups.filter((g) => g.rows.length);
}

export interface Tie {
  edge: RelationshipRecord;
  otherId: string;
  /** The relationship read from the subject's side: "co-founded", "co-founded by". */
  verb: string;
  category: RelationshipCategory | null;
}

/** A relationship seen from one entity's side; null if it doesn't touch it. */
export function tieFrom(edge: RelationshipRecord, subjectId: string): Tie | null {
  const type = relationshipTypeBySlug[edge.relType];
  const outgoing = edge.sourceEntityId === subjectId;
  if (!outgoing && edge.targetEntityId !== subjectId) return null;
  const verb = type ? (outgoing || !type.directed ? type.verb : type.inverse) : edge.label || edge.relType.replaceAll("-", " ");
  return {
    edge,
    otherId: outgoing ? edge.targetEntityId : edge.sourceEntityId,
    verb,
    category: relationshipCategoryOf(edge.relType),
  };
}

/** The subject's direct ties, most prominent first. */
export function directTies(bundle: ProfileBundle): Tie[] {
  return bundle.relationships
    .flatMap((edge) => tieFrom(edge, bundle.entity.id) ?? [])
    .sort((a, b) => b.edge.prominence - a.edge.prominence || (a.edge.validFrom || "9").localeCompare(b.edge.validFrom || "9"));
}

// FEC bulk imports store the office sought as a code ("H", "S", "P").
const FEC_OFFICES: Record<string, string> = { H: "U.S. House candidate", S: "U.S. Senate candidate", P: "Presidential candidate" };

export function officeLabel(metadata: Record<string, unknown>): string {
  const office = typeof metadata.office === "string" ? metadata.office : "";
  if (!FEC_OFFICES[office]) return office;
  const state = typeof metadata.state === "string" ? metadata.state : "";
  const district = typeof metadata.district === "string" && metadata.district !== "00" ? `-${Number(metadata.district)}` : "";
  return `${FEC_OFFICES[office]}${state ? `, ${state}${office === "H" ? district : ""}` : ""}`;
}

export type Sex = "male" | "female";

/**
 * Biological sex from the profile's sourced records: the dossier's `sex` fact,
 * else the Wikidata trait. Null when neither records male or female; profile
 * copy then uses wording that needs no pronoun.
 */
export function sexOf(bundle: ProfileBundle): Sex | null {
  const fact = bundle.facts.find((f) => f.key === "sex")?.value.toLowerCase();
  const value = fact ?? bundle.traits.find((t) => t.trait === "sex")?.value;
  return value === "male" || value === "female" ? value : null;
}

export function possessive(bundle: ProfileBundle): "his" | "her" | null {
  const sex = sexOf(bundle);
  return sex === "male" ? "his" : sex === "female" ? "her" : null;
}
