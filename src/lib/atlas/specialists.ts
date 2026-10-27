export interface SpecialistDimension {
  id: string;
  name: string;
  negative: string;
  positive: string;
}

export interface SpecialistQuestion {
  id: string;
  dimension: string;
  text: string;
  direction: -1 | 1;
}

export interface SpecialistSchool {
  id: string;
  name: string;
  summary: string;
  philosophyId?: string;
  position: Record<string, number>;
}

export interface SpecialistAssessment {
  id: "authority" | "foreign-policy";
  title: string;
  eyebrow: string;
  description: string;
  dimensions: SpecialistDimension[];
  questions: SpecialistQuestion[];
  schools: SpecialistSchool[];
}

export interface SpecialistMatch {
  school: SpecialistSchool;
  score: number;
  distance: number;
}

const record = (ids: string[], values: number[]) => Object.fromEntries(ids.map((id, i) => [id, values[i]]));

const authorityDimensions: SpecialistDimension[] = [
  {
    id: "legitimacy",
    name: "Legitimacy",
    negative: "Popular consent",
    positive: "Inherited or transcendent authority",
  },
  { id: "power", name: "Concentration of power", negative: "Dispersed", positive: "Centralized" },
  { id: "constraint", name: "Executive constraint", negative: "Checked", positive: "Decisive" },
  { id: "participation", name: "Public participation", negative: "Broad & direct", positive: "Delegated & selective" },
  { id: "federalism", name: "Level of government", negative: "Local", positive: "National" },
  { id: "liberty", name: "Liberty & order", negative: "Civil liberty", positive: "Public order" },
  { id: "expertise", name: "Administration", negative: "Political accountability", positive: "Independent expertise" },
  { id: "change", name: "Political change", negative: "Incremental", positive: "Transformative" },
];
const authorityIds = authorityDimensions.map((x) => x.id);

