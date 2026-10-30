export const economicDimensionIds = [
  "ownership",
  "coordination",
  "firms",
  "distribution",
  "labor",
  "competition",
  "regulation",
  "land",
  "money",
  "fiscal",
  "trade",
  "growth",
] as const;

export type EconomicDimensionId = (typeof economicDimensionIds)[number];
export type EconomicConfidence = "low" | "medium" | "high";
export type EconomicModeId = "snapshot" | "profile" | "deep";

export interface EconomicDimension {
  id: EconomicDimensionId;
  group: "enterprise" | "security" | "state" | "future";
  name: string;
  negative: string;
  positive: string;
  prompt: string;
}

export const economicDimensions: EconomicDimension[] = [
  {
    id: "ownership",
    group: "enterprise",
    name: "Productive ownership",
    negative: "Social & cooperative",
    positive: "Private investors",
    prompt: "Who should own productive assets?",
  },
  {
    id: "coordination",
    group: "enterprise",
    name: "Economic coordination",
    negative: "Planning & negotiation",
    positive: "Markets & prices",
    prompt: "How should production and investment be coordinated?",
  },
  {
    id: "firms",
    group: "enterprise",
    name: "Firm governance",
    negative: "Workers & stakeholders",
    positive: "Owners & shareholders",
    prompt: "Who should govern a firm?",
  },
  {
    id: "distribution",
    group: "security",
    name: "Distribution & provision",
    negative: "Equality & guarantees",
    positive: "Market rewards",
    prompt: "How should income and material security be distributed?",
  },
  {
    id: "labor",
    group: "security",
    name: "Labor power",
    negative: "Collective bargaining",
    positive: "Individual contracting",
    prompt: "How should bargaining power at work be organized?",
  },
  {
    id: "competition",
    group: "enterprise",
    name: "Competition & concentration",
    negative: "Coordination & scale",
    positive: "Competition & entry",
    prompt: "Should policy coordinate large firms or maximize competition?",
  },
  {
    id: "regulation",
    group: "state",
    name: "Business regulation",
    negative: "Public safeguards",
    positive: "Permissionless enterprise",
    prompt: "How much should public rules constrain enterprise?",
  },
  {
    id: "land",
    group: "state",
    name: "Land & resources",
    negative: "Common claim",
    positive: "Private title",
    prompt: "Who has the strongest claim to land and natural rents?",
  },
  {
    id: "money",
    group: "state",
    name: "Money, banking & credit",
    negative: "Public direction",
    positive: "Independent & decentralized",
    prompt: "Who should direct money and credit?",
  },
  {
    id: "fiscal",
    group: "state",
    name: "Fiscal state",
    negative: "Stabilization & investment",
    positive: "Budget restraint",
    prompt: "How readily should government tax, borrow, and spend?",
  },
  {
    id: "trade",
    group: "future",
    name: "Trade & productive capacity",
    negative: "National resilience",
    positive: "Open specialization",
    prompt: "Should resilience or specialization come first?",
  },
  {
    id: "growth",
    group: "future",
    name: "Growth & ecological limits",
    negative: "Sufficiency & limits",
    positive: "Abundance & growth",
    prompt: "Should material growth remain the central economic aim?",
  },
];

export const ECONOMIC_GROUPS = [
  { id: "enterprise", label: "Ownership & enterprise" },
  { id: "security", label: "Work & security" },
  { id: "state", label: "State & macroeconomy" },
  { id: "future", label: "World & future" },
] as const;

export interface EconomicQuestion {
  id: string;
  dimension: EconomicDimensionId;
  text: string;
  direction: -1 | 1;
  tier: "core" | "clarify" | "deep";
  why: string;
  options?: { value: number; label: string }[];
}

const q = (
  id: string,
  dimension: EconomicDimensionId,
  direction: -1 | 1,
  tier: EconomicQuestion["tier"],
  text: string,
  why: string,
): EconomicQuestion => ({ id, dimension, direction, tier, text, why });

const choice = (
  id: string,
  dimension: EconomicDimensionId,
  tier: EconomicQuestion["tier"],
  text: string,
  why: string,
  options: EconomicQuestion["options"],
): EconomicQuestion => ({ id, dimension, direction: 1, tier, text, why, options });

