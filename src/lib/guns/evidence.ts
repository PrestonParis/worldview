// RAND's evidence ratings for state gun policies — Table S.1 of The Science of
// Gun Policy, fifth edition (RR-A4360-2, January 2026), transcribed from the
// report PDF and checked against its Conclusions 1–12. Each cell lists the
// ratings RAND gave a policy–outcome pair: S supportive, M moderate, L limited,
// I inconclusive, with a sign when the evidence points to a decrease (-) or an
// increase (+). A missing cell means RAND found no study that met its
// inclusion criteria. The study-level estimates behind the forest plots
// (Appendix B) are built into public/data/guns/studies.json by
// scripts/build-guns.mjs.

export const EVIDENCE_SOURCE = {
  label: "RAND, The Science of Gun Policy, 5th ed. (2026)",
  href: "https://www.rand.org/pubs/research_reports/RRA4360-2.html",
};

export type Strength = "S" | "M" | "L" | "I";
export type Rating = Strength | `${"-" | "+"}${Exclude<Strength, "I">}`;

export const STRENGTHS: { id: Strength; label: string; definition: string }[] = [
  {
    id: "S",
    label: "Supportive",
    definition:
      "At least three studies without serious methodological problems found effects in the same direction, using at least two independent data sets.",
  },
  {
    id: "M",
    label: "Moderate",
    definition:
      "Two or more studies, at least one without serious weaknesses, found significant effects in the same direction, with no contrary evidence from equally strong studies.",
  },
  {
    id: "L",
    label: "Limited",
    definition:
      "At least one study without serious methodological problems found a significant effect, with no contrary evidence from equally strong studies.",
  },
  {
    id: "I",
    label: "Inconclusive",
    definition: "Comparable studies disagree, or studies found only uncertain or suggestive effects.",
  },
];

export const OUTCOME_GROUPS = ["Suicide", "Violent crime", "Unintentional", "Other harms", "Gun market"] as const;

export const OUTCOMES = [
  { id: "total_suicide", label: "Total suicides", group: "Suicide", study: "SUICIDE" },
  { id: "firearm_suicide", label: "Firearm suicides", group: "Suicide", study: "SUICIDE" },
  { id: "violent_crime", label: "Violent crime", group: "Violent crime", study: "VIOLENT CRIME" },
  { id: "total_homicide", label: "Total homicides", group: "Violent crime", study: "VIOLENT CRIME" },
  { id: "firearm_homicide", label: "Firearm homicides", group: "Violent crime", study: "VIOLENT CRIME" },
  { id: "iph", label: "Intimate partner homicides", group: "Violent crime", study: "VIOLENT CRIME" },
  { id: "robbery", label: "Robberies", group: "Violent crime", study: "VIOLENT CRIME" },
  { id: "assault", label: "Assaults", group: "Violent crime", study: "VIOLENT CRIME" },
  { id: "rape", label: "Rapes", group: "Violent crime", study: "VIOLENT CRIME" },
  { id: "unintentional_total", label: "Unintentional injuries, total", group: "Unintentional", study: "UNINTENTIONAL" },
  { id: "unintentional_firearm", label: "Unintentional firearm injuries", group: "Unintentional", study: "UNINTENTIONAL" },
  { id: "mass_shootings", label: "Mass shootings", group: "Other harms", study: "MASS SHOOTING" },
  { id: "police_shootings", label: "Police shootings", group: "Other harms", study: "OFFICER INVOLVED" },
  { id: "dgu", label: "Defensive gun use", group: "Other harms", study: "DGU" },
  { id: "hunting", label: "Hunting & recreation", group: "Gun market", study: "INDUSTRY" },
  { id: "ownership", label: "Firearm ownership", group: "Gun market", study: "INDUSTRY" },
  { id: "industry", label: "Manufacturers & retailers", group: "Gun market", study: "INDUSTRY" },
  { id: "purchases", label: "Firearm purchases", group: "Gun market", study: "INDUSTRY" },
  { id: "banned_prices", label: "Prices of banned guns", group: "Gun market", study: "INDUSTRY" },
] as const satisfies readonly { id: string; label: string; group: (typeof OUTCOME_GROUPS)[number]; study: string }[];

export type OutcomeId = (typeof OUTCOMES)[number]["id"];

