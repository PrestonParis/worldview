// The state firearm policies the /guns Policy Explorer maps, built on the
// RAND State Firearm Law Database (version 6.0, laws through September 2025).
// Each policy is one RAND law class (optionally narrowed to some subtypes),
// placed in a regulatory stage, with ordered map categories — index 0 is the
// most regulated and gets the darkest fill (--limit-1). scripts/build-guns.mjs
// imports this file to categorize every state, so the build and the page
// share one definition.

import type { EvidenceRowId } from "./evidence";

export type Stage = "acquire" | "possess" | "carry" | "use";

export const STAGES: { id: Stage; label: string; question: string }[] = [
  { id: "acquire", label: "Acquire", question: "Who may buy a firearm, from whom, and after what checks" },
  { id: "possess", label: "Possess", question: "Who may keep one, and how it must be stored or recorded" },
  { id: "carry", label: "Carry", question: "Where and how a firearm may be carried in public" },
  { id: "use", label: "Use", question: "When force with a firearm is legally justified" },
];

/** One row of the RAND database, as written by scripts/build-guns.mjs. */
export interface LawRecord {
  id: string;
  cls: number;
  subtype: string;
  guns: string; // "handgun" | "long gun" | "handgun and long gun"
  effect: "Restrictive" | "Permissive";
  change: string; // Implement | Modify | Repeal | See note
  start: string | null; // YYYY-MM-DD
  end: string | null; // supersession date; null while in force
  dateNote: string | null;
  citation: string;
  content: string;
  notes: string;
  age: number | null;
  wait: number | null;
}

export interface GunPolicy {
  id: string;
  label: string;
  stage: Stage;
  question: string;
  cls: number;
  /** Subtypes of the class this policy covers (all when omitted). */
  subtypes?: string[];
  categories: string[];
  /** Index into `categories` from the state's in-force, non-federal records. */
  categorize: (live: LawRecord[]) => number;
  /** A few words shown with the category, e.g. "10 days". */
  detail?: (live: LawRecord[]) => string | null;
  evidence: EvidenceRowId[];
}

export const isFederal = (r: Pick<LawRecord, "subtype">) => /federal/i.test(r.subtype);
/** In force at the end of the database: not superseded and not a repeal. */
export const inForce = (r: LawRecord) => !r.end && r.change !== "Repeal";
export const covers = (p: GunPolicy, r: Pick<LawRecord, "cls" | "subtype">) =>
  r.cls === p.cls && (!p.subtypes || p.subtypes.some((s) => r.subtype === s || r.subtype.startsWith(`${s} :`)));

const has = (live: LawRecord[], ...subtypes: string[]) => live.some((r) => subtypes.includes(r.subtype));
const maxAge = (live: LawRecord[], gun: "handgun" | "long gun") =>
  Math.max(0, ...live.filter((r) => r.age !== null && r.guns.includes(gun)).map((r) => r.age!));
const ladder = (...steps: string[][]) => (live: LawRecord[]) => {
  const i = steps.findIndex((s) => has(live, ...s));
  return i === -1 ? steps.length : i;
};
const days = (live: LawRecord[]) => {
  const d = Math.max(0, ...live.filter((r) => r.subtype === "general").map((r) => r.wait ?? 0));
  return d ? `${d} day${d === 1 ? "" : "s"}` : null;
};
const ages = (live: LawRecord[]) => {
  const h = maxAge(live, "handgun");
  const l = maxAge(live, "long gun");
  if (!h && !l) return null;
  return [h && `${h} handguns`, l && `${l} long guns`].filter(Boolean).join(" · ");
};

