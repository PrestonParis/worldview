export interface NavPage {
  label: string;
  navLabel: string;
  href: string;
}

export const generalPages: NavPage[] = [
  { label: "People & Power", navLabel: "People", href: "/people" },
  { label: "Legislation & Courts", navLabel: "Legislation", href: "/legislation" },
  { label: "Money & Influence", navLabel: "Money", href: "/money" },
  { label: "Elections & Maps", navLabel: "Elections", href: "/elections" },
  { label: "Political Quiz", navLabel: "Quiz", href: "/quiz" },
  { label: "Geography", navLabel: "Geography", href: "/geography" },
];

export const primaryPages: NavPage[] = [
  { label: "Immigration", navLabel: "Immigration", href: "/immigration" },
  { label: "Crime", navLabel: "Crime", href: "/crime" },
  { label: "Abortion", navLabel: "Abortion", href: "/abortion" },
  { label: "Demographics", navLabel: "Demographics", href: "/demographics" },
  { label: "Datasets", navLabel: "Datasets", href: "/datasets" },
  { label: "My Government", navLabel: "My Government", href: "/my-government" },
];

export const toolPages: NavPage[] = [...generalPages, ...primaryPages];

// Header layout: themed menus, each item a page plus a one-line blurb.
export interface NavGroup {
  id: string;
  label: string;
  items: { page: NavPage; blurb: string }[];
}

const page = (href: string): NavPage => {
  const hit = toolPages.find((p) => p.href === href);
  if (!hit) throw new Error(`nav: no page for ${href}`);
  return hit;
};

export const navGroups: NavGroup[] = [
  {
    id: "issues",
    label: "Issues",
    items: [
      { page: page("/immigration"), blurb: "Border encounters, green cards, refugees, detention" },
      { page: page("/crime"), blurb: "Violent and property crime, nationally and by state" },
      { page: page("/abortion"), blurb: "Abortions by state, travel, telehealth, and state limits" },
      { page: page("/demographics"), blurb: "Who lives here, and forecasts through 2050" },
    ],
  },
  {
    id: "power",
    label: "Power",
    items: [
      { page: page("/people"), blurb: "Who's connected to whom, and how" },
      { page: page("/money"), blurb: "Donors, PACs, lobbying, and money flow" },
      { page: page("/legislation"), blurb: "Bills, votes, and Supreme Court cases" },
    ],
  },
  {
    id: "democracy",
    label: "Democracy",
    items: [
      { page: page("/elections"), blurb: "Results, ratings, and county maps" },
      { page: page("/my-government"), blurb: "Your officials, districts, and votes" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      { page: page("/quiz"), blurb: "Map your views on 17 axes and 25 issues" },
      { page: page("/geography"), blurb: "Annotated map graphics for broadcast and social" },
    ],
  },
];

// Top-level links shown beside the menus.
export const navLinks: NavPage[] = [page("/datasets")];

export const dataAdminPage: NavPage = {
  label: "Manage Data",
  navLabel: "Manage Data",
  href: "/data",
};