export const economicQuestions: EconomicQuestion[] = [
  q(
    "ownership-stake",
    "ownership",
    -1,
    "core",
    "Employees should ordinarily have an ownership stake in the firms where they work.",
    "Tests whether ownership should follow work as well as invested capital.",
  ),
  q(
    "ownership-private",
    "ownership",
    1,
    "core",
    "Private ownership is usually the fairest basis for deciding how productive assets are used.",
    "Tests the basic case for investor ownership.",
  ),
  q(
    "ownership-utilities",
    "ownership",
    -1,
    "clarify",
    "Essential networks such as water, electricity, and rail should usually be publicly or cooperatively owned.",
    "Separates ordinary private property from ownership of natural monopolies.",
  ),
  q(
    "ownership-risk",
    "ownership",
    1,
    "clarify",
    "People who risk their savings to build a company should retain control even after it becomes very large.",
    "Tests whether financial risk creates a durable claim to control.",
  ),
  q(
    "ownership-funds",
    "ownership",
    -1,
    "deep",
    "Public wealth funds should gradually acquire broad ownership stakes and pay the returns to everyone.",
    "Distinguishes redistribution after the market from shared ownership before it.",
  ),
  q(
    "coordination-prices",
    "coordination",
    1,
    "core",
    "Prices usually communicate scarcity and demand better than public planning can.",
    "Tests confidence in decentralized price signals.",
  ),
  q(
    "coordination-investment",
    "coordination",
    -1,
    "core",
    "Democratic planning should guide investment in major sectors instead of leaving it to markets.",
    "Tests support for deliberate public allocation of capital.",
  ),
  choice(
    "coordination-shortage",
    "coordination",
    "clarify",
    "A critical medicine is in shortage. What should decide who receives it first?",
    "Uses scarcity to separate price allocation from public allocation.",
    [
      { value: -1, label: "Public-health rules and clinical need" },
      { value: -0.33, label: "A negotiated allocation among hospitals and producers" },
      { value: 0.33, label: "A regulated market with price limits" },
      { value: 1, label: "Market prices and private purchasing decisions" },
    ],
  ),
  q(
    "coordination-councils",
    "coordination",
    -1,
    "clarify",
    "Government, business, and labor should negotiate national production and wage goals together.",
    "Tests negotiated coordination rather than central planning.",
  ),
  q(
    "coordination-local",
    "coordination",
    -1,
    "deep",
    "Local participatory planning can allocate community investment more fairly than financial markets.",
    "Separates decentralized planning from both markets and central control.",
  ),
  q(
    "firms-board",
    "firms",
    -1,
    "core",
    "Workers should elect a substantial share of every large company’s board.",
    "Tests formal worker power inside conventionally owned firms.",
  ),
  q(
    "firms-owners",
    "firms",
    1,
    "core",
    "A company’s directors should ultimately answer to its owners rather than to several competing groups.",
    "Tests shareholder primacy.",
  ),
  q(
    "firms-purpose",
    "firms",
    -1,
    "clarify",
    "Large companies should be legally responsible to workers, communities, and the environment as well as shareholders.",
    "Tests stakeholder governance without requiring social ownership.",
  ),
  q(
    "firms-takeover",
    "firms",
    1,
    "clarify",
    "If new owners can make a company more valuable, they should generally be free to replace its leadership and strategy.",
    "Tests the market for corporate control.",
  ),
  q(
    "firms-coops",
    "firms",
    -1,
    "deep",
    "Tax and finance policy should actively favor worker cooperatives over conventionally owned firms.",
    "Distinguishes tolerating cooperatives from deliberately promoting them.",
  ),
  q(
    "distribution-floor",
    "distribution",
    -1,
    "core",
    "Everyone should receive a material floor high enough to participate fully in society.",
    "Tests support for an unconditional social minimum.",
  ),
  q(
    "distribution-rewards",
    "distribution",
    1,
    "core",
    "Large income differences can be legitimate when they emerge from voluntary exchange and risk-taking.",
    "Tests acceptance of unequal market outcomes.",
  ),
  q(
    "distribution-services",
    "distribution",
    -1,
    "clarify",
    "Health care, education, and basic housing security should be guaranteed as public rights.",
    "Tests universal provision rather than cash redistribution alone.",
  ),
  q(
    "distribution-targeted",
    "distribution",
    1,
    "clarify",
    "Public assistance should be tightly targeted to hardship rather than provided to everyone.",
    "Separates targeted safety nets from universal programs.",
  ),
  q(
    "distribution-inheritance",
    "distribution",
    -1,
    "deep",
    "Very large inheritances should be taxed heavily because heirs did not earn them.",
    "Tests equality across generations and the legitimacy of inherited wealth.",
  ),
  q(
    "labor-sectoral",
    "labor",
    -1,
    "core",
    "Industry-wide bargaining should set wages and conditions across an entire sector.",
    "Tests collective wage-setting beyond one workplace.",
  ),
  q(
    "labor-contract",
    "labor",
    1,
    "core",
    "Workers and employers should generally negotiate terms without unions or government setting a common contract.",
    "Tests the individual-contract model.",
  ),
  q(
    "labor-strike",
    "labor",
    -1,
    "clarify",
    "Workers should retain a broad right to strike even when a stoppage causes serious public disruption.",
    "Tests how much disruption collective power may legitimately impose.",
  ),
  q(
    "labor-flexibility",
    "labor",
    1,
    "clarify",
    "Making it easier to dismiss employees usually creates more opportunity than insecurity.",
    "Tests the tradeoff between labor flexibility and job protection.",
  ),
  q(
    "labor-gig",
    "labor",
    -1,
    "deep",
    "Platforms should treat regular gig workers as employees with benefits rather than independent contractors.",
    "Applies the labor-power question to ambiguous modern work.",
  ),
  q(
    "competition-entry",
    "competition",
    1,
    "core",
    "Policy should favor new entrants and break up entrenched firms even when large scale is efficient.",
    "Tests whether competitive structure outweighs economies of scale.",
  ),
  q(
    "competition-scale",
    "competition",
    -1,
    "core",
    "A few large firms can serve the public better than many small ones when scale lowers costs.",
    "Tests acceptance of concentration for efficiency.",
  ),
  choice(
    "competition-platform",
    "competition",
    "clarify",
    "One digital platform controls the market but provides a reliable, inexpensive service. What should government do?",
    "Separates regulation of monopoly from structural competition.",
    [
      { value: -1, label: "Regulate it as a utility and preserve its scale" },
      { value: -0.35, label: "Keep it intact but require open access for competitors" },
      { value: 0.4, label: "Block future acquisitions and subsidize new entrants" },
      { value: 1, label: "Break it into competing companies" },
    ],
  ),
  q(
    "competition-merger",
    "competition",
    1,
    "clarify",
    "Companies should have to prove that a major merger benefits the public before it is approved.",
    "Tests a precautionary approach to concentration.",
  ),
  q(
    "competition-national",
    "competition",
    -1,
    "deep",
    "National champions should sometimes be protected from competition so they can compete globally.",
    "Tests strategic scale against domestic competition.",
  ),
  q(
    "regulation-proof",
    "regulation",
    -1,
    "core",
    "Businesses should have to demonstrate that high-risk products are safe before selling them widely.",
    "Tests precautionary public safeguards.",
  ),
  q(
    "regulation-permission",
    "regulation",
    1,
    "core",
    "New businesses should usually be allowed to operate unless government can show a specific harm.",
    "Tests the presumption in favor of permissionless enterprise.",
  ),
  q(
    "regulation-standards",
    "regulation",
    -1,
    "clarify",
    "National labor, safety, and environmental rules should set a firm floor even when compliance is costly.",
    "Tests uniform public standards against flexibility.",
  ),
  q(
    "regulation-liability",
    "regulation",
    1,
    "clarify",
    "Holding firms liable after they cause harm is usually better than requiring permission in advance.",
    "Separates ex-post liability from ex-ante regulation.",
  ),
  q(
    "regulation-capture",
    "regulation",
    1,
    "deep",
    "Complex regulation often protects established firms more than it protects the public.",
    "Tests concern about regulatory capture.",
  ),
  q(
    "land-rent",
    "land",
    -1,
    "core",
    "The rental value of land and natural resources belongs partly to the public and should fund public needs.",
    "Tests a common claim on value nobody produced.",
  ),
  q(
    "land-title",
    "land",
    1,
    "core",
    "Secure private title should include nearly all gains in the value of land.",
    "Tests the conventional private-property claim to appreciation.",
  ),
  q(
    "land-tax",
    "land",
    -1,
    "clarify",
    "Taxes should fall more heavily on land value and less heavily on work and investment.",
    "Directly tests the Georgist tax shift.",
  ),
  q(
    "land-zoning",
    "land",
    1,
    "clarify",
    "Owners should generally be free to build more housing on their land without neighborhood approval.",
    "Tests how strongly title includes development rights.",
  ),
  q(
    "land-extraction",
    "land",
    -1,
    "deep",
    "A permanent public dividend should be paid from oil, minerals, and other natural-resource revenue.",
    "Tests shared ownership of exhaustible natural wealth.",
  ),
  q(
    "money-credit",
    "money",
    -1,
    "core",
    "Public institutions should direct more credit toward housing, infrastructure, and strategic industry.",
    "Tests deliberate public allocation of finance.",
  ),
  q(
    "money-independence",
    "money",
    1,
    "core",
    "Money is safer when elected officials have very little power to direct interest rates and credit.",
    "Tests insulation of monetary policy from politics.",
  ),
  q(
    "money-public-bank",
    "money",
    -1,
    "clarify",
    "Public banks should compete with private banks and return their profits to the community.",
    "Tests public provision within a mixed financial system.",
  ),
  q(
    "money-inflation",
    "money",
    1,
    "clarify",
    "Keeping inflation low should usually take priority over reducing unemployment quickly.",
    "Tests the central tradeoff in monetary stabilization.",
  ),
  q(
    "money-freebanking",
    "money",
    1,
    "deep",
    "People should be free to use privately issued currencies with minimal central-bank control.",
    "Distinguishes central-bank independence from genuinely decentralized money.",
  ),
  choice(
    "fiscal-recession",
    "fiscal",
    "core",
    "Unemployment is rising while public debt is already high. What should fiscal policy do first?",
    "Tests countercyclical fiscal policy under a real constraint.",
    [
      { value: -1, label: "Borrow for a large temporary jobs and investment program" },
      { value: -0.4, label: "Let automatic benefits rise but avoid a new discretionary program" },
      { value: 0.35, label: "Hold spending flat and rely mainly on monetary policy" },
      { value: 1, label: "Cut the deficit now to protect fiscal credibility" },
    ],
  ),
  q(
    "fiscal-balance",
    "fiscal",
    1,
    "core",
    "Over an ordinary economic cycle, government should be required to balance its budget.",
    "Tests rule-bound budget restraint.",
  ),
  q(
    "fiscal-investment",
    "fiscal",
    -1,
    "clarify",
    "Long-lived public infrastructure should be financed with debt rather than current taxes alone.",
    "Separates investment borrowing from routine deficits.",
  ),
  q(
    "fiscal-tax",
    "fiscal",
    1,
    "clarify",
    "Taxes should remain low even when that means fewer public services and slower deficit reduction.",
    "Tests the priority placed on limiting the fiscal state.",
  ),
  q(
    "fiscal-automatic",
    "fiscal",
    -1,
    "deep",
    "Unemployment insurance and aid to states should automatically expand when the economy weakens.",
    "Tests automatic stabilization rather than discretionary stimulus.",
  ),
  choice(
    "trade-capacity",
    "trade",
    "core",
    "Imported components are much cheaper, but domestic production would be valuable in a crisis. Which rule is best?",
    "Tests resilience against the gains from specialization.",
    [
      { value: -1, label: "Guarantee domestic capacity with procurement and subsidies" },
      { value: -0.35, label: "Keep a strategic reserve and otherwise import freely" },
      { value: 0.4, label: "Diversify foreign suppliers without subsidizing domestic firms" },
      { value: 1, label: "Buy from the most efficient source except during an actual emergency" },
    ],
  ),
  q(
    "trade-open",
    "trade",
    1,
    "core",
    "People should be free to buy from abroad unless a narrow security interest clearly justifies a barrier.",
    "Tests the presumption in favor of open trade.",
  ),
  q(
    "trade-workers",
    "trade",
    -1,
    "clarify",
    "Trade agreements should require strong labor and environmental standards even if fewer countries join them.",
    "Tests managed openness against maximum market access.",
  ),
  q(
    "trade-adjustment",
    "trade",
    1,
    "clarify",
    "Helping displaced workers adjust is better than protecting their industries from foreign competition.",
    "Tests compensation for trade against protection.",
  ),
  q(
    "trade-subsidy",
    "trade",
    -1,
    "deep",
    "Government should subsidize strategic industries even when some investments will fail.",
    "Tests tolerance for the risks of industrial policy.",
  ),
  q(
    "growth-limits",
    "growth",
    -1,
    "core",
    "Rich societies should accept less consumption when continued growth puts ecological systems at risk.",
    "Tests whether ecological limits should constrain consumption.",
  ),
  q(
    "growth-abundance",
    "growth",
    1,
    "core",
    "Innovation and abundant energy can let economies grow while solving environmental problems.",
    "Tests technological optimism about growth.",
  ),
  q(
    "growth-measure",
    "growth",
    -1,
    "clarify",
    "Policy should prioritize health, leisure, and ecological stability even when measured GDP grows more slowly.",
    "Tests goals beyond aggregate production.",
  ),
  choice(
    "growth-building",
    "growth",
    "clarify",
    "A clean-energy project would cut emissions but damage a local habitat. What should happen?",
    "Tests abundance when procedural safeguards create scarcity.",
    [
      { value: -1, label: "Protect the habitat even if the project is abandoned" },
      { value: -0.3, label: "Require a slower redesign with the least ecological damage" },
      { value: 0.4, label: "Approve it with restoration and compensation requirements" },
      { value: 1, label: "Approve it quickly because the larger climate benefit dominates" },
    ],
  ),
  q(
    "growth-carbon",
    "growth",
    1,
    "deep",
    "A steadily rising carbon price is better than government choosing which green technologies to support.",
    "Separates market-led decarbonization from directed transition.",
  ),
];

