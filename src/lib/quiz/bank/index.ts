import type { IssueModule, Statement } from "../types";
import { governanceStatements } from "./governance";
import { economyStatements } from "./economy";
import { foreignStatements } from "./foreign";
import { societyStatements } from "./society";
import { techStatements } from "./tech";
import { societyIssues } from "./issues-society";
import { policyIssues } from "./issues-policy";

// Bump when statement/option wording, locations, or weights change. Stored
// quizzes record the version they were taken against.
export const BANK_VERSION = "2.0.0";

export const statements: Statement[] = [
  ...governanceStatements,
  ...economyStatements,
  ...foreignStatements,
  ...societyStatements,
  ...techStatements,
];

export const issues: IssueModule[] = [...societyIssues, ...policyIssues];
