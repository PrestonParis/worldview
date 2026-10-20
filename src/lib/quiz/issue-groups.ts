// Display categories for the issue-by-issue results, so a long list of
// answered issues reads as a profile rather than one undifferentiated grid.

import type { IssueId } from "./types";

export const ISSUE_GROUPS = [
  { id: "government", label: "Government & law" },
  { id: "economy", label: "Economy" },
  { id: "society", label: "Society" },
  { id: "foreign", label: "Foreign policy" },
  { id: "tech", label: "Technology & environment" },
] as const;

export type IssueGroupId = (typeof ISSUE_GROUPS)[number]["id"];

export const ISSUE_GROUP: Record<IssueId, IssueGroupId> = {
  regime: "government",
  judiciary: "government",
  "voting-rules": "government",
  speech: "government",
  policing: "government",
  "death-penalty": "government",
  violence: "government",
  "religion-law": "government",
  "economic-system": "economy",
  taxes: "economy",
  labor: "economy",
  entitlements: "economy",
  healthcare: "economy",
  housing: "economy",
  debt: "economy",
  tariffs: "economy",
  abortion: "society",
  guns: "society",
  immigration: "society",
  drugs: "society",
  lgbtq: "society",
  "affirmative-action": "society",
  race: "society",
  family: "society",
  education: "society",
  "religious-liberty": "society",
  israel: "foreign",
  ukraine: "foreign",
  china: "foreign",
  ai: "tech",
  climate: "tech",
};

export const issueGroup = (id: string): IssueGroupId => ISSUE_GROUP[id as IssueId] ?? "society";