export const questionById = new Map(economicQuestions.map((question) => [question.id, question]));

export interface EconomicSchool {
  id: string;
  name: string;
  summary: string;
  philosophyId?: string;
  core: EconomicDimensionId[];
  position: Record<EconomicDimensionId, number>;
}

const p = (values: number[]): Record<EconomicDimensionId, number> =>
  Object.fromEntries(economicDimensionIds.map((id, index) => [id, values[index]])) as Record<
    EconomicDimensionId,
    number
  >;

export const economicSchools: EconomicSchool[] = [
  {
    id: "classical-liberalism",
    name: "Classical liberalism",
    philosophyId: "classical-liberalism",
    summary: "Private property, competitive markets, open exchange, and a tightly limited fiscal and regulatory state.",
    core: ["ownership", "coordination", "regulation", "fiscal", "trade"],
    position: p([0.85, 0.95, 0.8, 0.65, 0.8, 0.9, 0.9, 0.7, 0.7, 0.85, 0.95, 0.75]),
  },
  {
    id: "libertarian-market-order",
    name: "Libertarian market order",
    philosophyId: "libertarianism",
    summary:
      "Voluntary exchange, strong property rights, decentralized money, and minimal public direction of economic life.",
    core: ["ownership", "coordination", "regulation", "money", "fiscal"],
    position: p([1, 1, 0.9, 0.85, 1, 0.95, 1, 0.9, 1, 1, 1, 0.8]),
  },
  {
    id: "neoliberalism",
    name: "Neoliberalism",
    philosophyId: "neoliberalism",
    summary:
      "Market allocation and open trade within rules designed by capable public institutions and a modest safety net.",
    core: ["coordination", "competition", "regulation", "trade"],
    position: p([0.7, 0.85, 0.65, 0.25, 0.5, 0.85, 0.55, 0.55, 0.65, 0.45, 1, 0.8]),
  },
  {
    id: "ordoliberalism",
    name: "Social market economy",
    summary:
      "A strong legal state protects competition while social insurance and worker institutions spread market prosperity.",
    core: ["competition", "regulation", "distribution", "labor"],
    position: p([0.65, 0.7, 0.2, -0.25, -0.45, 1, 0.15, 0.45, 0.45, 0.1, 0.65, 0.55]),
  },
  {
    id: "keynesian-mixed-economy",
    name: "Keynesian mixed economy",
    summary:
      "Predominantly private markets stabilized by public spending, regulated finance, social insurance, and full-employment policy.",
    core: ["distribution", "money", "fiscal", "regulation"],
    position: p([0.55, 0.5, 0.4, -0.35, -0.25, 0.45, -0.35, 0.25, -0.45, -0.8, 0.45, 0.55]),
  },
  {
    id: "social-democracy",
    name: "Social democracy",
    philosophyId: "social-democracy",
    summary:
      "Markets and private firms combined with organized labor, universal services, and active macroeconomic government.",
    core: ["distribution", "labor", "regulation", "fiscal"],
    position: p([0.2, 0.35, -0.25, -0.8, -0.85, 0.45, -0.55, 0.05, -0.35, -0.75, 0.3, 0.2]),
  },
  {
    id: "democratic-socialism",
    name: "Democratic socialism",
    philosophyId: "democratic-socialism",
    summary:
      "Democratic institutions move ownership, investment, and workplace power toward social and worker control.",
    core: ["ownership", "coordination", "firms", "distribution", "labor"],
    position: p([-0.8, -0.55, -0.85, -0.9, -0.9, -0.1, -0.65, -0.45, -0.7, -0.8, -0.25, -0.25]),
  },
  {
    id: "market-socialism",
    name: "Market socialism",
    philosophyId: "market-socialism",
    summary: "Worker or social ownership with markets still coordinating much production and exchange.",
    core: ["ownership", "coordination", "firms", "labor"],
    position: p([-0.8, 0.6, -1, -0.6, -0.85, 0.75, 0.15, -0.3, -0.25, -0.45, 0.45, 0.25]),
  },
  {
    id: "marxian-socialism",
    name: "Marxian planned socialism",
    philosophyId: "marxism-leninism",
    summary:
      "Productive assets and investment move from capital markets to collective ownership and comprehensive planning.",
    core: ["ownership", "coordination", "firms", "distribution"],
    position: p([-1, -1, -0.9, -0.95, -0.9, -0.7, -0.8, -0.75, -0.9, -0.85, -0.55, 0.05]),
  },
  {
    id: "mutualism",
    name: "Mutualism",
    philosophyId: "mutualism",
    summary:
      "Voluntary markets among worker-owned firms, mutual banks, and possession-based property without capitalist hierarchy.",
    core: ["ownership", "coordination", "firms", "money"],
    position: p([-0.55, 0.8, -1, -0.35, -0.75, 0.9, 0.75, -0.65, 0.55, 0.55, 0.7, 0.15]),
  },
  {
    id: "georgism",
    name: "Georgism",
    philosophyId: "georgism",
    summary: "Free markets and private capital paired with a common claim on land value and natural rents.",
    core: ["land", "coordination", "competition", "trade"],
    position: p([0.7, 0.9, 0.65, -0.05, 0.45, 0.95, 0.75, -1, 0.6, 0.3, 1, 0.75]),
  },
  {
    id: "distributism",
    name: "Distributism",
    philosophyId: "distributism",
    summary:
      "Widely dispersed family, cooperative, and small-business property with local production and resistance to concentrated power.",
    core: ["ownership", "firms", "competition", "trade"],
    position: p([0.05, 0.15, -0.5, -0.35, -0.5, 0.35, -0.15, 0.05, 0.05, 0.15, -0.55, -0.15]),
  },
  {
    id: "corporatism",
    name: "Corporatism",
    summary: "Organized labor, business, and the state negotiate economic decisions by sector and national priority.",
    core: ["coordination", "labor", "competition", "trade"],
    position: p([0.15, -0.55, -0.5, -0.3, -0.9, -0.9, -0.45, 0.1, -0.65, -0.45, -0.5, 0.25]),
  },
  {
    id: "developmental-state",
    name: "Developmental state",
    philosophyId: "developmentalism",
    summary:
      "A capable state directs finance, trade, and industry toward long-run productive capacity and technological catch-up.",
    core: ["coordination", "money", "fiscal", "trade", "growth"],
    position: p([0.45, -0.45, 0.2, 0.05, -0.15, -0.45, -0.35, 0.35, -0.9, -0.7, -0.75, 0.9]),
  },
  {
    id: "economic-nationalism",
    name: "Economic nationalism",
    summary:
      "Domestic production, strategic autonomy, and national workers take priority over open trade and pure market efficiency.",
    core: ["trade", "coordination", "competition"],
    position: p([0.5, -0.2, 0.4, 0.1, 0.05, -0.45, -0.15, 0.4, -0.5, -0.35, -1, 0.65]),
  },
  {
    id: "abundance",
    name: "Abundance economics",
    philosophyId: "abundance-liberalism",
    summary:
      "Build more housing, energy, infrastructure, and technology by combining capable public investment with fewer supply barriers.",
    core: ["competition", "regulation", "fiscal", "growth"],
    position: p([0.45, 0.7, 0.3, -0.2, 0.2, 0.85, 0.65, 0.2, -0.15, -0.55, 0.65, 1]),
  },
  {
    id: "degrowth",
    name: "Degrowth & ecological economics",
    philosophyId: "eco-socialism",
    summary:
      "Ecological limits, sufficiency, and well-being take priority over expanding aggregate production and consumption.",
    core: ["growth", "ownership", "coordination", "distribution"],
    position: p([-0.4, -0.55, -0.55, -0.75, -0.6, -0.25, -0.75, -0.8, -0.45, -0.55, -0.6, -1]),
  },
];