export const authorityAssessment: SpecialistAssessment = {
  id: "authority",
  title: "Government & Authority",
  eyebrow: "Specialist assessment",
  description:
    "Sixteen decisions about legitimacy, participation, constitutional restraint, administration, federalism, liberty, and political change.",
  dimensions: authorityDimensions,
  questions: [
    {
      id: "legitimacy-1",
      dimension: "legitimacy",
      direction: -1,
      text: "Political authority is legitimate only when citizens can remove those who govern them.",
    },
    {
      id: "legitimacy-2",
      dimension: "legitimacy",
      direction: 1,
      text: "A government can be legitimate through tradition, religion, or inherited duty even without competitive elections.",
    },
    {
      id: "power-1",
      dimension: "power",
      direction: -1,
      text: "Power should be divided among many institutions even when that makes government slower.",
    },
    {
      id: "power-2",
      dimension: "power",
      direction: 1,
      text: "A clear center of authority is usually better than several institutions able to block one another.",
    },
    {
      id: "constraint-1",
      dimension: "constraint",
      direction: -1,
      text: "Courts and legislatures should be able to stop executive action before it takes effect.",
    },
    {
      id: "constraint-2",
      dimension: "constraint",
      direction: 1,
      text: "An elected executive needs broad freedom to carry out the program voters chose.",
    },
    {
      id: "participation-1",
      dimension: "participation",
      direction: -1,
      text: "Citizens should vote directly on more major laws and constitutional questions.",
    },
    {
      id: "participation-2",
      dimension: "participation",
      direction: 1,
      text: "Most governing decisions are best left to representatives and officials with time to study them.",
    },
    {
      id: "federalism-1",
      dimension: "federalism",
      direction: -1,
      text: "Local and regional governments should be free to reach different policy answers.",
    },
    {
      id: "federalism-2",
      dimension: "federalism",
      direction: 1,
      text: "Basic rights and public services should follow national rules rather than local preference.",
    },
    {
      id: "liberty-1",
      dimension: "liberty",
      direction: -1,
      text: "Government should accept meaningful public risk rather than weaken privacy and due process.",
    },
    {
      id: "liberty-2",
      dimension: "liberty",
      direction: 1,
      text: "Maintaining public order sometimes justifies broad surveillance and emergency powers.",
    },
    {
      id: "expertise-1",
      dimension: "expertise",
      direction: -1,
      text: "Important agencies should remain closely answerable to elected officials.",
    },
    {
      id: "expertise-2",
      dimension: "expertise",
      direction: 1,
      text: "Technical agencies work best when insulated from day-to-day electoral politics.",
    },
    {
      id: "change-1",
      dimension: "change",
      direction: -1,
      text: "Political institutions should change gradually so reform does not destroy accumulated knowledge.",
    },
    {
      id: "change-2",
      dimension: "change",
      direction: 1,
      text: "Deep injustice can make a basic transformation of political institutions necessary.",
    },
  ],
  schools: [
    {
      id: "liberal-constitutionalism",
      name: "Liberal constitutionalism",
      summary: "Popular government constrained by individual rights, divided powers, and durable legal rules.",
      philosophyId: "modern-liberalism",
      position: record(authorityIds, [-0.9, -0.6, -0.9, 0.1, 0.2, -0.8, 0.3, -0.2]),
    },
    {
      id: "civic-republicanism",
      name: "Civic republicanism",
      summary: "Self-government, civic participation, public virtue, and resistance to arbitrary power.",
      position: record(authorityIds, [-0.9, -0.7, -0.6, -0.7, -0.3, -0.3, -0.4, 0.1]),
    },
    {
      id: "participatory-democracy",
      name: "Participatory democracy",
      summary: "Authority flows upward from frequent, broad, and often direct citizen participation.",
      position: record(authorityIds, [-1, -0.9, -0.8, -1, -0.7, -0.6, -0.8, 0.5]),
    },
    {
      id: "constitutional-federalism",
      name: "Constitutional federalism",
      summary: "Divided sovereignty, local self-rule, enumerated powers, and strong institutional checks.",
      philosophyId: "constitutional-conservatism",
      position: record(authorityIds, [-0.8, -0.9, -0.9, 0.1, -1, -0.6, -0.2, -0.5]),
    },
    {
      id: "technocracy",
      name: "Technocracy",
      summary: "Legitimate administration rests heavily on competence, evidence, and insulated professional expertise.",
      philosophyId: "technocracy",
      position: record(authorityIds, [-0.2, 0.4, 0.1, 0.8, 0.5, 0.2, 1, 0.2]),
    },
    {
      id: "majoritarian-presidentialism",
      name: "Majoritarian presidentialism",
      summary: "A nationally elected executive receives a strong mandate to act decisively and visibly.",
      position: record(authorityIds, [-0.8, 0.7, 1, 0.4, 0.8, 0.4, -0.5, 0.4]),
    },
    {
      id: "parliamentary-government",
      name: "Parliamentary government",
      summary:
        "Accountable party government joins executive and legislative authority while preserving electoral removal.",
      position: record(authorityIds, [-0.9, 0.25, 0.35, 0.35, 0.6, 0.05, 0.1, 0.1]),
    },
    {
      id: "developmental-state",
      name: "Developmental state",
      summary: "A capable central administration coordinates long-term national development and strategic priorities.",
      philosophyId: "developmentalism",
      position: record(authorityIds, [0.1, 0.8, 0.7, 0.7, 0.9, 0.5, 0.8, 0.55]),
    },
    {
      id: "traditional-authority",
      name: "Traditional authority",
      summary: "Legitimacy is rooted in inherited institutions, religious or customary order, and continuity.",
      philosophyId: "monarchism",
      position: record(authorityIds, [1, 0.8, 0.7, 0.8, 0.5, 0.7, 0.1, -0.9]),
    },
    {
      id: "libertarian-anarchism",
      name: "Libertarian anarchism",
      summary:
        "Coercive hierarchy gives way to voluntary association, local autonomy, and radically dispersed authority.",
      philosophyId: "libertarian-socialism",
      position: record(authorityIds, [-0.8, -1, -1, -0.9, -1, -1, -0.8, 0.7]),
    },
  ],
};

