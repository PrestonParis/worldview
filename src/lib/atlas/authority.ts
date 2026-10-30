export const authorityDimensionIds = [
  "legitimacy",
  "representation",
  "participation",
  "concentration",
  "executive",
  "courts",
  "federalism",
  "liberty",
  "administration",
  "parties",
  "change",
  "emergency",
] as const;

export type AuthorityDimensionId = (typeof authorityDimensionIds)[number];
export type AuthorityConfidence = "low" | "medium" | "high";
export type AuthorityModeId = "snapshot" | "profile" | "deep";

export interface AuthorityDimension {
  id: AuthorityDimensionId;
  group: "source" | "structure" | "state" | "stress";
  name: string;
  negative: string;
  positive: string;
  prompt: string;
}

export const authorityDimensions: AuthorityDimension[] = [
  {
    id: "legitimacy",
    group: "source",
    name: "Source of legitimacy",
    negative: "Popular consent",
    positive: "Tradition & higher law",
    prompt: "Why does authority deserve obedience?",
  },
  {
    id: "representation",
    group: "source",
    name: "Representation",
    negative: "Proportional & plural",
    positive: "Majoritarian & decisive",
    prompt: "How should votes become governing power?",
  },
  {
    id: "participation",
    group: "source",
    name: "Citizen participation",
    negative: "Broad & direct",
    positive: "Delegated & selective",
    prompt: "How directly should citizens govern?",
  },
  {
    id: "concentration",
    group: "structure",
    name: "Concentration of power",
    negative: "Dispersed & checked",
    positive: "Unified & coordinated",
    prompt: "How divided should public power be?",
  },
  {
    id: "executive",
    group: "structure",
    name: "Executive authority",
    negative: "Constrained & accountable",
    positive: "Independent & decisive",
    prompt: "How much freedom should executives have?",
  },
  {
    id: "courts",
    group: "structure",
    name: "Courts & constitutional review",
    negative: "Legislative supremacy",
    positive: "Strong judicial review",
    prompt: "Who should have the last word on rights?",
  },
  {
    id: "federalism",
    group: "structure",
    name: "Level of government",
    negative: "Local autonomy",
    positive: "National uniformity",
    prompt: "At what level should power rest?",
  },
  {
    id: "liberty",
    group: "state",
    name: "Liberty & public order",
    negative: "Civil liberty",
    positive: "Collective order",
    prompt: "When may public order limit individual freedom?",
  },
  {
    id: "administration",
    group: "state",
    name: "Democracy & expertise",
    negative: "Political accountability",
    positive: "Independent expertise",
    prompt: "Who should control administration?",
  },
  {
    id: "parties",
    group: "state",
    name: "Parties & organized interests",
    negative: "Plural competition",
    positive: "Integrated public purpose",
    prompt: "How should organized groups shape government?",
  },
  {
    id: "change",
    group: "stress",
    name: "Constitutional change",
    negative: "Continuity & restraint",
    positive: "Popular transformation",
    prompt: "How readily should the constitutional order change?",
  },
  {
    id: "emergency",
    group: "stress",
    name: "Emergency power",
    negative: "Rules remain binding",
    positive: "Exceptional discretion",
    prompt: "What changes in a genuine crisis?",
  },
];

export const AUTHORITY_GROUPS = [
  { id: "source", label: "Consent & representation" },
  { id: "structure", label: "Constitutional structure" },
  { id: "state", label: "Governing the state" },
  { id: "stress", label: "Change & crisis" },
] as const;

export interface AuthorityQuestion {
  id: string;
  dimension: AuthorityDimensionId;
  text: string;
  direction: -1 | 1;
  tier: "core" | "clarify" | "deep";
  why: string;
  options?: { value: number; label: string }[];
}

const q = (
  id: string,
  dimension: AuthorityDimensionId,
  direction: -1 | 1,
  tier: AuthorityQuestion["tier"],
  text: string,
  why: string,
): AuthorityQuestion => ({ id, dimension, direction, tier, text, why });
const choice = (
  id: string,
  dimension: AuthorityDimensionId,
  tier: AuthorityQuestion["tier"],
  text: string,
  why: string,
  options: { value: number; label: string }[],
): AuthorityQuestion => ({ id, dimension, direction: 1, tier, text, why, options });