// `codes` are the policy codes RAND uses for the row's studies in Appendix B.
export const EVIDENCE_ROWS = [
  { id: "bc_dealer", label: "Background checks: dealer sales", codes: ["BC"] },
  { id: "bc_private", label: "Background checks: dealer and private sales", codes: ["BC"] },
  { id: "licensing", label: "Licensing & permit to purchase", codes: ["PTP"] },
  { id: "waiting", label: "Waiting periods", codes: ["WP"] },
  { id: "minage_purchase", label: "Minimum age to purchase", codes: ["MIN AGE"] },
  { id: "minage_possess", label: "Minimum age to possess", codes: ["MIN AGE"] },
  { id: "training", label: "Safety training requirements", codes: ["TRAINING"] },
  { id: "aw_ban", label: "Assault weapon & magazine bans", codes: ["AWB"] },
  { id: "low_quality", label: "Low-quality handgun bans", codes: ["LQB"] },
  { id: "registration", label: "Sales reporting & registration", codes: [] },
  { id: "dv", label: "Domestic-violence prohibitions", codes: ["DV PROHIB"] },
  { id: "surrender", label: "Surrender by prohibited possessors", codes: ["SURRENDER"] },
  { id: "mental", label: "Mental-illness prohibitions", codes: ["MH PROHIB"] },
  { id: "erpo", label: "Extreme-risk protection orders", codes: ["ERPO"] },
  { id: "lost_stolen", label: "Lost or stolen reporting", codes: [] },
  { id: "cap", label: "Child-access prevention", codes: ["CAP"] },
  { id: "shall_issue", label: "Concealed carry: shall issue", codes: ["RTC"] },
  { id: "permitless", label: "Concealed carry: permitless", codes: ["RTC"] },
  { id: "gun_free", label: "Gun-free zones", codes: ["GFZ"] },
  { id: "armed_staff", label: "Armed staff in K–12 schools", codes: [] },
  { id: "syg", label: "Stand-your-ground laws", codes: ["SYG"] },
] as const;

export type EvidenceRowId = (typeof EVIDENCE_ROWS)[number]["id"];

export const RATINGS: Record<EvidenceRowId, Partial<Record<OutcomeId, Rating[]>>> = {
  minage_purchase: {
    total_suicide: ["-L"],
    firearm_suicide: ["-S"],
    total_homicide: ["I"],
    firearm_homicide: ["I"],
    mass_shootings: ["I"],
  },
  minage_possess: {
    total_suicide: ["I"],
    firearm_suicide: ["-L"],
    total_homicide: ["I"],
    firearm_homicide: ["I"],
    robbery: ["I"],
    assault: ["I"],
    rape: ["I"],
    unintentional_total: ["I"],
    unintentional_firearm: ["I"],
  },
  mental: {
    total_suicide: ["I"],
    firearm_suicide: ["I"],
    violent_crime: ["-L"],
    total_homicide: ["I"],
    firearm_homicide: ["I"],
  },
  dv: {
    total_suicide: ["I"],
    firearm_suicide: ["I"],
    total_homicide: ["-L"],
    firearm_homicide: ["-L"],
    iph: ["-M", "+L", "I"],
    robbery: ["I"],
    assault: ["I"],
    rape: ["I"],
    mass_shootings: ["I"],
  },
  erpo: {
    total_suicide: ["-L"],
    firearm_suicide: ["-L"],
    total_homicide: ["I"],
    firearm_homicide: ["I"],
    unintentional_firearm: ["I"],
    mass_shootings: ["I"],
    police_shootings: ["I"],
  },
  bc_dealer: {
    total_suicide: ["I"],
    firearm_suicide: ["I"],
    violent_crime: ["I"],
    total_homicide: ["I"],
    firearm_homicide: ["-M"],
    mass_shootings: ["I"],
    industry: ["I"],
  },
  bc_private: {
    total_suicide: ["I"],
    firearm_suicide: ["I"],
    total_homicide: ["-M"],
    firearm_homicide: ["-L"],
    mass_shootings: ["I"],
    police_shootings: ["I"],
  },
  licensing: {
    total_suicide: ["I"],
    firearm_suicide: ["I"],
    total_homicide: ["-L"],
    firearm_homicide: ["-L"],
    mass_shootings: ["-L"],
    industry: ["I"],
    purchases: ["I"],
  },
  waiting: {
    total_suicide: ["-L"],
    firearm_suicide: ["-M"],
    total_homicide: ["-M"],
    firearm_homicide: ["-L"],
    iph: ["I"],
    mass_shootings: ["I"],
    ownership: ["I"],
    industry: ["I"],
    purchases: ["I"],
  },
  aw_ban: {
    total_suicide: ["I"],
    firearm_suicide: ["I"],
    total_homicide: ["I"],
    firearm_homicide: ["I"],
    mass_shootings: ["-L", "I"],
    police_shootings: ["I"],
    industry: ["I"],
    banned_prices: ["+L"],
  },
  low_quality: {
    total_suicide: ["I"],
    firearm_suicide: ["I"],
    total_homicide: ["I"],
    firearm_homicide: ["I"],
    purchases: ["I"],
  },
  syg: {
    total_suicide: ["I"],
    firearm_suicide: ["I"],
    violent_crime: ["+L"],
    total_homicide: ["+S"],
    firearm_homicide: ["+S"],
    robbery: ["I"],
    assault: ["I"],
    mass_shootings: ["I"],
    police_shootings: ["I"],
    dgu: ["I"],
    ownership: ["I"],
    purchases: ["I"],
  },
  cap: {
    total_suicide: ["-M", "I"],
    firearm_suicide: ["-S", "I"],
    violent_crime: ["I"],
    total_homicide: ["I"],
    firearm_homicide: ["-S"],
    robbery: ["I"],
    assault: ["I"],
    rape: ["I"],
    unintentional_firearm: ["-S", "-L"],
    mass_shootings: ["I"],
    industry: ["I"],
  },
  shall_issue: {
    total_suicide: ["I"],
    firearm_suicide: ["I"],
    violent_crime: ["+S"],
    total_homicide: ["+S"],
    firearm_homicide: ["+S"],
    robbery: ["+L"],
    assault: ["+M"],
    rape: ["I"],
    unintentional_total: ["I"],
    unintentional_firearm: ["I"],
    mass_shootings: ["I"],
    police_shootings: ["I"],
    dgu: ["I"],
    ownership: ["I"],
    purchases: ["I"],
  },
  permitless: {
    total_suicide: ["I"],
    firearm_suicide: ["I"],
    total_homicide: ["I"],
    firearm_homicide: ["I"],
    robbery: ["I"],
    assault: ["I"],
    mass_shootings: ["I"],
    police_shootings: ["+L"],
    purchases: ["I"],
  },
  surrender: {
    firearm_suicide: ["I"],
    violent_crime: ["I"],
    total_homicide: ["I"],
    firearm_homicide: ["I"],
    iph: ["-L", "I"],
    robbery: ["I"],
    assault: ["I"],
    rape: ["I"],
    mass_shootings: ["I"],
  },
  training: {
    firearm_suicide: ["I"],
    violent_crime: ["I"],
    total_homicide: ["I"],
    firearm_homicide: ["I"],
    robbery: ["I"],
    assault: ["I"],
    unintentional_firearm: ["I"],
    mass_shootings: ["I"],
    dgu: ["I"],
    purchases: ["I"],
  },
  registration: {
    firearm_suicide: ["I"],
    firearm_homicide: ["I"],
    mass_shootings: ["I"],
    purchases: ["I"],
  },
  gun_free: {
    violent_crime: ["I"],
  },
  lost_stolen: {},
  armed_staff: {},
};

