import type { IssueId, IssueModule, Statement } from "../types";
import { governanceStatements } from "./governance";
import { economyStatements } from "./economy";
import { foreignStatements } from "./foreign";
import { societyStatements } from "./society";
import { techStatements } from "./tech";
import { societyIssues } from "./issues-society";
import { policyIssues } from "./issues-policy";

// Bump when statement/option wording, locations, or weights change. Stored
// quizzes record the version they were taken against.
export const BANK_VERSION = "6.2.0";

// Statements removed from the bank. Answers to them stay in stored logs but no
// longer score; the wording is kept so those answers can still be displayed.
export const retiredStatements: Record<string, string> = {
  "religion.09": "Religion is a private matter, but people of faith should be free to bring their values into public debate.",
  "federalism.13": "A citizen's basic rights should not depend on which state they live in.",
  "technology.11": "Nuclear power should be a major part of America's energy supply.",
  // Christian-specific wording, replaced by tradition-neutral statements (bank 3.0.0).
  "religion.03": '"In God We Trust" should be removed from U.S. currency.',
  "religion.13": "Public schools should be allowed to display the Ten Commandments.",
  "religion.14": "Public school teachers should be allowed to lead students in prayer.",
  "religion.15": "America's laws should reflect Christian values.",
  "religion.17": "The United States should officially declare itself a Christian nation.",
  // Read disagreement as democratic, but people who want clerical, royal, or
  // party rule reject expert rule too (bank 5.1.0).
  // Judgment wording ("conspiracy theories") in the item itself (bank 5.1.0).
  "race.07": "Claims that Jewish people secretly control governments or finance are conspiracy theories.",
  // These measured antisemitism on the public Race & nationhood axis. Bank
  // 6.2.0 moved that distinction into internal-only tradition matching.
  "race.16": "Jewish elites act as a group to advance their own interests at the expense of other Americans.",
  "race.21": "Jewish Americans' prominence in some fields reflects individual achievement, not coordinated group power.",
  "democracy.12": "Some decisions are too important to leave to elected politicians and should rest with independent experts.",
};

export const statements: Statement[] = [...governanceStatements, ...economyStatements, ...foreignStatements, ...societyStatements, ...techStatements];

// The order issues are asked in, broadest first. Foundations frame the rest
// and come before any statement; then issues that touch most people's lives
// and several axes at once; then narrower institutional and foreign-policy
// questions.
export const issueOrder: IssueId[] = [
  // Foundations
  "regime",
  "economic-system",
  "religion-law",
  // Broad
  "healthcare",
  "taxes",
  "immigration",
  "race",
  "abortion",
  "climate",
  "guns",
  "lgbtq",
  "family",
  "policing",
  "violence",
  // Middle
  "labor",
  "entitlements",
  "education",
  "drugs",
  "death-penalty",
  "affirmative-action",
  "religious-liberty",
  "speech",
  "housing",
  "tariffs",
  // Narrow
  "voting-rules",
  "judiciary",
  "debt",
  "ai",
  "china",
  "ukraine",
  "israel",
];

export const issues: IssueModule[] = [...societyIssues, ...policyIssues].sort((a, b) => issueOrder.indexOf(a.id) - issueOrder.indexOf(b.id));
