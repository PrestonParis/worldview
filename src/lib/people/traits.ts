// Personal traits recorded for people in the People graph (entity_traits,
// filled by scripts/import-entity-traits.mjs from Wikidata, Wikipedia
// categories and Open States). Values here must match the ones
// scripts/lib/traits.mjs writes.

export interface TraitRow {
  entityId: string;
  trait: string;
  value: string;
  detail: string;
  source: string;
  sourceUrl: string;
}

// One person's traits, shaped for filtering.
export interface PersonTraits {
  sex?: string;
  birthYear?: number;
  birthCountry?: string;
  race: string[];
  ancestry: string[];
  religion: string[];
}

export const NOT_RECORDED = "none";

export const sexLabels: Record<string, string> = {
  female: "Women",
  male: "Men",
  nonbinary: "Nonbinary",
};

export const raceLabels: Record<string, string> = {
  black: "Black",
  hispanic: "Hispanic or Latino",
  asian: "Asian American",
  native: "Native American",
  pacific: "Native Hawaiian or Pacific Islander",
  mena: "Middle Eastern or North African",
  white: "White",
};

export const religionLabels: Record<string, string> = {
  protestant: "Protestant",
  catholic: "Catholic",
  christian: "Christian, tradition not stated",
  lds: "Latter-day Saint",
  orthodox: "Orthodox Christian",
  jewish: "Jewish",
  muslim: "Muslim",
  hindu: "Hindu",
  buddhist: "Buddhist",
  sikh: "Sikh",
  unitarian: "Unitarian Universalist",
  unaffiliated: "Atheist, agnostic or none",
  other: "Other religion",
};

export const bornLabels: Record<string, string> = {
  us: "Born in the U.S.",
  abroad: "Born abroad",
};

// Pew Research Center's generation boundaries.
export const generations = [
  { key: "greatest", label: "Greatest", min: 0, max: 1927 },
  { key: "silent", label: "Silent", min: 1928, max: 1945 },
  { key: "boomer", label: "Boomers", min: 1946, max: 1964 },
  { key: "genx", label: "Gen X", min: 1965, max: 1980 },
  { key: "millennial", label: "Millennials", min: 1981, max: 1996 },
  { key: "genz", label: "Gen Z", min: 1997, max: 9999 },
] as const;

export function generationOf(year: number | undefined): string | null {
  if (!year) return null;
  return generations.find((g) => year >= g.min && year <= g.max)?.key ?? null;
}

export function bornOf(country: string | undefined): string | null {
  if (!country) return null;
  return country === "United States" || country === "United States of America" ? "us" : "abroad";
}

export function groupTraits(rows: Pick<TraitRow, "entityId" | "trait" | "value">[]): Map<string, PersonTraits> {
  const out = new Map<string, PersonTraits>();
  for (const row of rows) {
    let person = out.get(row.entityId);
    if (!person) {
      person = { race: [], ancestry: [], religion: [] };
      out.set(row.entityId, person);
    }
    if (row.trait === "sex") person.sex = row.value;
    else if (row.trait === "birth_year") person.birthYear = Number(row.value) || undefined;
    else if (row.trait === "birth_country") person.birthCountry = row.value;
    else if (row.trait === "race" || row.trait === "ancestry" || row.trait === "religion") person[row.trait].push(row.value);
  }
  return out;
}

// Profile facts, in display order, from one person's rows.
export function traitFacts(rows: TraitRow[]): { label: string; value: string; detail: string; source: string; sourceUrl: string }[] {
  const pick = (trait: string) => rows.filter((row) => row.trait === trait);
  const facts: { label: string; value: string; detail: string; source: string; sourceUrl: string }[] = [];
  const push = (label: string, list: TraitRow[], name: (row: TraitRow) => string) => {
    if (!list.length) return;
    facts.push({
      label,
      value: list.map(name).join(", "),
      detail: list.map((row) => row.detail).filter(Boolean).join("; "),
      source: list[0].source,
      sourceUrl: list[0].sourceUrl,
    });
  };
  push("Sex", pick("sex"), (row) => ({ female: "Female", male: "Male", nonbinary: "Nonbinary" })[row.value] ?? row.value);
  push("Born", [...pick("birth_year"), ...pick("birth_country")], (row) => row.value);
  push("Race & ethnicity", pick("race"), (row) => raceLabels[row.value] ?? row.value);
  push("Ancestry", pick("ancestry"), (row) => row.value);
  push("Religion", pick("religion"), (row) => religionLabels[row.value] ?? row.value);
  return facts;
}

export const traitSourceLabels: Record<string, string> = {
  wikidata: "Wikidata",
  wikipedia: "Wikipedia",
  openstates: "Open States",
};
