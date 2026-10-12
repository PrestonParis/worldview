export interface PageContent {
  slug: string;
  title: string;
  tagline: string;
}

export const pagesContent: Record<string, PageContent> = {
  people: {
    slug: "people",
    title: "People & Power",
    tagline: "Who's connected to whom, and how they got there.",
  },
  legislation: {
    slug: "legislation",
    title: "Legislation & Courts",
    tagline: "Bills, votes, and the cases that test them.",
  },
  money: {
    slug: "money",
    title: "Money & Influence",
    tagline: "Where the money and the people move together.",
  },
  elections: {
    slug: "elections",
    title: "Elections & Maps",
    tagline: "Races, results, and the geography underneath them.",
  },
  geography: {
    slug: "geography",
    title: "Geography",
    tagline: "Annotated map graphics, exported for broadcast and social.",
  },
};