// Table S.1's footnotes, on the cells they qualify.
export const RATING_NOTES: Partial<Record<`${EvidenceRowId}.${OutcomeId}`, string>> = {
  "minage_purchase.total_suicide":
    "Limited evidence that higher minimum ages to purchase a handgun may reduce suicides among young adults.",
  "minage_purchase.firearm_suicide":
    "Supportive evidence that raising the minimum purchase age above the federal threshold reduces firearm suicides among young people.",
  "minage_possess.firearm_suicide":
    "Limited evidence that higher minimum ages to possess a firearm reduce firearm suicides among young people.",
  "cap.total_suicide":
    "Moderate evidence for reductions in total suicides among youths; evidence for the full population was inconclusive.",
  "cap.firearm_suicide":
    "Supportive evidence for reductions in firearm suicides and self-injuries among youths; evidence for the full population was inconclusive.",
  "cap.firearm_homicide":
    "Supportive evidence of reductions in firearm homicides or assault injuries among young people; evidence for the overall population was inconclusive.",
  "cap.assault":
    "Supportive evidence of reductions in firearm homicides or assault injuries among young people; evidence for the overall population was inconclusive.",
  "cap.unintentional_firearm":
    "Supportive evidence of decreases among children; limited evidence of decreases among adults.",
  "dv.iph":
    "Moderate evidence that restraining-order prohibitions decrease total and firearm intimate partner homicides; limited evidence that stalking-misdemeanor prohibitions increase total intimate partner homicides; inconclusive for stalking and misdemeanor domestic-violence prohibitions.",
  "surrender.iph":
    "Inconclusive for surrender laws alone; moderate evidence that surrender laws paired with expanded prohibitions reduce firearm intimate partner homicides, and limited evidence they reduce all intimate partner homicides.",
  "aw_ban.mass_shootings":
    "Inconclusive for assault-weapon bans; limited evidence that high-capacity magazine bans reduce mass shootings and their fatalities.",
  "shall_issue.purchases": "Inconclusive for may-issue, shall-issue, and permitless-carry laws.",
};

export const parseRating = (r: Rating) => ({
  strength: (r.length === 2 ? r[1] : r) as Strength,
  direction: r[0] === "-" ? ("decrease" as const) : r[0] === "+" ? ("increase" as const) : null,
});

/** One Appendix B estimate, as written to public/data/guns/studies.json. */
export interface StudyEstimate {
  id: string;
  code: string; // Appendix B policy code (BC, PTP, …)
  outcome: string; // Appendix B outcome class (SUICIDE, VIOLENT CRIME, …)
  study: string;
  policy: string;
  measure: string;
  subgroup: string;
  irr: number;
  lo: number;
  hi: number;
  p: number | null;
  quality: "HIGH QUALITY" | "MINOR" | "SERIOUS" | "CRITICAL";
  figure: string;
}