export const authorityQuestions: AuthorityQuestion[] = [
  q(
    "legitimacy-consent",
    "legitimacy",
    -1,
    "core",
    "No government is legitimate unless citizens can peacefully remove its leaders.",
    "Tests whether continuing popular consent is a necessary condition of authority.",
  ),
  q(
    "legitimacy-tradition",
    "legitimacy",
    1,
    "core",
    "Long-standing institutions can possess legitimate authority even when they were never designed by popular vote.",
    "Tests whether inherited continuity can itself ground legitimacy.",
  ),
  q(
    "legitimacy-rights",
    "legitimacy",
    -1,
    "clarify",
    "A democratic majority loses its claim to obedience when it systematically denies equal political rights.",
    "Separates raw majority rule from consent bounded by equal citizenship.",
  ),
  q(
    "legitimacy-sacred",
    "legitimacy",
    1,
    "clarify",
    "Public law should acknowledge moral or religious truths that do not depend on popular approval.",
    "Tests whether political legitimacy reaches beyond public consent.",
  ),
  q(
    "legitimacy-performance",
    "legitimacy",
    1,
    "deep",
    "A government that reliably provides security and prosperity may be legitimate without competitive elections.",
    "Tests performance as an independent source of authority.",
  ),

  q(
    "representation-proportional",
    "representation",
    -1,
    "core",
    "A party winning 15 percent of the vote should receive about 15 percent of legislative seats.",
    "Tests proportional pluralism against winner-take-all government.",
  ),
  q(
    "representation-mandate",
    "representation",
    1,
    "core",
    "Elections should usually produce a clear governing majority even if seat totals do not mirror vote totals.",
    "Tests decisiveness as a goal of electoral design.",
  ),
  choice(
    "representation-coalition",
    "representation",
    "clarify",
    "An election leaves five parties in parliament and no majority. What is the best outcome?",
    "Uses coalition formation to expose the tradeoff between representation and decisive mandates.",
    [
      { value: -1, label: "A broad coalition reflecting most voters" },
      { value: -0.3, label: "A smaller coalition negotiated in parliament" },
      { value: 0.35, label: "A minority government with issue-by-issue support" },
      { value: 1, label: "A new runoff that produces one clear winner" },
    ],
  ),
  q(
    "representation-districts",
    "representation",
    1,
    "clarify",
    "Representatives tied to local districts are more accountable than members chosen from national party lists.",
    "Tests territorial representation against proportional party representation.",
  ),
  q(
    "representation-sortition",
    "representation",
    -1,
    "deep",
    "A permanent citizens’ assembly selected by lot should share lawmaking power with elected legislators.",
    "Tests descriptive participation beyond electoral competition.",
  ),

  q(
    "participation-referenda",
    "participation",
    -1,
    "core",
    "Citizens should vote directly on major national laws more often.",
    "Tests direct popular decision-making.",
  ),
  q(
    "participation-delegation",
    "participation",
    1,
    "core",
    "Most governing decisions should be left to elected representatives who have time to study them.",
    "Tests the case for delegated judgment.",
  ),
  q(
    "participation-local",
    "participation",
    -1,
    "clarify",
    "Residents should directly decide a meaningful share of their local public budget.",
    "Tests participation where citizens can deliberate over concrete tradeoffs.",
  ),
  q(
    "participation-duty",
    "participation",
    -1,
    "clarify",
    "Voting should be treated as a civic duty and may reasonably be compulsory.",
    "Tests whether participation is a public obligation rather than only a right.",
  ),
  q(
    "participation-unequal",
    "participation",
    1,
    "deep",
    "High participation can amplify organized minorities without making government more representative.",
    "Tests skepticism about participation as an automatic democratic good.",
  ),

  q(
    "concentration-separation",
    "concentration",
    -1,
    "core",
    "Dividing power among institutions is worth slower and less coherent government.",
    "Tests checks and balances when they impose visible costs.",
  ),
  q(
    "concentration-coherence",
    "concentration",
    1,
    "core",
    "Voters should be able to identify one governing majority and hold it responsible for results.",
    "Tests unified power as a basis for accountability.",
  ),
  q(
    "concentration-vetoes",
    "concentration",
    -1,
    "clarify",
    "Important laws should have to survive approval by independently elected institutions.",
    "Tests multiple veto points against simple majority control.",
  ),
  q(
    "concentration-gridlock",
    "concentration",
    1,
    "clarify",
    "Persistent gridlock is a greater democratic failure than the risk that a majority may govern too aggressively.",
    "Forces the core tradeoff between action and restraint.",
  ),
  q(
    "concentration-independent",
    "concentration",
    -1,
    "deep",
    "Election administration and district boundaries should be controlled by bodies independent of the governing party.",
    "Tests dispersing power over the rules of political competition.",
  ),

  q(
    "executive-legislature",
    "executive",
    -1,
    "core",
    "The executive should remain politically dependent on the confidence of the legislature.",
    "Tests parliamentary accountability against an independent executive mandate.",
  ),
  q(
    "executive-mandate",
    "executive",
    1,
    "core",
    "A nationally elected leader needs enough independent authority to carry out a public mandate.",
    "Tests the case for a decisive presidency.",
  ),
  choice(
    "executive-deadlock",
    "executive",
    "clarify",
    "The executive and legislature cannot agree on a budget and public services are about to stop. What should happen?",
    "Uses institutional deadlock to distinguish executive discretion from legislative control.",
    [
      { value: -1, label: "The prior budget continues automatically" },
      { value: -0.35, label: "A caretaker cabinet negotiates a temporary budget" },
      { value: 0.35, label: "A rapid national election resolves the mandate" },
      { value: 1, label: "The executive temporarily funds essential services" },
    ],
  ),
  q(
    "executive-appointments",
    "executive",
    -1,
    "clarify",
    "Senior executive appointments should usually require confirmation by another elected institution.",
    "Tests checks on control of the state apparatus.",
  ),
  q(
    "executive-decrees",
    "executive",
    1,
    "deep",
    "When a legislature repeatedly refuses to address an urgent problem, broad executive rulemaking is justified.",
    "Tests unilateral action outside a formal emergency.",
  ),

  q(
    "courts-review",
    "courts",
    1,
    "core",
    "Independent courts should be able to invalidate laws that violate constitutional rights.",
    "Tests strong judicial review.",
  ),
  q(
    "courts-legislature",
    "courts",
    -1,
    "core",
    "On disputed moral and social questions, elected legislatures should have the final word.",
    "Tests legislative supremacy and democratic correction.",
  ),
  choice(
    "courts-rights",
    "courts",
    "clarify",
    "A national majority passes a law restricting an unpopular minority’s public expression. Who should make the final decision?",
    "Places judicial review in its strongest rights-protection case while keeping democratic costs visible.",
    [
      { value: -1, label: "The legislature after renewed public debate" },
      { value: -0.25, label: "A second legislative chamber representing regions" },
      { value: 0.35, label: "A court may suspend it, but lawmakers can override" },
      { value: 1, label: "A constitutional court may strike it down permanently" },
    ],
  ),
  q(
    "courts-appointments",
    "courts",
    -1,
    "clarify",
    "Constitutional judges should serve fixed terms rather than hold office for life.",
    "Tests democratic renewal within judicial independence.",
  ),
  q(
    "courts-evolving",
    "courts",
    1,
    "deep",
    "Courts may legitimately apply old constitutional principles to rights their authors did not anticipate.",
    "Tests an evolving constitution against original public meaning.",
  ),

  q(
    "federalism-local",
    "federalism",
    -1,
    "core",
    "Regions should be free to adopt substantially different policies even when national citizens receive unequal services.",
    "Tests local self-rule when it creates territorial inequality.",
  ),
  q(
    "federalism-national",
    "federalism",
    1,
    "core",
    "Basic rights and public services should be uniform across the country.",
    "Tests national citizenship against regional variation.",
  ),
  choice(
    "federalism-conflict",
    "federalism",
    "clarify",
    "A region refuses to enforce a national civil-rights rule that its voters strongly oppose. What should prevail?",
    "Tests the limit of local autonomy in a rights conflict.",
    [
      { value: -1, label: "The regional rule unless its own courts reject it" },
      { value: -0.3, label: "Negotiated local implementation with a long transition" },
      { value: 0.4, label: "National funding is withheld until the region complies" },
      { value: 1, label: "National authorities enforce the right directly" },
    ],
  ),
  q(
    "federalism-experiment",
    "federalism",
    -1,
    "clarify",
    "Regions should be able to experiment with policies that the national government would not choose.",
    "Tests decentralization as institutional learning.",
  ),
  q(
    "federalism-solidarity",
    "federalism",
    1,
    "deep",
    "National redistribution should substantially equalize the resources available to rich and poor regions.",
    "Tests whether national solidarity limits fiscal autonomy.",
  ),

  q(
    "liberty-speech",
    "liberty",
    -1,
    "core",
    "Political speech should remain legal even when it is deeply offensive or destabilizing.",
    "Tests the civil-libertarian presumption in a hard case.",
  ),
  q(
    "liberty-order",
    "liberty",
    1,
    "core",
    "Government may restrict some individual choices to preserve shared norms and public order.",
    "Tests a substantive public-order role for law.",
  ),
  q(
    "liberty-protest",
    "liberty",
    -1,
    "clarify",
    "Peaceful protest should receive strong legal protection even when it seriously disrupts daily life.",
    "Tests liberty when expression imposes public costs.",
  ),
  q(
    "liberty-surveillance",
    "liberty",
    1,
    "clarify",
    "Limited surveillance of public spaces is acceptable when it measurably prevents violent crime.",
    "Tests privacy against collective security.",
  ),
  q(
    "liberty-association",
    "liberty",
    -1,
    "deep",
    "Private associations should often be free to set membership rules that public institutions could not adopt.",
    "Tests pluralism and freedom of association against equal-access norms.",
  ),

  q(
    "administration-accountable",
    "administration",
    -1,
    "core",
    "Elected officials should be able to redirect agencies when voters demand a different policy.",
    "Tests democratic control of administration.",
  ),
  q(
    "administration-expertise",
    "administration",
    1,
    "core",
    "Technical agencies work best when professional experts are insulated from day-to-day politics.",
    "Tests independent expertise.",
  ),
  choice(
    "administration-risk",
    "administration",
    "clarify",
    "A new technology may bring large benefits but experts disagree about its risks. Who should set the rule?",
    "Separates expert judgment, public accountability, and participatory oversight.",
    [
      { value: -1, label: "Elected lawmakers after open public hearings" },
      { value: -0.3, label: "A citizens’ panel advised by competing experts" },
      { value: 0.35, label: "An agency under a rule set by lawmakers" },
      { value: 1, label: "An independent technical regulator" },
    ],
  ),
  q(
    "administration-career",
    "administration",
    1,
    "clarify",
    "A politically neutral career civil service is more important than letting a new government quickly replace senior officials.",
    "Tests bureaucratic continuity against electoral responsiveness.",
  ),
  q(
    "administration-transparency",
    "administration",
    -1,
    "deep",
    "Administrative decisions should be reversible by elected officials even when reversal contradicts the evidence record.",
    "Tests where final responsibility lies when expertise and mandate diverge.",
  ),

  q(
    "parties-competition",
    "parties",
    -1,
    "core",
    "Democracy works best when several parties and civic groups compete openly for influence.",
    "Tests pluralist competition.",
  ),
  q(
    "parties-purpose",
    "parties",
    1,
    "core",
    "A governing movement needs enough internal discipline to carry out a coherent public program.",
    "Tests organized unity as a condition of effective government.",
  ),
  q(
    "parties-primary",
    "parties",
    -1,
    "clarify",
    "Party leaders should have little control over which candidates may run under the party label.",
    "Tests open competition within parties.",
  ),
  q(
    "parties-finance",
    "parties",
    1,
    "clarify",
    "Interest groups should face strict limits on political spending even when those limits reduce political expression.",
    "Tests regulating plural influence in the name of political equality.",
  ),
  q(
    "parties-corporatist",
    "parties",
    1,
    "deep",
    "Labor, business, and professional associations should have a formal role in national policymaking.",
    "Tests integrated representation of organized interests rather than lobbying competition.",
  ),

  q(
    "change-stability",
    "change",
    -1,
    "core",
    "Constitutions should be deliberately difficult to change, even after a durable electoral majority demands reform.",
    "Tests stability against popular responsiveness.",
  ),
  q(
    "change-refounding",
    "change",
    1,
    "core",
    "A generation should be able to refound political institutions it no longer considers legitimate.",
    "Tests constituent power and democratic transformation.",
  ),
  q(
    "change-amendment",
    "change",
    -1,
    "clarify",
    "Major constitutional amendments should require more than a simple national majority.",
    "Tests supermajoritarian restraint.",
  ),
  q(
    "change-convention",
    "change",
    1,
    "clarify",
    "A citizens’ constitutional convention can legitimately bypass institutions that benefit from the status quo.",
    "Tests extraordinary popular procedures for structural change.",
  ),
  q(
    "change-continuity",
    "change",
    -1,
    "deep",
    "Preserving institutional continuity is usually more important than making the constitution internally consistent.",
    "Tests conservative constitutionalism beyond any particular policy.",
  ),

  q(
    "emergency-rules",
    "emergency",
    -1,
    "core",
    "Emergency powers should expire quickly unless the legislature renews them.",
    "Tests whether ordinary checks remain binding under pressure.",
  ),
  q(
    "emergency-discretion",
    "emergency",
    1,
    "core",
    "In a genuine national crisis, leaders need room to act before normal procedures can catch up.",
    "Tests the basic case for exceptional discretion.",
  ),
  choice(
    "emergency-attack",
    "emergency",
    "clarify",
    "After a major attack, officials believe another is imminent but cannot reveal the intelligence. What authority should they receive?",
    "Forces a choice among speed, secrecy, and institutional authorization.",
    [
      { value: -1, label: "Only powers already authorized in ordinary law" },
      { value: -0.3, label: "Secret court approval for narrowly defined actions" },
      { value: 0.4, label: "A short emergency grant reviewed within days" },
      { value: 1, label: "Broad temporary authority until the threat passes" },
    ],
  ),
  q(
    "emergency-election",
    "emergency",
    -1,
    "clarify",
    "National elections should proceed on schedule even during war or a severe domestic emergency.",
    "Tests whether electoral continuity is non-negotiable.",
  ),
  q(
    "emergency-remedy",
    "emergency",
    1,
    "deep",
    "Courts should usually defer to the executive on security measures while a declared emergency is active.",
    "Tests judicial restraint at the point where executive claims are hardest to verify.",
  ),
];

