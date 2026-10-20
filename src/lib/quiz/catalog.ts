// Catalog sizes for page copy, so it never drifts from the bank.

import { axisIds } from "./types";
import { issues } from "./bank";
import { ideologies } from "./ideologies";

export const CATALOG = { axes: axisIds.length, issues: issues.length, traditions: ideologies.length };
