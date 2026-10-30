export type ProductId = "subpoena" | "writ" | "issueview" | "atlas";

export interface ToolMetadata {
  id: ProductId;
  name: string;
  tagline: string;
  badge: string;
  description: string;
  href: string;
  iconName: string;
  capabilities: { title: string; description: string }[];
  primaryDatasets: string[];
}

export const SUITE_TOOLS: ToolMetadata[] = [
  {
    id: "subpoena",
    name: "Subpoena",
    tagline: "People & Money",
    badge: "Flagship",
    description:
      "People, organizations, campaign finance, outside spending, lobbying, donor geography, and documented power networks.",
    href: "/subpoena",
    iconName: "Briefcase",
    capabilities: [
      {
        title: "Financial Dossiers",
        description:
          "Aggregate itemized FEC contributions, cycle trends, and top donors for every candidate and committee.",
      },
      {
        title: "Lobbying Registrations",
        description: "Inspect Senate LDA filings, registered issue codes, lobbying firms, and expenditures.",
      },
      {
        title: "Network Power Graph",
        description: "Map co-sponsorships, affiliations, board seats, and organizational hierarchies.",
      },
      {
        title: "Donor Geography",
        description: "Choropleth and city-level distribution of political contributions.",
      },
    ],
    primaryDatasets: ["fec-donors", "lda-lobbying", "political-figures", "fec-independent-expenditures"],
  },
  {
    id: "writ",
    name: "Writ",
    tagline: "Government & Elections",
    badge: "Government",
    description:
      "Legislation, roll calls, courts, member comparisons, elections, districts, the electorate, and your representatives.",
    href: "/writ",
    iconName: "Scroll",
    capabilities: [
      {
        title: "Roll-Call Disunity & Crossovers",
        description: "Measure party line adherence, vote defectors, and bipartisan bill coalitions.",
      },
      {
        title: "Ideological Polarization",
        description: "DW-NOMINATE historical score distributions across the 118th and 119th Congresses.",
      },
      {
        title: "Supreme Court Docket",
        description: "Decisions, majority opinions, and ideological split classifications since 1946.",
      },
      {
        title: "Electoral Shifts",
        description: "Presidential and Senate margins mapped at state and county resolutions.",
      },
    ],
    primaryDatasets: ["congress-bills", "congress-votes", "voteview", "scdb", "election-returns"],
  },
  {
    id: "atlas",
    name: "Worldview Atlas",
    tagline: "Ideology & Traditions",
    badge: "Quiz & Profiling",
    description:
      "Adaptive political profiling across 20 dimensions and major issue fights, specialist policy modules, and an interactive library of historical political traditions.",
    href: "/atlas",
    iconName: "Compass",
    capabilities: [
      {
        title: "Adaptive 20-Axis Engine",
        description: "Computerized adaptive testing that refines high-uncertainty ideological dimensions.",
      },
      {
        title: "Specialist Assessments",
        description: "Targeted modules for Political Economy, Authority, and Foreign Policy.",
      },
      {
        title: "Philosophy Matching",
        description: "Distance-ranked similarity to dozens of codified political traditions.",
      },
      {
        title: "Profile Sync & Sharing",
        description: "Save, revisit, and compare ideological profiles with public or private tokens.",
      },
    ],
    primaryDatasets: ["quiz-bank", "political-philosophies"],
  },
];