const foreignDimensions: SpecialistDimension[] = [
  { id: "engagement", name: "Global engagement", negative: "Selective", positive: "Active" },
  { id: "institutions", name: "International institutions", negative: "Sovereignty", positive: "Cooperation" },
  { id: "force", name: "Use of force", negative: "Restraint", positive: "Intervention" },
  { id: "alliances", name: "Alliances", negative: "Flexible", positive: "Binding" },
  { id: "trade", name: "Trade", negative: "Resilience", positive: "Openness" },
  { id: "regime", name: "Political values abroad", negative: "Noninterference", positive: "Democracy promotion" },
  { id: "aid", name: "Foreign assistance", negative: "Domestic priority", positive: "International investment" },
  { id: "defense", name: "Defense posture", negative: "Limited", positive: "Forward & large" },
];
const foreignIds = foreignDimensions.map((x) => x.id);

export const foreignPolicyAssessment: SpecialistAssessment = {
  id: "foreign-policy",
  title: "Foreign Policy",
  eyebrow: "Specialist assessment",
  description:
    "Sixteen decisions about alliances, institutions, military force, trade, sovereignty, democracy promotion, aid, and defense posture.",
  dimensions: foreignDimensions,
  questions: [
    {
      id: "engagement-1",
      dimension: "engagement",
      direction: 1,
      text: "The country should actively shape international rules rather than mainly react to events abroad.",
    },
    {
      id: "engagement-2",
      dimension: "engagement",
      direction: -1,
      text: "Foreign commitments should be rare and tied to a narrow, concrete national interest.",
    },
    {
      id: "institutions-1",
      dimension: "institutions",
      direction: 1,
      text: "International institutions are worth accepting some limits on national freedom of action.",
    },
    {
      id: "institutions-2",
      dimension: "institutions",
      direction: -1,
      text: "National law should almost always take priority over international rules and tribunals.",
    },
    {
      id: "force-1",
      dimension: "force",
      direction: -1,
      text: "Military force should be used only against a direct and imminent threat.",
    },
    {
      id: "force-2",
      dimension: "force",
      direction: 1,
      text: "Early military action can prevent a hostile power from becoming much more dangerous.",
    },
    {
      id: "alliances-1",
      dimension: "alliances",
      direction: 1,
      text: "Formal alliances deter conflict even when they create obligations in disputes far from home.",
    },
    {
      id: "alliances-2",
      dimension: "alliances",
      direction: -1,
      text: "Security partnerships should remain flexible rather than promise an automatic military response.",
    },
    {
      id: "trade-1",
      dimension: "trade",
      direction: -1,
      text: "Strategic self-sufficiency is worth higher prices in essential industries.",
    },
    {
      id: "trade-2",
      dimension: "trade",
      direction: 1,
      text: "Open commerce usually strengthens peace and prosperity more than economic nationalism does.",
    },
    {
      id: "regime-1",
      dimension: "regime",
      direction: -1,
      text: "Other countries' political systems are not ours to reshape.",
    },
    {
      id: "regime-2",
      dimension: "regime",
      direction: 1,
      text: "Supporting democratic movements abroad should be an explicit national objective.",
    },
    {
      id: "aid-1",
      dimension: "aid",
      direction: 1,
      text: "Foreign assistance is a worthwhile investment in stability, health, and long-term influence.",
    },
    {
      id: "aid-2",
      dimension: "aid",
      direction: -1,
      text: "Public money should address needs at home before financing development abroad.",
    },
    {
      id: "defense-1",
      dimension: "defense",
      direction: 1,
      text: "A large forward military presence makes major war less likely.",
    },
    {
      id: "defense-2",
      dimension: "defense",
      direction: -1,
      text: "Overseas bases and a very large defense establishment create more commitments than security.",
    },
  ],
  schools: [
    {
      id: "liberal-internationalism",
      name: "Liberal internationalism",
      summary: "Alliances, institutions, open exchange, and democratic cooperation anchor an active global role.",
      philosophyId: "liberal-internationalism",
      position: record(foreignIds, [0.9, 1, 0.35, 0.9, 0.9, 0.8, 0.8, 0.7]),
    },
    {
      id: "realism",
      name: "Realism",
      summary: "Power, geography, and national interest matter more than remaking other societies.",
      position: record(foreignIds, [0.45, -0.35, 0.2, 0.25, 0.15, -0.9, -0.35, 0.55]),
    },
    {
      id: "restraint",
      name: "Restraint",
      summary: "Diplomacy and selective engagement without primacy, regime change, or an expansive military footprint.",
      philosophyId: "non-interventionism",
      position: record(foreignIds, [-0.3, 0.15, -0.9, -0.45, 0.35, -0.9, -0.05, -0.9]),
    },
    {
      id: "nonalignment",
      name: "Nonalignment",
      summary: "Strategic independence avoids permanent blocs while cooperating issue by issue.",
      position: record(foreignIds, [-0.25, 0.05, -0.65, -1, 0.05, -0.85, 0.15, -0.55]),
    },
    {
      id: "neoconservatism",
      name: "Neoconservatism",
      summary: "American primacy, military strength, democratic allies, and willingness to confront hostile regimes.",
      philosophyId: "neoconservatism",
      position: record(foreignIds, [1, 0.55, 1, 0.85, 0.65, 1, 0.45, 1]),
    },
    {
      id: "america-first",
      name: "America First",
      summary:
        "Sovereignty, burden-sharing, border control, industrial strength, and narrowly transactional commitments.",
      philosophyId: "right-populism",
      position: record(foreignIds, [-0.45, -0.9, 0.05, -0.45, -0.85, -0.75, -0.95, 0.35]),
    },
    {
      id: "isolationism",
      name: "Isolationism",
      summary: "Avoid political and military entanglements while concentrating resources and authority at home.",
      position: record(foreignIds, [-1, -0.9, -1, -1, -0.45, -1, -1, -1]),
    },
    {
      id: "global-cosmopolitanism",
      name: "Global cosmopolitanism",
      summary: "Human obligations cross borders; institutions, aid, migration, and cooperation should reflect that.",
      philosophyId: "left-libertarianism",
      position: record(foreignIds, [0.75, 1, -0.7, 0.5, 1, 0.45, 1, -0.5]),
    },
    {
      id: "offshore-balancing",
      name: "Offshore balancing",
      summary:
        "Prevent regional hegemony while relying on local powers and intervening directly only when balances fail.",
      position: record(foreignIds, [0.05, -0.4, -0.25, -0.55, 0.35, -0.8, -0.5, -0.25]),
    },
  ],
};

