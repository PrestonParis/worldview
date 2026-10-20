export const economicDimensionIds = [
  "ownership", "coordination", "firms", "distribution", "labor", "competition", "land", "money", "trade", "growth",
] as const;
export type EconomicDimensionId = (typeof economicDimensionIds)[number];

export interface EconomicDimension {
  id: EconomicDimensionId;
  name: string;
  negative: string;
  positive: string;
  prompt: string;
}

export const economicDimensions: EconomicDimension[] = [
  { id: "ownership", name: "Ownership", negative: "Social & cooperative", positive: "Private", prompt: "Who should own productive assets?" },
  { id: "coordination", name: "Coordination", negative: "Public planning", positive: "Markets", prompt: "How should production and prices be coordinated?" },
  { id: "firms", name: "Firm governance", negative: "Workers & stakeholders", positive: "Owners & shareholders", prompt: "Who should govern a firm?" },
  { id: "distribution", name: "Distribution", negative: "Equality & guarantees", positive: "Market rewards", prompt: "How should income and security be distributed?" },
  { id: "labor", name: "Labor", negative: "Collective bargaining", positive: "Individual contracting", prompt: "How should bargaining power at work be organized?" },
  { id: "competition", name: "Competition", negative: "Coordination & scale", positive: "Competition & entry", prompt: "Should policy coordinate firms or maximize competition?" },
  { id: "land", name: "Land & resources", negative: "Common claim", positive: "Private title", prompt: "Who has the strongest claim to land and natural rents?" },
  { id: "money", name: "Money & banking", negative: "Public direction", positive: "Independent & decentralized", prompt: "Who should direct money and credit?" },
  { id: "trade", name: "Trade & production", negative: "National resilience", positive: "Open trade", prompt: "Should resilience or specialization come first?" },
  { id: "growth", name: "Growth & limits", negative: "Ecological limits", positive: "Abundance & growth", prompt: "Should material growth remain the central economic aim?" },
];

export interface EconomicQuestion {
  id: string;
  dimension: EconomicDimensionId;
  text: string;
  direction: -1 | 1;
}

export const economicQuestions: EconomicQuestion[] = [
  { id: "ownership-1", dimension: "ownership", direction: -1, text: "Employees should ordinarily have an ownership stake in the firms where they work." },
  { id: "ownership-2", dimension: "ownership", direction: 1, text: "Private ownership is usually the fairest basis for deciding how productive assets are used." },
  { id: "coordination-1", dimension: "coordination", direction: 1, text: "Prices usually communicate scarcity and demand better than public planning can." },
  { id: "coordination-2", dimension: "coordination", direction: -1, text: "Democratic planning should guide investment in major sectors instead of leaving it to markets." },
  { id: "firms-1", dimension: "firms", direction: -1, text: "Workers should elect a substantial share of every large company's board." },
  { id: "firms-2", dimension: "firms", direction: 1, text: "A company's directors should ultimately answer to its owners rather than to several competing groups." },
  { id: "distribution-1", dimension: "distribution", direction: -1, text: "Everyone should receive a material floor high enough to participate fully in society." },
  { id: "distribution-2", dimension: "distribution", direction: 1, text: "Large income differences can be legitimate when they emerge from voluntary exchange and risk-taking." },
  { id: "labor-1", dimension: "labor", direction: -1, text: "Sector-wide bargaining should set wages and conditions across an industry." },
  { id: "labor-2", dimension: "labor", direction: 1, text: "Workers and employers should generally negotiate terms without unions or government setting a common contract." },
  { id: "competition-1", dimension: "competition", direction: 1, text: "Policy should favor new entrants and break up entrenched firms even when large scale is efficient." },
  { id: "competition-2", dimension: "competition", direction: -1, text: "Government, business, and labor should coordinate national economic priorities together." },
  { id: "land-1", dimension: "land", direction: -1, text: "The rental value of land and natural resources belongs partly to the public and should fund public needs." },
  { id: "land-2", dimension: "land", direction: 1, text: "Secure private title should include nearly all gains in the value of land." },
  { id: "money-1", dimension: "money", direction: -1, text: "Public institutions should direct more credit toward housing, infrastructure, and strategic industry." },
  { id: "money-2", dimension: "money", direction: 1, text: "Money and credit are safer when political officials have very little power to direct them." },
  { id: "trade-1", dimension: "trade", direction: -1, text: "A country should preserve domestic capacity in essential industries even when imports are cheaper." },
  { id: "trade-2", dimension: "trade", direction: 1, text: "People should be free to buy from abroad unless a narrow security interest clearly justifies a barrier." },
  { id: "growth-1", dimension: "growth", direction: -1, text: "Rich societies should accept less consumption when continued growth puts ecological systems at risk." },
  { id: "growth-2", dimension: "growth", direction: 1, text: "Innovation and abundant energy can let economies grow while solving environmental problems." },
];

