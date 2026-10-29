// The shared tool shell's per-tool configuration: name, search, and the left
// rail. A rail link either stays in the tool or, marked `leaves`, opens a
// public page outside it. Only built features appear; no placeholders.

import { TOOL_VIEWS, type SuiteToolId } from "./views";

export interface RailLink {
  label: string;
  href: string;
  /** Opens a public page outside the tool. */
  leaves?: boolean;
  /** Active for this exact path only (default: path or any sub-path). */
  exact?: boolean;
}

export interface RailGroup {
  label: string;
  links: RailLink[];
}

export interface ToolShellConfig {
  id: SuiteToolId;
  name: string;
  tagline: string;
  home: string;
  /** GET form target with the query in `q`; tools without search leave it out. */
  search?: { action: string; placeholder: string };
  /** Heading for recently opened items; tools whose rail already lists everything leave it out. */
  recentLabel?: string;
  rail: RailGroup[];
}

export const TOOL_SHELLS: Record<SuiteToolId, ToolShellConfig> = {
  subpoena: {
    id: "subpoena",
    name: "Subpoena",
    tagline: "People & money",
    home: "/subpoena",
    search: { action: "/subpoena/search", placeholder: "Search people, PACs and companies" },
    recentLabel: "Recent case files",
    rail: [
      { label: "Subpoena", links: [{ label: "Search", href: "/subpoena", exact: true }] },
      {
        label: "Browse",
        links: [
          { label: "People & Power", href: "/people", leaves: true },
          { label: "Organizations", href: "/people/orgs", leaves: true },
          { label: "Money", href: "/money", leaves: true },
        ],
      },
    ],
  },
  writ: {
    id: "writ",
    name: "Writ",
    tagline: "Government & elections",
    home: "/writ",
    search: { action: "/writ", placeholder: "Search bills, members and races" },
    recentLabel: "Recent dockets",
    rail: [
      {
        label: "Writ",
        links: [
          { label: "Search", href: "/writ", exact: true },
          { label: "Close races", href: "/writ/close-races" },
        ],
      },
      {
        label: "Browse",
        links: [
          { label: "Legislation", href: "/legislation", leaves: true },
          { label: "Bills", href: "/legislation/bills", leaves: true },
          { label: "Elections", href: "/elections", leaves: true },
        ],
      },
    ],
  },
  issueview: {
    id: "issueview",
    name: "IssueView",
    tagline: "Issues & places",
    home: "/issueview",
    rail: groupedViews(),
  },
};

export function issueViewHref(id: string): string {
  return id === "overview" ? "/issueview" : `/issueview/${id}`;
}

function groupedViews(): RailGroup[] {
  const groups = new Map<string, RailLink[]>();
  for (const view of TOOL_VIEWS.issueview) {
    groups.set(view.group, [...(groups.get(view.group) ?? []), { label: view.label, href: issueViewHref(view.id), exact: view.id === "overview" }]);
  }
  return [...groups.entries()].map(([label, links]) => ({ label, links }));
}

export const SUITE_ORDER: SuiteToolId[] = ["subpoena", "writ", "issueview"];
