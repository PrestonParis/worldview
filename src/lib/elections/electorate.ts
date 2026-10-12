// Who votes: the demographic groups the electorate is broken down by, from
// the Census Bureau's CPS Voting and Registration Supplement. Shared by
// scripts/import-cps-voting.mjs (which writes one area_stats row per
// measure × dimension × group) and the elections page (which reads them back
// in this order with these labels).
//
// Dependency-free so the .mjs importer can import it directly.

export type Measure = "citizens" | "registered" | "voted";

export interface Group {
  key: string;
  label: string;
}

export interface Dimension {
  key: string;
  label: string;
  groups: Group[];
  /** Only voters are split this way (how they cast their ballot). */
  votersOnly?: boolean;
}

export const DIMENSIONS: Dimension[] = [
  {
    key: "age",
    label: "Age",
    groups: [
      { key: "18_24", label: "18–24" },
      { key: "25_34", label: "25–34" },
      { key: "35_44", label: "35–44" },
      { key: "45_54", label: "45–54" },
      { key: "55_64", label: "55–64" },
      { key: "65_74", label: "65–74" },
      { key: "75_plus", label: "75 and over" },
    ],
  },
  {
    key: "race",
    label: "Race & ethnicity",
    groups: [
      { key: "white", label: "White" },
      { key: "black", label: "Black" },
      { key: "hispanic", label: "Hispanic" },
      { key: "asian", label: "Asian" },
      { key: "other", label: "Other & multiracial" },
    ],
  },
  {
    key: "sex",
    label: "Sex",
    groups: [
      { key: "female", label: "Women" },
      { key: "male", label: "Men" },
    ],
  },
  {
    key: "education",
    label: "Education",
    groups: [
      { key: "no_diploma", label: "No high school diploma" },
      { key: "high_school", label: "High school graduate" },
      { key: "some_college", label: "Some college or associate" },
      { key: "bachelors", label: "Bachelor's degree" },
      { key: "advanced", label: "Advanced degree" },
    ],
  },
  {
    key: "income",
    label: "Family income",
    groups: [
      { key: "under_30k", label: "Under $30,000" },
      { key: "30k_50k", label: "$30,000–49,999" },
      { key: "50k_75k", label: "$50,000–74,999" },
      { key: "75k_100k", label: "$75,000–99,999" },
      { key: "100k_150k", label: "$100,000–149,999" },
      { key: "150k_plus", label: "$150,000 and over" },
      { key: "not_reported", label: "Not reported" },
    ],
  },
  {
    key: "method",
    label: "How they voted",
    votersOnly: true,
    groups: [
      { key: "election_day", label: "In person on Election Day" },
      { key: "early_in_person", label: "In person before Election Day" },
      { key: "mail", label: "By mail" },
      { key: "not_reported", label: "Not reported" },
    ],
  },
];

// area_stats metric names: "voted_total", "citizens_age_18_24", ...
export function metricName(measure: Measure, dimension?: string, group?: string): string {
  return dimension && group ? `${measure}_${dimension}_${group}` : `${measure}_total`;
}