export const authorityQuestionById = new Map(authorityQuestions.map((question) => [question.id, question]));

export interface AuthoritySchool {
  id: string;
  name: string;
  summary: string;
  philosophyId?: string;
  core: AuthorityDimensionId[];
  position: Record<AuthorityDimensionId, number>;
}

const p = (values: number[]) =>
  Object.fromEntries(authorityDimensionIds.map((id, index) => [id, values[index]])) as Record<
    AuthorityDimensionId,
    number
  >;

export const authoritySchools: AuthoritySchool[] = [
  {
    id: "liberal-constitutionalism",
    name: "Liberal constitutionalism",
    philosophyId: "modern-liberalism",
    summary: "Popular government bounded by rights, independent courts, divided power, and durable legal rules.",
    core: ["legitimacy", "concentration", "courts", "liberty"],
    position: p([-0.9, -0.35, 0.2, -0.8, -0.75, 0.9, 0.2, -0.85, 0.35, -0.55, -0.45, -0.8]),
  },
  {
    id: "civic-republicanism",
    name: "Civic republicanism",
    summary: "Self-government, civic participation, public virtue, and resistance to arbitrary or dominating power.",
    core: ["legitimacy", "participation", "concentration", "liberty"],
    position: p([-0.9, -0.35, -0.85, -0.8, -0.7, 0.25, -0.35, -0.5, -0.45, 0.15, 0.25, -0.8]),
  },
  {
    id: "participatory-democracy",
    name: "Participatory democracy",
    summary: "Authority rises from frequent, broad, and direct citizen participation at every level of public life.",
    core: ["participation", "representation", "federalism", "change"],
    position: p([-1, -0.8, -1, -0.8, -0.9, -0.25, -0.75, -0.65, -0.7, -0.6, 0.75, -0.9]),
  },
  {
    id: "deliberative-democracy",
    name: "Deliberative democracy",
    summary:
      "Legitimate decisions emerge from inclusive public reasoning, citizens’ assemblies, and revisable consensus.",
    core: ["legitimacy", "participation", "representation", "administration"],
    position: p([-1, -0.9, -0.8, -0.55, -0.7, 0.15, -0.35, -0.55, -0.1, -0.65, 0.4, -0.8]),
  },
  {
    id: "parliamentary-democracy",
    name: "Parliamentary democracy",
    summary: "Proportional representation and accountable party government join decisiveness to legislative control.",
    core: ["representation", "executive", "parties"],
    position: p([-0.95, -0.65, 0.3, 0.25, -0.85, -0.15, 0.25, -0.6, 0.15, 0.15, -0.1, -0.75]),
  },
  {
    id: "constitutional-federalism",
    name: "Constitutional federalism",
    philosophyId: "constitutional-conservatism",
    summary: "Divided sovereignty, regional self-rule, enumerated powers, and strong institutional checks.",
    core: ["concentration", "federalism", "courts", "change"],
    position: p([-0.75, 0.15, 0.25, -1, -0.85, 0.75, -1, -0.75, -0.25, -0.45, -0.8, -0.9]),
  },
  {
    id: "majoritarian-presidentialism",
    name: "Majoritarian presidentialism",
    summary: "A nationally elected executive receives a strong mandate to act decisively and be judged by results.",
    core: ["representation", "concentration", "executive", "emergency"],
    position: p([-0.9, 0.85, 0.45, 0.75, 1, -0.45, 0.75, 0.2, -0.35, 0.45, 0.45, 0.6]),
  },
  {
    id: "technocratic-governance",
    name: "Technocratic governance",
    philosophyId: "technocracy",
    summary:
      "Competence, evidence, and insulated professional institutions carry much of the burden of legitimate rule.",
    core: ["administration", "participation", "courts"],
    position: p([-0.15, -0.2, 0.85, 0.35, 0.05, 0.55, 0.6, 0.15, 1, 0.3, -0.15, 0.25]),
  },
  {
    id: "developmental-state",
    name: "Developmental state",
    philosophyId: "developmentalism",
    summary: "A capable central administration coordinates institutions around long-term national development.",
    core: ["concentration", "administration", "parties", "federalism"],
    position: p([0.05, 0.55, 0.75, 0.85, 0.7, -0.2, 0.9, 0.35, 0.9, 0.7, 0.4, 0.6]),
  },
  {
    id: "social-democratic-state",
    name: "Social-democratic administrative state",
    philosophyId: "social-democracy",
    summary:
      "Parliamentary democracy and a professional public sector turn broad electoral mandates into universal provision.",
    core: ["representation", "executive", "administration", "parties"],
    position: p([-0.95, -0.65, 0.15, 0.1, -0.7, 0.35, 0.65, -0.6, 0.6, 0.25, 0.15, -0.75]),
  },
  {
    id: "libertarian-minimal-state",
    name: "Libertarian minimal government",
    philosophyId: "libertarianism",
    summary:
      "Coercive authority is tightly limited by individual liberty, local choice, and strict constitutional rules.",
    core: ["liberty", "concentration", "federalism", "emergency"],
    position: p([-0.75, -0.15, 0.15, -1, -1, 0.4, -1, -1, -0.8, -0.7, -0.7, -1]),
  },
  {
    id: "democratic-confederalism",
    name: "Democratic confederalism",
    philosophyId: "libertarian-socialism",
    summary:
      "Local assemblies and federated councils coordinate society without concentrating sovereignty in a central state.",
    core: ["participation", "concentration", "federalism", "parties"],
    position: p([-1, -0.8, -1, -1, -1, -0.3, -1, -0.65, -0.75, -0.8, 0.75, -0.95]),
  },
  {
    id: "plebiscitary-democracy",
    name: "Plebiscitary democracy",
    summary:
      "A direct relationship between a popular leader and national majority overrides many institutional intermediaries.",
    core: ["legitimacy", "executive", "concentration", "courts"],
    position: p([-0.85, 0.9, -0.4, 0.9, 1, -0.9, 0.95, 0.65, -0.4, 0.8, 0.8, 0.9]),
  },
  {
    id: "traditional-monarchy",
    name: "Traditional monarchy",
    philosophyId: "monarchism",
    summary:
      "Inherited institutions, customary obligation, and continuity anchor authority above electoral competition.",
    core: ["legitimacy", "change", "parties", "executive"],
    position: p([1, 0.45, 0.85, 0.7, 0.8, -0.1, 0.15, 0.65, 0.2, 0.8, -1, 0.65]),
  },
  {
    id: "theocratic-authority",
    name: "Theocratic authority",
    summary:
      "Public law and political office are answerable to a transcendent religious order rather than popular will alone.",
    core: ["legitimacy", "liberty", "change"],
    position: p([1, 0.4, 0.8, 0.8, 0.75, 0.1, 0.6, 1, 0.25, 0.75, -0.9, 0.65]),
  },
  {
    id: "vanguard-party",
    name: "Vanguard-party government",
    philosophyId: "marxism-leninism",
    summary:
      "A disciplined political organization integrates state and society to pursue a transformative historical program.",
    core: ["parties", "concentration", "change", "liberty"],
    position: p([0.25, 0.95, 0.85, 1, 0.95, -0.95, 1, 0.95, 0.8, 1, 1, 0.95]),
  },
  {
    id: "anarchist-association",
    name: "Anarchist voluntary association",
    philosophyId: "anarchism",
    summary: "Voluntary association and self-governing communities replace centralized, coercive political authority.",
    core: ["concentration", "participation", "federalism", "liberty"],
    position: p([-1, -0.9, -1, -1, -1, -1, -1, -1, -1, -1, 0.9, -1]),
  },
];

