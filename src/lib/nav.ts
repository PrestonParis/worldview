export interface NavPage {
  label: string;
  href: string;
  bundles: string;
}

export const toolPages: NavPage[] = [
  { label: "People & Power", href: "/people", bundles: "Relationships, orgs, admin staff, endorsements, dynasties, careers" },
  { label: "Statements & Rhetoric", href: "/statements", bundles: "Position history, quotes, terminology, rhetoric, narratives" },
  { label: "Fact-Check & Authority", href: "/fact-check", bundles: "Claim workbench, argument maps, \"can they do that\"" },
  { label: "News & Timelines", href: "/news", bundles: "News organizer, story evolution, event & scandal timelines" },
  { label: "Creator Studio", href: "/studio", bundles: "Speech/debate/interview analysis, clip & b-roll library" },
  { label: "Legislation & Courts", href: "/legislation", bundles: "Bills, amendments, votes, promises, court cases" },
  { label: "Money & Influence", href: "/money", bundles: "Donor networks, money flow, lobbying, revolving door" },
  { label: "Alignment & Coalitions", href: "/alignment", bundles: "Similarity, coalitions, ideology, platform comparison" },
  { label: "Elections & Maps", href: "/elections", bundles: "Elections, simulators, county/district maps" },
  { label: "Geopolitics", href: "/geopolitics", bundles: "War studio, alliances, sanctions, trade dependency" },
];

export const dataAdminPage: NavPage = {
  label: "Manage Data",
  href: "/data",
  bundles: "Add and edit entities, relationships, claims, and sources by hand",
};
