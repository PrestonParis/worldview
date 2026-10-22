export type SuiteToolId = "issueview" | "subpoena" | "writ";

export interface ToolView {
  id: string;
  label: string;
  group: string;
  description: string;
  sourceHref?: string;
}

export const TOOL_VIEWS: Record<SuiteToolId, ToolView[]> = {
  issueview: [
    {
      id: "overview",
      label: "All issues",
      group: "Workspace",
      description: "Choose any published issue, place, or comparison view.",
    },
    {
      id: "compare",
      label: "Compare metrics",
      group: "Workspace",
      description: "Put metrics from different issues side by side.",
    },
    {
      id: "immigration",
      label: "Immigration",
      group: "Issues",
      description: "Borders, legal immigration, detention, and migration.",
      sourceHref: "/immigration",
    },
    {
      id: "crime",
      label: "Crime",
      group: "Issues",
      description: "National, state, city, and victimization trends.",
      sourceHref: "/crime",
    },
    {
      id: "guns",
      label: "Guns",
      group: "Issues",
      description: "Firearm deaths, ownership, and public opinion.",
      sourceHref: "/guns",
    },
    {
      id: "abortion",
      label: "Abortion",
      group: "Issues",
      description: "Rates, travel, telehealth, and state limits.",
      sourceHref: "/abortion",
    },
    {
      id: "economy",
      label: "Economy",
      group: "Economy",
      description: "Jobs, inflation, wages, income, and output.",
      sourceHref: "/economy",
    },
    {
      id: "housing",
      label: "Housing",
      group: "Economy",
      description: "Prices, mortgages, rents, and ownership.",
      sourceHref: "/housing",
    },
    {
      id: "healthcare",
      label: "Healthcare",
      group: "Economy",
      description: "Coverage, cost, outcomes, and overdose deaths.",
      sourceHref: "/healthcare",
    },
    {
      id: "energy",
      label: "Energy",
      group: "Economy",
      description: "Prices, generation, emissions, and climate.",
      sourceHref: "/energy",
    },
    {
      id: "demographics",
      label: "Demographics",
      group: "Society",
      description: "Population, age, race, migration, and forecasts.",
      sourceHref: "/demographics",
    },
    {
      id: "education",
      label: "Education",
      group: "Society",
      description: "Achievement, degrees, tuition, and debt.",
      sourceHref: "/education",
    },
    {
      id: "religion",
      label: "Religion",
      group: "Society",
      description: "Tradition, attendance, belief, and geography.",
      sourceHref: "/religion",
    },
    {
      id: "family",
      label: "Family",
      group: "Society",
      description: "Fertility, marriage, households, and children.",
      sourceHref: "/family",
    },
    {
      id: "spending",
      label: "Spending",
      group: "Places & government",
      description: "Budget, deficit, debt, and federal outlays.",
      sourceHref: "/spending",
    },
    {
      id: "states",
      label: "States",
      group: "Places & government",
      description: "Every topic organized around one state.",
      sourceHref: "/states?all",
    },
  ],
  subpoena: [
    {
      id: "profile",
      label: "Case file",
      group: "Profile",
      description: "One political biography with money, lobbying, and documented relationships in context.",
    },
  ],
  writ: [
    {
      id: "docket",
      label: "Docket",
      group: "Record",
      description: "One bill, member, or race with its timeline, votes, results, and money in context.",
    },
  ],
};

export function toolView(tool: SuiteToolId, requested: string | string[] | undefined): ToolView {
  const id = Array.isArray(requested) ? requested[0] : requested;
  return TOOL_VIEWS[tool].find((view) => view.id === id) ?? TOOL_VIEWS[tool][0];
}