export interface EconomicSchool {
  id: string;
  name: string;
  summary: string;
  philosophyId?: string;
  position: Record<EconomicDimensionId, number>;
}

const p = (values: number[]): Record<EconomicDimensionId, number> =>
  Object.fromEntries(economicDimensionIds.map((id, i) => [id, values[i]])) as Record<EconomicDimensionId, number>;

export const economicSchools: EconomicSchool[] = [
  { id: "classical-liberalism", name: "Classical liberalism", philosophyId: "classical-liberalism", summary: "Private property, competitive markets, open exchange, and tightly limited economic government.", position: p([.8,.9,.8,.6,.8,.9,.7,.7,.9,.7]) },
  { id: "neoliberalism", name: "Neoliberalism", philosophyId: "neoliberalism", summary: "Market allocation and open trade within rules designed by capable public institutions.", position: p([.7,.8,.7,.25,.5,.8,.6,.55,.95,.8]) },
  { id: "ordoliberalism", name: "Ordoliberalism", summary: "A strong legal state creates and polices a competitive market order while resisting private monopoly.", position: p([.65,.7,.55,.1,.2,1,.55,.55,.7,.6]) },
  { id: "social-democracy", name: "Social democracy", philosophyId: "social-democracy", summary: "Markets and private firms combined with organized labor, social insurance, and broad public services.", position: p([.2,.35,-.25,-.75,-.8,.45,.05,-.1,.35,.25]) },
  { id: "democratic-socialism", name: "Democratic socialism", philosophyId: "democratic-socialism", summary: "Democratic institutions moving economic power toward social ownership and worker control.", position: p([-.75,-.45,-.75,-.85,-.85,-.1,-.35,-.45,-.2,-.15]) },
  { id: "market-socialism", name: "Market socialism", philosophyId: "market-socialism", summary: "Social or worker ownership with markets still coordinating much production and exchange.", position: p([-.75,.55,-.9,-.55,-.8,.7,-.25,-.15,.4,.25]) },
  { id: "marxian-socialism", name: "Marxian socialism", philosophyId: "marxism-leninism", summary: "Class and ownership are central; productive assets move from capital to collective control.", position: p([-1,-.8,-.9,-.9,-.85,-.6,-.7,-.8,-.45,.1]) },
  { id: "georgism", name: "Georgism", philosophyId: "georgism", summary: "Free markets and private capital paired with a common claim on land value and natural rents.", position: p([.65,.85,.65,-.05,.45,.9,-1,.6,.95,.75]) },
  { id: "distributism", name: "Distributism", philosophyId: "distributism", summary: "Widely dispersed family and cooperative property, local production, and resistance to concentrated power.", position: p([.2,.1,-.45,-.3,-.5,-.25,.1,.05,-.45,-.1]) },
  { id: "mutualism", name: "Mutualism", philosophyId: "mutualism", summary: "Voluntary exchange among workers, cooperatives, and mutual institutions without capitalist hierarchy.", position: p([-.55,.7,-1,-.35,-.7,.8,-.6,.45,.65,.15]) },
  { id: "corporatism", name: "Corporatism", summary: "Organized labor, business, and the state coordinate economic decisions by sector and national priority.", position: p([.1,-.45,-.45,-.25,-.8,-.9,.1,-.55,-.45,.25]) },
  { id: "economic-nationalism", name: "Economic nationalism", summary: "National productive capacity, strategic industry, and domestic workers take priority over open trade.", position: p([.45,-.15,.4,.15,.05,-.35,.4,-.5,-1,.65]) },
  { id: "degrowth", name: "Degrowth & ecological economics", philosophyId: "eco-socialism", summary: "Ecological limits, sufficiency, and well-being take priority over expanding aggregate production.", position: p([-.35,-.5,-.5,-.7,-.55,-.25,-.8,-.35,-.55,-1]) },
];

export function economicMatches(dimensions: Record<string, number>) {
  const known = economicDimensionIds.filter((id) => Number.isFinite(dimensions[id]));
  return economicSchools
    .map((school) => {
      const distance = Math.sqrt(known.reduce((sum, id) => sum + (dimensions[id] - school.position[id]) ** 2, 0) / Math.max(1, known.length));
      return { school, distance, score: Math.round(100 * Math.max(0, 1 - distance / 1.5)) };
    })
    .sort((a, b) => a.distance - b.distance);
}