export const POLICIES: GunPolicy[] = [
  // ---- Acquire ----
  {
    id: "background-checks",
    label: "Background checks",
    stage: "acquire",
    question: "Which sales require a background check beyond the federal check on licensed dealers?",
    cls: 1,
    categories: [
      "Permit to purchase",
      "All private sales checked",
      "Some private sales checked",
      "State dealer checks",
      "Federal dealer checks only",
    ],
    categorize: ladder(
      ["permit to purchase"],
      ["private sales : point of sale"],
      ["private sales : point of sale (limited)"],
      ["sales from dealer", "extra time"],
    ),
    evidence: ["bc_dealer", "bc_private"],
  },
  {
    id: "permit-to-purchase",
    label: "Purchase permits",
    stage: "acquire",
    question: "Must a buyer first obtain a license or permit from law enforcement?",
    cls: 20,
    categories: ["Permit required", "No permit required"],
    categorize: ladder(["required"]),
    evidence: ["licensing"],
  },
  {
    id: "waiting-period",
    label: "Waiting periods",
    stage: "acquire",
    question: "How long must a buyer wait between purchase and delivery?",
    cls: 9,
    categories: ["Waiting period", "De facto, through a permit", "No waiting period"],
    categorize: ladder(["general"], ["Waiting Periods: De facto (permit required)"]),
    detail: days,
    evidence: ["waiting"],
  },
  {
    id: "minimum-age",
    label: "Minimum purchase age",
    stage: "acquire",
    question: "How old must a buyer be, beyond the federal dealer limits of 21 for handguns and 18 for long guns?",
    cls: 7,
    subtypes: ["purchase and sale"],
    categories: ["21 for all firearms", "21 for handguns", "State minimum under 21", "Federal limits only"],
    categorize: (live) => {
      const h = maxAge(live, "handgun");
      const l = maxAge(live, "long gun");
      if (h >= 21 && l >= 21) return 0;
      if (h >= 21) return 1;
      return live.length ? 2 : 3;
    },
    detail: ages,
    evidence: ["minage_purchase"],
  },
  {
    id: "weapon-bans",
    label: "Assault weapons & magazines",
    stage: "acquire",
    question: "Does the state ban sales of defined assault weapons or high-capacity magazines?",
    cls: 6,
    subtypes: ["assault weapons ban", "ban on high capacity magazines"],
    categories: ["Both banned", "Assault weapons banned", "Magazines limited", "Neither banned"],
    categorize: (live) => {
      const aw = has(live, "assault weapons ban");
      const mag = has(live, "ban on high capacity magazines");
      return aw && mag ? 0 : aw ? 1 : mag ? 2 : 3;
    },
    evidence: ["aw_ban"],
  },
  {
    id: "handgun-sales",
    label: "Handgun sales limits",
    stage: "acquire",
    question: "Does the state cap purchases per month or ban handguns it deems unsafe?",
    cls: 6,
    subtypes: ["one gun per month", "saturday night special ban", "handgun ban"],
    categories: ["Monthly cap and quality ban", "One gun per month", "Low-quality handgun ban", "Neither"],
    categorize: (live) => {
      const month = has(live, "one gun per month");
      const sns = has(live, "saturday night special ban");
      return month && sns ? 0 : month ? 1 : sns ? 2 : 3;
    },
    evidence: ["low_quality"],
  },
  {
    id: "safety-training",
    label: "Safety training",
    stage: "acquire",
    question: "Must a buyer or carrier complete firearm safety training?",
    cls: 12,
    categories: ["Required to purchase", "Required to carry", "Not required"],
    categorize: ladder(["to purchase", "to purchase : assault rifles"], ["to carry"]),
    evidence: ["training"],
  },
  {
    id: "dealer-license",
    label: "State dealer licensing",
    stage: "acquire",
    question: "Must firearm dealers hold a state license in addition to the federal one?",
    cls: 5,
    categories: ["State license required", "Federal license only"],
    categorize: ladder(["state license requirement"]),
    evidence: [],
  },
  {
    id: "straw-purchase",
    label: "Straw purchases",
    stage: "acquire",
    question: "Does state law penalize buying a firearm for someone who may not legally buy one?",
    cls: 17,
    categories: ["Buyer and seller liable", "Buyer liable", "Federal law only"],
    categorize: ladder(["straw purchase - buyer and seller liability"], ["straw purchase - buyer liability"]),
    evidence: [],
  },

  // ---- Possess ----
  {
    id: "domestic-violence",
    label: "Domestic-violence orders",
    stage: "possess",
    question: "Does a domestic-violence restraining order bar firearm possession under state law?",
    cls: 10,
    subtypes: ["dvro", "dvro ex parte"],
    categories: ["Includes ex parte orders", "Final orders", "Federal law only"],
    categorize: ladder(["dvro ex parte", "dvro ex parte : expanded"], ["dvro", "dvro : expanded"]),
    detail: (live) => (has(live, "dvro : expanded", "dvro ex parte : expanded") ? "Covers dating partners" : null),
    evidence: ["dv", "surrender"],
  },
  {
    id: "erpo",
    label: "Extreme-risk orders",
    stage: "possess",
    question: "Can a court temporarily remove firearms from a person found to be a risk?",
    cls: 10,
    subtypes: ["erpo"],
    categories: ["Family may petition", "Law enforcement petitions", "No ERPO law"],
    categorize: ladder(["erpo : expanded", "erpo : ex parte expanded"], ["erpo", "erpo : ex parte"]),
    evidence: ["erpo"],
  },
  {
    id: "mental-health",
    label: "Mental-health prohibitions",
    stage: "possess",
    question: "Which mental-health histories bar possession under state law?",
    cls: 10,
    subtypes: ["mental health"],
    categories: ["Broader than federal categories", "Commitment or adjudication", "Federal law only"],
    categorize: ladder(
      [
        "mental health : committed to mh facility : outpatient",
        "mental health : committed to mh facility : voluntary",
        "mental health : diagnosed with significant behavioral, emotional or mental disorder",
        "mental health : determined by police to be mentally incompetent/incapacitated/disabled",
      ],
      [
        "mental health : committed to mh facility",
        "mental health : adjudicated as mentally incompetent//incapacitated/disabled",
      ],
    ),
    evidence: ["mental"],
  },
  {
    id: "violent-misdemeanor",
    label: "Violent misdemeanors",
    stage: "possess",
    question: "Does a violent-misdemeanor conviction bar possession?",
    cls: 10,
    subtypes: ["violent misdemeanor", "violent misdemeanor limited", "violent misdemeanor juvenile"],
    categories: ["Prohibited", "Prohibited for a period", "Juveniles only", "No prohibition"],
    categorize: ladder(["violent misdemeanor"], ["violent misdemeanor limited"], ["violent misdemeanor juvenile"]),
    evidence: [],
  },
  {
    id: "child-access",
    label: "Child access & storage",
    stage: "possess",
    question: "Is a gun owner liable when a child can reach a firearm, or required to lock it up?",
    cls: 4,
    categories: ["Safe-storage mandate", "Negligent-storage liability", "Furnishing to minors only", "No law"],
    categorize: ladder(["safe storage"], ["negligent storage"], ["intentional, reckless, or knowing provision"]),
    evidence: ["cap"],
  },
  {
    id: "youth-possession",
    label: "Youth possession age",
    stage: "possess",
    question: "How old must someone be to possess a firearm under state law?",
    cls: 7,
    subtypes: ["youth possession"],
    categories: ["21", "18–20", "Under 18", "Federal handgun limit only"],
    categorize: (live) => {
      const a = Math.max(maxAge(live, "handgun"), maxAge(live, "long gun"));
      return a >= 21 ? 0 : a >= 18 ? 1 : a > 0 ? 2 : 3;
    },
    detail: ages,
    evidence: ["minage_possess"],
  },
  {
    id: "registration",
    label: "Registration",
    stage: "possess",
    question: "Does the state keep a registry of who owns which firearms?",
    cls: 18,
    categories: ["Registration required", "No registry"],
    categorize: ladder(["required"]),
    evidence: ["registration"],
  },
  {
    id: "lost-stolen",
    label: "Lost & stolen reporting",
    stage: "possess",
    question: "Must owners report lost or stolen firearms?",
    cls: 11,
    categories: ["Reporting required", "Crime-gun tracing only", "No requirement"],
    categorize: ladder(["lost and stolen firearms"], ["tracing firearms used in crimes"]),
    evidence: ["lost_stolen"],
  },
  {
    id: "untraceable",
    label: "Untraceable firearms",
    stage: "possess",
    question: "Does the state ban unserialized, privately made firearms?",
    cls: 16,
    categories: ["Prohibited", "No state ban"],
    categorize: ladder(["prohibited"]),
    evidence: [],
  },
  {
    id: "dv-removal",
    label: "Removal at DV scenes",
    stage: "possess",
    question: "May or must police seize firearms at a domestic-violence incident?",
    cls: 14,
    categories: ["Removal required", "Removal authorized", "No state rule"],
    categorize: ladder(["required"], ["authorized"]),
    evidence: [],
  },

  // ---- Carry ----
  {
    id: "concealed-carry",
    label: "Concealed carry",
    stage: "carry",
    question: "Is a permit needed to carry a concealed handgun, and is its issue discretionary?",
    cls: 2,
    categories: ["Prohibited", "May issue", "Shall issue", "No permit required"],
    categorize: ladder(["prohibited"], ["may issue"], ["shall issue"], ["shall issue (permit not required)"]),
    evidence: ["shall_issue", "permitless"],
  },
  {
    id: "open-carry",
    label: "Open carry",
    stage: "carry",
    question: "May firearms be carried openly, and with what license?",
    cls: 8,
    categories: ["Prohibited", "Loaded guns prohibited", "License required", "Allowed with limits", "No license required"],
    categorize: ladder(["prohibited"], ["limited : prohibited : loaded"], ["license required"], ["limited"]),
    evidence: [],
  },
  {
    id: "campus-carry",
    label: "Colleges & universities",
    stage: "carry",
    question: "May permit holders carry on college campuses?",
    cls: 13,
    categories: ["All possession banned", "Concealed carry banned", "Concealed carry allowed", "No state rule"],
    categorize: (live) => {
      if (live.some((r) => /CCW allowed/.test(r.subtype))) return 2;
      if (live.some((r) => /possession prohibited/.test(r.subtype))) return 0;
      if (live.some((r) => /CCW not allowed/.test(r.subtype))) return 1;
      return 3;
    },
    evidence: ["gun_free"],
  },
  {
    id: "armed-staff",
    label: "Armed school staff",
    stage: "carry",
    question: "May K–12 personnel other than police carry firearms at school?",
    cls: 15,
    categories: ["Allowed", "No state authorization"],
    categorize: ladder(["school personnel other than peace officers"]),
    evidence: ["armed_staff"],
  },
  {
    id: "preemption",
    label: "Local preemption",
    stage: "carry",
    question: "May cities and counties pass their own firearm rules?",
    cls: 19,
    categories: ["Preempted, with penalties", "Broadly preempted", "Partly preempted", "Local rules allowed"],
    categorize: ladder(["comprehensive - punitive"], ["comprehensive"], ["limited"]),
    evidence: [],
  },

  // ---- Use ----
  {
    id: "self-defense",
    label: "Self-defense & retreat",
    stage: "use",
    question: "Where may a person use deadly force without first trying to retreat?",
    cls: 3,
    categories: ["Anywhere (stand your ground)", "Home and other set places", "Home, vehicle, or work", "Home only", "No statute coded"],
    categorize: ladder(["stand your ground"], ["expanded 2"], ["expanded 1"], ["traditional"]),
    evidence: ["syg"],
  },
];