export const AUTHORITY_MODES: Record<
  AuthorityModeId,
  { id: AuthorityModeId; name: string; shortName: string; description: string; target: number; minutes: string }
> = {
  snapshot: {
    id: "snapshot",
    name: "Democratic snapshot",
    shortName: "Snapshot",
    description: "A first reading across all twelve dimensions of power and government.",
    target: 14,
    minutes: "3–4 min",
  },
  profile: {
    id: "profile",
    name: "Constitutional profile",
    shortName: "Profile",
    description: "A stable governing neighborhood, defining commitments, and institutional tensions.",
    target: 32,
    minutes: "8–10 min",
  },
  deep: {
    id: "deep",
    name: "Deep power map",
    shortName: "Deep map",
    description: "Every dimension clarified through principles, tradeoffs, and institutional stress tests.",
    target: authorityQuestions.length,
    minutes: "15–20 min",
  },
};

export const nextAuthorityMode = (mode: AuthorityModeId): AuthorityModeId | null =>
  mode === "snapshot" ? "profile" : mode === "profile" ? "deep" : null;
export type AuthorityAnswers = Record<string, number | null>;
export type AuthoritySeedValue = number | { value: number; confidence: AuthorityConfidence };
export type AuthoritySeed = Partial<Record<AuthorityDimensionId, AuthoritySeedValue>>;

