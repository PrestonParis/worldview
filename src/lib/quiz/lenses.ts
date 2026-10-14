// Labels for the categorical lenses (types.ts) and the values an ideology
// accepts when its catalog entry leaves a lens unset.

import type { Authority, Ideology, LensId, NationBasis, Tradition } from "./types";

export const LENS_NAMES: Record<LensId, string> = {
  tradition: "Tradition in law",
  authority: "Final authority",
  nation: "Nation defined by",
};

export const LENS_VALUE_LABELS: Record<LensId, Record<string, string>> = {
  tradition: {
    none: "None (secular law)",
    pluralist: "No single tradition",
    catholic: "Catholic",
    protestant: "Protestant",
    orthodox: "Orthodox Christian",
    christian: "Christian",
    sunni: "Sunni Islam",
    shia: "Shia Islam",
    jewish: "Jewish",
    hindu: "Hindu",
    buddhist: "Buddhist",
    sikh: "Sikh",
    other: "Another tradition",
  } satisfies Record<Tradition, string>,
  authority: {
    elected: "Elected representatives",
    assemblies: "Citizen assemblies",
    party: "A ruling party",
    leader: "A strong leader",
    monarch: "A monarch",
    clergy: "Religious leaders or law",
    experts: "Experts",
    military: "The military",
    owners: "Property owners",
    "no-state": "No state",
  } satisfies Record<Authority, string>,
  nation: {
    civic: "Citizenship",
    ethnic: "Ancestry",
    religious: "Religion",
    civilizational: "Culture",
    class: "Class over nation",
  } satisfies Record<NationBasis, string>,
};

// Values an untagged ideology accepts, read from its axis positions, so a
// respondent who wants Hindu law or an ethnic nation is told apart from a
// generic centrist rather than ignored by it. Every non-Christian religious
// tradition in the catalog is tagged explicitly; an untagged religious entry
// is a Western one whose religious politics is Christian.
const LEAN = 0.3;
const CHRISTIAN: Tradition[] = ["christian", "catholic", "protestant", "orthodox"];

export function acceptedLens(ideology: Ideology, lens: LensId): string[] | null {
  const explicit = ideology[lens];
  if (explicit) return explicit;
  const p = ideology.position;
  if (lens === "tradition") return p.religion < LEAN ? ["none", "pluralist"] : [...CHRISTIAN, "pluralist"];
  if (lens === "nation") return p.immigration < LEAN ? ["civic", "class"] : ["civic", "civilizational"];
  // An untagged autocratic ideology takes no position on who should rule.
  return p.democracy < LEAN ? ["elected", "assemblies"] : null;
}
