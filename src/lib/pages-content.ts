export interface PageContent {
  slug: string;
  title: string;
  tagline: string;
  features: string[];
}

export const pagesContent: Record<string, PageContent> = {
  people: {
    slug: "people",
    title: "People & Power",
    tagline: "Who's connected to whom, and how they got there.",
    features: [
      "Relationship graph",
      "Organization graph",
      "Administration personnel map",
      "Endorsement graph",
      "Political dynasty / family graph",
      "Career timeline",
    ],
  },
  legislation: {
    slug: "legislation",
    title: "Legislation & Courts",
    tagline: "Bills, votes, promises, and the cases that test them.",
    features: [
      "Amendment diff",
      "Campaign promise tracker",
      "Court case explorer",
      "Supreme Court precedent graph",
    ],
  },
  money: {
    slug: "money",
    title: "Money & Influence",
    tagline: "Where the money and the people move together.",
    features: [
      "Geographic donor map",
      "Lobbying network",
      "Revolving door tracker",
    ],
  },
  elections: {
    slug: "elections",
    title: "Elections & Maps",
    tagline: "Races, results, and the geography underneath them.",
    features: [
      "Election explorer",
      "Election scenario simulator",
      "County / precinct political explorer",
      "Electoral swing map",
      "District explorer",
      "Gerrymandering viewer",
    ],
  },
  geography: {
    slug: "geography",
    title: "Geography",
    tagline: "Borders, alliances, and the resources and routes underneath them.",
    features: [
      "War / geopolitics studio",
      "Alliance / treaty graph",
      "Sanctions explorer",
      "Trade dependency map",
    ],
  },
};