export interface AuthorityDimensionReading {
  id: AuthorityDimensionId;
  mean: number;
  confidence: AuthorityConfidence;
  direct: number;
  uncertain: number;
  seeded: boolean;
  spread: number;
}
const seedParts = (seed: AuthoritySeedValue | undefined) =>
  typeof seed === "number" ? { value: seed, confidence: "medium" as const } : seed;

export function authorityReadings(answers: AuthorityAnswers, seed: AuthoritySeed = {}): AuthorityDimensionReading[] {
  return authorityDimensionIds.map((id) => {
    const questions = authorityQuestions.filter((question) => question.dimension === id);
    const values = questions.flatMap((question) =>
      typeof answers[question.id] === "number" ? [answers[question.id]! * question.direction] : [],
    );
    const uncertain = questions.filter((question) => answers[question.id] === null).length;
    const prior = seedParts(seed[id]);
    const priorWeight = prior ? (prior.confidence === "high" ? 0.75 : prior.confidence === "medium" ? 0.45 : 0.2) : 0;
    const measured = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const mean =
      values.length + priorWeight > 0
        ? (measured * values.length + (prior?.value ?? 0) * priorWeight) / (values.length + priorWeight)
        : 0;
    const spread =
      values.length > 1
        ? Math.sqrt(values.reduce((sum, value) => sum + (value - measured) ** 2, 0) / values.length)
        : 1;
    const confidence: AuthorityConfidence =
      values.length >= 4 && spread < 0.72 ? "high" : values.length >= 2 && spread < 1.05 ? "medium" : "low";
    return { id, mean, confidence, direct: values.length, uncertain, seeded: !!prior, spread };
  });
}