export function specialistMatches(assessment: SpecialistAssessment, dimensions: Record<string, number>) {
  const known = assessment.dimensions.map((x) => x.id).filter((id) => Number.isFinite(dimensions[id]));
  return assessment.schools
    .map((school) => {
      const distance = Math.sqrt(
        known.reduce((sum, id) => sum + (dimensions[id] - school.position[id]) ** 2, 0) / Math.max(1, known.length),
      );
      return { school, score: Math.round(100 * Math.max(0, 1 - distance / 1.5)), distance };
    })
    .sort((a, b) => a.distance - b.distance);
}

export function specialistDimensions(
  assessment: SpecialistAssessment,
  answers: Record<string, number>,
  seed: Record<string, number> = {},
) {
  const dimensions: Record<string, number> = { ...seed };

  for (const dimension of assessment.dimensions) {
    const answered = assessment.questions.filter(
      (question) => question.dimension === dimension.id && answers[question.id] !== undefined,
    );
    if (!answered.length) continue;

    const measured =
      answered.reduce((sum, question) => sum + answers[question.id] * question.direction, 0) / answered.length;
    dimensions[dimension.id] =
      seed[dimension.id] === undefined ? measured : seed[dimension.id] * 0.35 + measured * 0.65;
  }

  return dimensions;
}