export const ECONOMIC_MODES: Record<
  EconomicModeId,
  { id: EconomicModeId; name: string; shortName: string; description: string; target: number; minutes: string }
> = {
  snapshot: {
    id: "snapshot",
    name: "Economic snapshot",
    shortName: "Snapshot",
    description: "A first reading across all twelve economic dimensions.",
    target: 14,
    minutes: "3–4 min",
  },
  profile: {
    id: "profile",
    name: "Economic profile",
    shortName: "Profile",
    description: "A stable neighborhood, defining commitments, and meaningful alternatives.",
    target: 32,
    minutes: "8–10 min",
  },
  deep: {
    id: "deep",
    name: "Deep economic map",
    shortName: "Deep map",
    description: "Every dimension clarified, including contradictions and close school comparisons.",
    target: economicQuestions.length,
    minutes: "15–20 min",
  },
};

export const nextEconomicMode = (mode: EconomicModeId): EconomicModeId | null =>
  mode === "snapshot" ? "profile" : mode === "profile" ? "deep" : null;

export type EconomicAnswers = Record<string, number | null>;
export type EconomicSeedValue = number | { value: number; confidence: EconomicConfidence };
export type EconomicSeed = Partial<Record<EconomicDimensionId, EconomicSeedValue>>;

export interface EconomicDimensionReading {
  id: EconomicDimensionId;
  mean: number;
  confidence: EconomicConfidence;
  direct: number;
  uncertain: number;
  seeded: boolean;
  spread: number;
}