export const authorityDimensionValues = (answers: AuthorityAnswers, seed: AuthoritySeed = {}) =>
  Object.fromEntries(authorityReadings(answers, seed).map((reading) => [reading.id, reading.mean]));
export interface AuthorityMatch {
  school: AuthoritySchool;
  distance: number;
  score: number;
  fit: "strong" | "partial" | "tentative";
}

export function authorityMatches(
  dimensions: Record<string, number>,
  readings?: AuthorityDimensionReading[],
): AuthorityMatch[] {
  const byId = new Map(readings?.map((reading) => [reading.id, reading]));
  return authoritySchools
    .map((school) => {
      let sum = 0;
      let weights = 0;
      for (const id of authorityDimensionIds) {
        const reading = byId.get(id);
        const confidenceWeight = reading
          ? reading.confidence === "high"
            ? 1
            : reading.confidence === "medium"
              ? 0.72
              : reading.direct > 0
                ? 0.45
                : 0.2
          : 1;
        const weight = confidenceWeight * (school.core.includes(id) ? 1.3 : 1);
        sum += (dimensions[id] - school.position[id]) ** 2 * weight;
        weights += weight;
      }
      const distance = Math.sqrt(sum / Math.max(0.001, weights));
      const measured = readings?.filter((reading) => reading.direct > 0).length ?? authorityDimensionIds.length;
      const fit: AuthorityMatch["fit"] =
        measured < 8 || distance > 0.7 ? "tentative" : distance < 0.42 ? "strong" : "partial";
      return { school, distance, score: Math.round(100 * Math.max(0, 1 - distance / 1.5)), fit };
    })
    .sort((a, b) => a.distance - b.distance);
}

