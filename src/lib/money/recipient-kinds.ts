// What kind of committee received a contribution, from the FEC committee's
// type and designation (https://www.fec.gov/campaign-finance-data/committee-type-code-descriptions/).
// Stored on contributions.recipient_kind by scripts/import-profile.mjs so a
// profile never sums a candidate gift, a party gift and an unlimited super
// PAC gift as if they were the same thing.

export const recipientKinds = [
  "candidate",
  "party",
  "pac",
  "super_pac",
  "hybrid_pac",
  "joint_fundraising",
  "other",
] as const;

export type RecipientKind = (typeof recipientKinds)[number];

export const recipientKindLabels: Record<RecipientKind, string> = {
  candidate: "Candidate campaigns",
  party: "Party committees",
  pac: "PACs",
  super_pac: "Super PACs",
  hybrid_pac: "Hybrid PACs",
  joint_fundraising: "Joint fundraising",
  other: "Other committees",
};

// Short explanations shown beside the breakdown.
export const recipientKindNotes: Record<RecipientKind, string> = {
  candidate: "A candidate's own campaign committee; gifts are capped per election.",
  party: "National, state and local party committees.",
  pac: "Traditional PACs, which give to candidates under contribution limits.",
  super_pac: "Committees that spend independently of campaigns and may accept unlimited sums.",
  hybrid_pac: "PACs with a separate unlimited account for independent spending.",
  joint_fundraising: "Committees that raise for several recipients and pass the money on.",
  other: "Committees FEC classifies otherwise.",
};

export function recipientKindOf(committeeType: string | null | undefined, designation: string | null | undefined): RecipientKind {
  if (designation === "J") return "joint_fundraising";
  switch (committeeType) {
    case "H":
    case "S":
    case "P":
      return "candidate";
    case "X":
    case "Y":
    case "Z":
      return "party";
    case "O":
      return "super_pac";
    case "V":
    case "W":
      return "hybrid_pac";
    case "N":
    case "Q":
      return "pac";
    default:
      return "other";
  }
}

export function isRecipientKind(value: unknown): value is RecipientKind {
  return typeof value === "string" && (recipientKinds as readonly string[]).includes(value);
}