function seedParts(seed: EconomicSeedValue | undefined) {
  if (typeof seed === "number") return { value: seed, confidence: "medium" as const };
  return seed;
}

export function economicReadings(answers: EconomicAnswers, seed: EconomicSeed = {}): EconomicDimensionReading[] {
  return economicDimensionIds.map((id) => {
    const questions = economicQuestions.filter((question) => question.dimension === id);
    const values = questions.flatMap((question) => {
      const answer = answers[question.id];
      return typeof answer === "number" && Number.isFinite(answer) ? [answer * question.direction] : [];
    });
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
    const confidence: EconomicConfidence =
      values.length >= 4 && spread < 0.72 ? "high" : values.length >= 2 && spread < 1.05 ? "medium" : "low";
    return { id, mean, confidence, direct: values.length, uncertain, seeded: !!prior, spread };
  });
}

export function economicDimensionValues(answers: EconomicAnswers, seed: EconomicSeed = {}) {
  return Object.fromEntries(economicReadings(answers, seed).map((reading) => [reading.id, reading.mean]));
}

export interface EconomicMatch {
  school: EconomicSchool;
  distance: number;
  score: number;
  fit: "strong" | "partial" | "tentative";
}

export function economicMatches(
  dimensions: Record<string, number>,
  readings?: EconomicDimensionReading[],
): EconomicMatch[] {
  const known = economicDimensionIds.filter((id) => Number.isFinite(dimensions[id]));
  const byId = new Map(readings?.map((reading) => [reading.id, reading]));
  return economicSchools
    .map((school) => {
      let weights = 0;
      let sum = 0;
      for (const id of known) {
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
      const measured = readings?.filter((reading) => reading.direct > 0).length ?? known.length;
      const fit: EconomicMatch["fit"] =
        measured < 8 || distance > 0.7 ? "tentative" : distance < 0.42 ? "strong" : "partial";
      return { school, distance, score: Math.round(100 * Math.max(0, 1 - distance / 1.5)), fit };
    })
    .sort((a, b) => a.distance - b.distance);
}

export function economicModeComplete(answers: EconomicAnswers, mode: EconomicModeId) {
  const covered = new Set(
    Object.keys(answers).flatMap((id) => {
      const question = questionById.get(id);
      return question ? [question.dimension] : [];
    }),
  );
  const asked = Object.keys(answers).length;
  const direct = economicAnswerCount(answers);
  const target = ECONOMIC_MODES[mode].target;
  const enoughDirect = direct >= Math.ceil(target * 0.6);
  const exhaustedClarifiers = asked >= Math.min(economicQuestions.length, target + 6);
  return asked >= target && covered.size === economicDimensionIds.length && (enoughDirect || exhaustedClarifiers);
}

export function nextEconomicQuestion(
  answers: EconomicAnswers,
  seed: EconomicSeed,
  mode: EconomicModeId,
): EconomicQuestion | null {
  const unanswered = economicQuestions.filter((question) => !(question.id in answers));
  if (!unanswered.length || economicModeComplete(answers, mode)) return null;
  const askedByDimension = Object.fromEntries(
    economicDimensionIds.map((id) => [
      id,
      economicQuestions.filter((question) => question.dimension === id && question.id in answers).length,
    ]),
  ) as Record<EconomicDimensionId, number>;
  const uncovered = economicDimensionIds.filter((id) => askedByDimension[id] === 0);
  if (uncovered.length)
    return unanswered.find((question) => question.dimension === uncovered[0] && question.tier === "core") ?? null;

  const readings = economicReadings(answers, seed);
  const dimensions = economicDimensionValues(answers, seed);
  const leaders = economicMatches(dimensions, readings)
    .slice(0, 3)
    .map((match) => match.school);
  const byId = new Map(readings.map((reading) => [reading.id, reading]));
  return (
    unanswered
      .map((question) => {
        const reading = byId.get(question.dimension)!;
        const positions = leaders.map((school) => school.position[question.dimension]);
        const separation = Math.max(...positions) - Math.min(...positions);
        const confidence = reading.confidence === "low" ? 2.2 : reading.confidence === "medium" ? 1.2 : 0.45;
        const coverage = 1 / (1 + askedByDimension[question.dimension]);
        const uncertainty = reading.uncertain > 0 ? 0.35 : 0;
        const tier =
          mode === "deep"
            ? question.tier === "deep"
              ? 0.25
              : 0
            : question.tier === "core"
              ? 0.25
              : question.tier === "clarify"
                ? 0.15
                : -0.3;
        return { question, score: confidence + coverage + separation * 0.8 + uncertainty + tier };
      })
      .sort((a, b) => b.score - a.score || a.question.id.localeCompare(b.question.id))[0]?.question ?? null
  );
}

export function economicAnswerCount(answers: EconomicAnswers) {
  return Object.values(answers).filter((answer): answer is number => typeof answer === "number").length;
}
