export interface PageContent {
  slug: string;
  title: string;
  tagline: string;
  features: string[];
}

export const pagesContent: Record<string, PageContent> = {
  "my-government": {
    slug: "my-government",
    title: "My Government",
    tagline: "Every public office that represents your address, in one place.",
    features: [
      "Address-based district matching",
      "Local, county, state, federal, and judicial offices",
      "Votes, donors, promises, and scorecards",
      "Source-backed coverage status",
    ],
  },
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
  demographics: {
    slug: "demographics",
    title: "Demographics",
    tagline: "How the United States is changing, projected year by year.",
    features: [
      "Sex composition",
      "Race composition",
      "Sexual orientation",
      "Religious affiliation",
    ],
  },
  quiz: {
    slug: "quiz",
    title: "Political Quiz",
    tagline: "Where you stand, axis by axis and issue by issue.",
    features: [
      "17 political axes",
      "25 issue policy profiles",
      "55 ideological traditions ranked",
      "Adaptive question selection",
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
