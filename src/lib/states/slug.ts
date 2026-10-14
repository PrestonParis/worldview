import { STATES_51 } from "@/lib/geo/states";

// URL slugs for state profiles: "New York" -> "new-york".
export type StateInfo = (typeof STATES_51)[number];
export const stateSlug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, "-");
export const stateBySlug = (slug: string): StateInfo | null => STATES_51.find((s) => stateSlug(s.name) === slug) ?? null;
