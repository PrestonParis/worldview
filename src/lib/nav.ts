export interface NavPage {
  label: string;
  navLabel: string;
  href: string;
  bundles: string;
}

export const generalPages: NavPage[] = [
  { label: "People & Power", navLabel: "People", href: "/people", bundles: "Relationships, orgs, admin staff, endorsements, dynasties, careers" },
  { label: "Legislation & Courts", navLabel: "Legislation", href: "/legislation", bundles: "Bills, amendments, votes, promises, court cases" },
  { label: "Money & Influence", navLabel: "Money", href: "/money", bundles: "Donor networks, money flow, lobbying, revolving door" },
  { label: "Elections & Maps", navLabel: "Elections", href: "/elections", bundles: "Elections, simulators, county/district maps" },
  { label: "Political Quiz", navLabel: "Quiz", href: "/quiz", bundles: "An adaptive quiz mapping your views on 17 axes and 25 issues" },
  { label: "Geography", navLabel: "Geography", href: "/geography", bundles: "War studio, alliances, sanctions, trade dependency" },
];

export const primaryPages: NavPage[] = [
  { label: "Immigration", navLabel: "Immigration", href: "/immigration", bundles: "Border encounters, green cards, naturalizations, refugees, asylum, migration, and detention" },
  { label: "Crime", navLabel: "Crime", href: "/crime", bundles: "Violent and property crime rates, nationally and by state" },
  { label: "Demographics", navLabel: "Demographics", href: "/demographics", bundles: "National population composition and annual forecasts through 2050" },
  { label: "Datasets", navLabel: "Datasets", href: "/datasets", bundles: "Every dataset on the platform, its method and coverage, and how institutions publish their own" },
  { label: "My Government", navLabel: "My Government", href: "/my-government", bundles: "Your officials, districts, votes, donors, promises, and scorecards" },
];

export const toolPages: NavPage[] = [...generalPages, ...primaryPages];

export const dataAdminPage: NavPage = {
  label: "Manage Data",
  navLabel: "Manage Data",
  href: "/data",
  bundles: "Add and edit entities, relationships, claims, and sources by hand",
};
