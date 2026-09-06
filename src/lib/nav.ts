export interface NavPage {
  label: string;
  navLabel: string;
  href: string;
  bundles: string;
}

export const toolPages: NavPage[] = [
  { label: "People & Power", navLabel: "People", href: "/people", bundles: "Relationships, orgs, admin staff, endorsements, dynasties, careers" },
  { label: "Legislation & Courts", navLabel: "Legislation", href: "/legislation", bundles: "Bills, amendments, votes, promises, court cases" },
  { label: "Money & Influence", navLabel: "Money", href: "/money", bundles: "Donor networks, money flow, lobbying, revolving door" },
  { label: "Elections & Maps", navLabel: "Elections", href: "/elections", bundles: "Elections, simulators, county/district maps" },
  { label: "Geography", navLabel: "Geography", href: "/geography", bundles: "War studio, alliances, sanctions, trade dependency" },
];

export const dataAdminPage: NavPage = {
  label: "Manage Data",
  navLabel: "Manage Data",
  href: "/data",
  bundles: "Add and edit entities, relationships, claims, and sources by hand",
};