export const authorityAnswerCount = (answers: AuthorityAnswers) =>
  Object.values(answers).filter((value) => typeof value === "number").length;

export function authorityModeComplete(answers: AuthorityAnswers, mode: AuthorityModeId) {
  const covered = new Set(
    Object.keys(answers).flatMap((id) => {
      const question = authorityQuestionById.get(id);
      return question ? [question.dimension] : [];
    }),
  );
  const asked = Object.keys(answers).length;
  const target = AUTHORITY_MODES[mode].target;
  return (
    asked >= target &&
    covered.size === authorityDimensionIds.length &&
    (authorityAnswerCount(answers) >= Math.ceil(target * 0.6) ||
      asked >= Math.min(authorityQuestions.length, target + 6))
  );
}

export function nextAuthorityQuestion(
  answers: AuthorityAnswers,
  seed: AuthoritySeed,
  mode: AuthorityModeId,
): AuthorityQuestion | null {
  const unanswered = authorityQuestions.filter((question) => !(question.id in answers));
  if (!unanswered.length || authorityModeComplete(answers, mode)) return null;
  const readings = authorityReadings(answers, seed);
  const askedByDimension = Object.fromEntries(
    authorityDimensionIds.map((id) => [
      id,
      authorityQuestions.filter((question) => question.dimension === id && question.id in answers).length,
    ]),
  ) as Record<AuthorityDimensionId, number>;
  const uncovered = authorityDimensionIds.filter((id) => askedByDimension[id] === 0);
  if (uncovered.length)
    return unanswered.find((question) => question.dimension === uncovered[0] && question.tier === "core") ?? null;
  const dimensions = authorityDimensionValues(answers, seed);
  const leaders = authorityMatches(dimensions, readings)
    .slice(0, 3)
    .map((match) => match.school);
  const availableTier =
    mode === "snapshot"
      ? ["core", "clarify"]
      : mode === "profile"
        ? ["core", "clarify", "deep"]
        : ["core", "clarify", "deep"];
  return (
    [...unanswered].sort((a, b) => {
      const ar = readings.find((reading) => reading.id === a.dimension)!;
      const br = readings.find((reading) => reading.id === b.dimension)!;
      const score = (question: AuthorityQuestion, reading: AuthorityDimensionReading) => {
        const coverage = askedByDimension[question.dimension] === 0 ? 100 : 0;
        const uncertainty =
          reading.direct === 0 ? 35 : reading.confidence === "low" ? 24 : reading.confidence === "medium" ? 10 : 0;
        const contradiction = reading.spread > 0.9 ? 15 : 0;
        const positions = leaders.map((school) => school.position[question.dimension]);
        const separation = (Math.max(...positions) - Math.min(...positions)) * 12;
        const tier = availableTier.includes(question.tier)
          ? question.tier === "core"
            ? 8
            : question.tier === "clarify"
              ? 5
              : 2
          : -50;
        return coverage + uncertainty + contradiction + separation + tier - askedByDimension[question.dimension] * 5;
      };
      return score(b, br) - score(a, ar);
    })[0] ?? null
  );
}
