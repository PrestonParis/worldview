export const GREEN_CARD_VIEWS = ["trend", "pathways", "status", "countries", "citizenship"] as const;
export type GreenCardView = (typeof GREEN_CARD_VIEWS)[number];

export const IMMIGRATION_FOCUS_VIEWS = {
  border: ["trend", "states", "citizenship", "offices"],
  temporary: ["purpose", "trend", "work"],
  humanitarian: ["trend", "nationalities"],
  "green-cards": GREEN_CARD_VIEWS,
  naturalizations: ["trend", "countries", "share"],
  population: ["citizenship", "share", "countries", "regions"],
  "net-migration": ["trend", "growth"],
} as const;

export type ImmigrationFocus = keyof typeof IMMIGRATION_FOCUS_VIEWS;

export const IMMIGRATION_FOCI = Object.keys(IMMIGRATION_FOCUS_VIEWS) as ImmigrationFocus[];

export const isImmigrationFocus = (value: string | null): value is ImmigrationFocus =>
  IMMIGRATION_FOCI.includes(value as ImmigrationFocus);

export const focusHasView = (focus: ImmigrationFocus, view: string | null): view is string =>
  view !== null && (IMMIGRATION_FOCUS_VIEWS[focus] as readonly string[]).includes(view);

export const defaultFocusView = (focus: ImmigrationFocus): string => IMMIGRATION_FOCUS_VIEWS[focus][0];
