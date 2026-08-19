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
  statements: {
    slug: "statements",
    title: "Statements & Rhetoric",
    tagline: "What people said, when, and how the language shifted.",
    features: [
      "Statement & position history",
      "Quote & phrase provenance",
      "Rhetoric & narrative tracker",
    ],
  },
  "fact-check": {
    slug: "fact-check",
    title: "Fact-Check & Authority",
    tagline: "Is it true, and could they actually do it.",
    features: [
      "Argument mapper",
      "“What changed?” politics engine",
      "“Can they actually do that?” tool",
      "Executive power explorer",
      "Policy dependency graph",
    ],
  },
  news: {
    slug: "news",
    title: "News & Timelines",
    tagline: "What actually happened, and how the story moved.",
    features: [
      "Political news organizer",
      "Story evolution tracker",
      "Primary source finder",
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
      "Industry support explorer",
      "Geographic donor map",
      "Lobbying network",
      "Revolving door tracker",
    ],
  },
  alignment: {
    slug: "alignment",
    title: "Alignment & Coalitions",
    tagline: "Who actually agrees with whom, by vote, speech, or platform.",
    features: [
      "Coalition / voting bloc detector",
      "Agreeability measurement",
      "Coalition calculator",
      "Issue coalition graph",
      "Ideology mapper",
      "Platform comparator",
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
