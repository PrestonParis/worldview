// The FBI offense categories /crime shows, shared by the loader and the
// client components (no database imports here).

export const OFFENSES = [
  { key: "violent_crime", label: "Violent crime", group: "violent" },
  { key: "homicide", label: "Murder", group: "violent" },
  { key: "rape", label: "Rape", group: "violent" },
  { key: "robbery", label: "Robbery", group: "violent" },
  { key: "aggravated_assault", label: "Aggravated assault", group: "violent" },
  { key: "property_crime", label: "Property crime", group: "property" },
  { key: "burglary", label: "Burglary", group: "property" },
  { key: "larceny", label: "Larceny-theft", group: "property" },
  { key: "motor_vehicle_theft", label: "Motor vehicle theft", group: "property" },
] as const;

export type OffenseKey = (typeof OFFENSES)[number]["key"];

export const offenseLabel = (key: string) => OFFENSES.find((o) => o.key === key)?.label ?? key;

// Offenses whose clearance share is shown per state.
export const CLEARED = ["violent_crime", "homicide", "property_crime"] as const;
export type ClearedKey = (typeof CLEARED)[number];

export interface YearValue {
  year: string;
  value: number;
}

export interface OffenseTrend {
  key: OffenseKey;
  label: string;
  group: "violent" | "property";
  rates: YearValue[]; // national annual rate per 100,000
  latest: number | null;
  change1y: number | null; // percent
  vsPre: number | null; // vs the pre-pandemic year
  vsBase: number | null; // vs the first year
  peak: YearValue | null; // over years with full reporting
  low: YearValue | null;
  cleared: YearValue[]; // percent of offenses cleared
}

export interface StateCrimeRow {
  abbr: string;
  name: string;
  rates: Record<OffenseKey, (number | null)[]>; // aligned with `years`
  coverage: (number | null)[]; // mean monthly population coverage, percent
  cleared: Record<ClearedKey, number | null>; // latest year, percent
}

export interface StateCrimeData {
  years: string[];
  rows: StateCrimeRow[];
  us: Record<OffenseKey, (number | null)[]>;
  usCleared: Record<ClearedKey, number | null>;
  extra?: { byState: Record<string, StateExtra>; us: StateExtra; cdcYear: string | null; hateYear: string | null };
}

// Below this mean monthly coverage a year is marked as partial reporting.
export const FULL_COVERAGE = 90;

// State-level figures from the non-FBI-offense sources, latest full year.
export interface StateExtra {
  homicideDeaths: number | null; // CDC homicide death rate per 100,000
  firearmHomicide: number | null; // CDC firearm homicide death rate
  hateIncidents: number | null; // FBI hate crime incidents (count)
}

export interface CityRow {
  ori: string;
  name: string;
  state: string;
  population: number | null;
  violent: number | null; // per 100,000, latest complete year
  murder: number | null;
  property: number | null;
  violentChange: number | null; // percent vs prior year
  staffing: number | null; // law enforcement employees per 1,000
  partial: boolean; // department missed months in the latest year
}

export interface CountyRow {
  fips: string;
  name: string;
  homicide: number | null; // CDC homicide death rate per 100,000
  firearmHomicide: number | null;
  deaths: number | null; // homicide deaths
  unreliable: boolean;
}

export interface StateDetail {
  cities: CityRow[];
  counties: CountyRow[];
  countyYear: string | null;
}