export const policyById = (id: string | null | undefined) => POLICIES.find((p) => p.id === id);

/** RAND's definition of each subtype (Table 1 of TL-A243-2-v4), keyed by `${cls}:${subtype}`. */
export const SUBTYPE_DEFINITIONS: Record<string, string> = {
  "1:private sales : point of sale":
    "A background check by a licensed dealer or law enforcement before the transfer of any weapon, with few exceptions.",
  "1:private sales : point of sale (limited)":
    "A background check before private transfers in specified circumstances, such as gun-show sales.",
  "1:sales from dealer": "Licensed dealers must run a state background check on buyers.",
  "1:sales from dealer : federal": "Licensed dealers must run the federal check (Brady interim rules, 1994; NICS, 1998).",
  "1:permit to purchase": "Law enforcement checks the buyer before issuing a permit; no further check while it is valid.",
  "1:extra time": "Extends how long a dealer must wait before transferring a gun without a completed check.",
  "2:prohibited": "Concealed carry is prohibited.",
  "2:may issue": "A permit is required and officials have discretion to issue it.",
  "2:shall issue": "A permit is required and must be issued to applicants who meet objective criteria.",
  "2:shall issue (permit not required)": "Concealed carry is allowed without a permit.",
  "3:traditional": "No duty to retreat before using deadly force when threatened in one's home.",
  "3:expanded 1": "No duty to retreat at home, in a vehicle, or at work.",
  "3:expanded 2": "No duty to retreat at home, vehicle, work, and other specified places.",
  "3:stand your ground": "No duty to retreat in any place a person may lawfully be.",
  "4:negligent storage": "Civil or criminal penalties for storing a gun where a minor could reasonably gain access.",
  "4:intentional, reckless, or knowing provision": "Prohibits furnishing guns to minors.",
  "4:safe storage": "Guns must be stored safely whether or not a minor might gain access.",
  "5:state license requirement": "Firearm dealers must be licensed by the state.",
  "6:assault weapons ban": "Bans sales of specified weapons, or weapons with features the law defines as assault rifles or pistols.",
  "6:ban on high capacity magazines": "Bans sales of high-capacity magazines.",
  "6:saturday night special ban": "Bans handguns the law defines as unsafe or of substandard quality.",
  "6:one gun per month": "Prohibits buying more than one gun in a 30-day period.",
  "6:handgun ban": "Bans the sale of all handguns.",
  "7:purchase and sale": "Prohibits sales to and purchases by people under a specified age.",
  "7:youth possession": "Sets a minimum age to possess a gun.",
  "8:license required": "A license from law enforcement is required to carry openly.",
  "8:limited": "Open carry without a license, with limits such as time or place.",
  "8:limited : prohibited : loaded": "Prohibits openly carrying loaded guns.",
  "8:prohibited": "Prohibits open carry.",
  "9:general": "A minimum wait between purchase and delivery.",
  "9:Waiting Periods: De facto (permit required)":
    "No separate waiting period, but obtaining the required purchase permit delays the sale; RAND assigns 10 days.",
  "10:dvro": "People served with a domestic-violence restraining order may not own, possess, or buy firearms.",
  "10:dvro : expanded": "The restraining-order prohibition extends to dating partners.",
  "10:dvro ex parte": "The prohibition applies to temporary orders issued before the respondent appears in court.",
  "10:dvro ex parte : expanded": "Ex parte prohibition that also extends to dating partners.",
  "10:erpo": "Law enforcement may petition a court to remove firearms from a person who poses a risk.",
  "10:erpo : expanded": "Family members or others, not just police, may petition.",
  "10:erpo : ex parte": "Police may obtain temporary removal before the person appears in court.",
  "10:erpo : ex parte expanded": "Police and others may obtain temporary removal before a hearing.",
  "10:violent misdemeanor": "A violent-misdemeanor conviction, including simple assault, bars possession.",
  "10:violent misdemeanor limited": "A violent-misdemeanor conviction bars possession for a limited period.",
  "10:violent misdemeanor juvenile": "The bar applies only to offenders 21 or younger.",
  "11:lost and stolen firearms": "Owners must report lost or stolen firearms.",
  "11:tracing firearms used in crimes": "Police must trace firearms recovered in connection with crimes.",
  "12:to purchase": "A safety-training certificate is required to buy a firearm.",
  "12:to carry": "A safety-training certificate is required to carry.",
  "14:required": "Police must seize firearms at the scene of a domestic-violence incident.",
  "14:authorized": "Police may seize firearms at the scene of a domestic-violence incident.",
  "15:school personnel other than peace officers": "School staff other than peace officers may carry on school property.",
  "16:prohibited": "Bans making or selling privately made firearms without serial numbers.",
  "17:straw purchase - buyer liability": "Penalizes buying a gun for someone who may not legally buy one.",
  "17:straw purchase - buyer and seller liability": "Penalizes both the straw buyer and a seller who knowingly takes part.",
  "18:required": "A government registry records the current owner of each firearm of a covered class.",
  "19:limited": "Prohibits local laws on specific topics, uses, or classes of firearms.",
  "19:comprehensive": "Broadly prohibits local firearm laws.",
  "19:comprehensive - punitive": "Penalizes local governments and officials that adopt their own firearm rules.",
  "20:required": "Buyers must first obtain a license or permit from law enforcement.",
  "20:maximum waiting period": "Caps how long law enforcement may take to issue or deny a permit.",
};
