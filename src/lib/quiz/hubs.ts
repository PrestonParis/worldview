// Where to go deeper on the rest of the site: the issue hubs that cover a quiz
// issue or dimension. Only clear matches; anything without a hub is left out
// rather than pointed somewhere loosely related.

import type { AxisId, IssueId } from "./types";

export interface Hub {
  href: string;
  label: string;
}

const HUB = {
  abortion: { href: "/abortion", label: "Abortion" },
  guns: { href: "/guns", label: "Guns" },
  immigration: { href: "/immigration", label: "Immigration" },
  health: { href: "/healthcare", label: "Healthcare" },
  education: { href: "/education", label: "Education" },
  housing: { href: "/housing", label: "Housing" },
  energy: { href: "/energy", label: "Energy & climate" },
  crime: { href: "/crime", label: "Crime & justice" },
  religion: { href: "/religion", label: "Religion" },
  economy: { href: "/economy", label: "Economy" },
  elections: { href: "/elections", label: "Elections" },
  family: { href: "/family", label: "Family" },
} satisfies Record<string, Hub>;

export const ISSUE_HUBS: Partial<Record<IssueId, Hub>> = {
  abortion: HUB.abortion,
  guns: HUB.guns,
  immigration: HUB.immigration,
  healthcare: HUB.health,
  education: HUB.education,
  housing: HUB.housing,
  climate: HUB.energy,
  policing: HUB.crime,
  "death-penalty": HUB.crime,
  drugs: HUB.crime,
  "religion-law": HUB.religion,
  "religious-liberty": HUB.religion,
  taxes: HUB.economy,
  labor: HUB.economy,
  entitlements: HUB.economy,
  debt: HUB.economy,
  tariffs: HUB.economy,
  "voting-rules": HUB.elections,
};

export const AXIS_HUBS: Partial<Record<AxisId, Hub>> = {
  ownership: HUB.economy,
  regulation: HUB.economy,
  redistribution: HUB.economy,
  trade: HUB.economy,
  immigration: HUB.immigration,
  justice: HUB.crime,
  religion: HUB.religion,
  social: HUB.family,
  environment: HUB.energy,
  voting: HUB.elections,
};
