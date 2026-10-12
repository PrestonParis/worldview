import {
  SURVEY_YEARS,
  type DemographicDimensionId,
  type DemographicSeries,
  type GeoLevel,
} from "./forecast.ts";

// What a figure on /demographics is, for one dimension, geography and year.
// The same four words are used everywhere on the page:
//
//   reported   counted directly by the source (a decennial census)
//   estimated  a statistical estimate the source publishes for that place and year
//   modeled    calculated by Worldview for a past year (interpolated or scaled)
//   projected  a future value from a projection model

export type DataStatus = "reported" | "estimated" | "modeled" | "projected";

export const STATUS_LABEL: Record<DataStatus, string> = {
  reported: "Reported",
  estimated: "Estimated",
  modeled: "Modeled",
  projected: "Projected",
};

export const STATUS_MEANING: Record<DataStatus, string> = {
  reported: "Counted directly by the source for this place and year.",
  estimated: "A statistical estimate the source publishes for this place and year.",
  modeled: "Calculated by Worldview from published figures; no source publishes this value.",
  projected: "A future value from a projection model.",
};

export interface YearProvenance {
  status: DataStatus;
  // Who produced the number: "Census", "ACS", "Pew", "Gallup" or "Worldview".
  by: string;
  detail: string;
}

export interface Places {
  state?: string; // state name, when the geography is a state or a city in it
  city?: string;
}

const DECENNIAL_THROUGH = 1990;

function between(years: number[], year: number): [number, number] {
  const before = [...years].reverse().find((item) => item < year) ?? years[0];
  const after = years.find((item) => item > year) ?? years.at(-1)!;
  return [before, after];
}

const pewWave = (year: number) => (year === 2024 ? "2023–24" : String(year));

function past(id: DemographicDimensionId, level: GeoLevel, year: number, places: Places): YearProvenance {
  const state = places.state ?? "the state";
  if (level === "city") {
    return {
      status: "estimated",
      by: "ACS",
      detail: `Census Bureau American Community Survey 1-year estimate for ${places.city ?? "this city"}.`,
    };
  }

  if (id === "orientation") {
    if (level === "state") {
      return {
        status: "modeled",
        by: "Worldview",
        detail: `Gallup publishes no annual state figures. Worldview scales the national Gallup series by ${state}'s 2015–16 Gallup LGBT share relative to the U.S.`,
      };
    }
    const years = SURVEY_YEARS.orientation!;
    if (!years.includes(year)) {
      const [before, after] = between(years, year);
      return { status: "modeled", by: "Worldview", detail: `Interpolated between Gallup's ${before} and ${after} figures.` };
    }
    return {
      status: "estimated",
      by: "Gallup",
      detail:
        "Gallup survey of U.S. adults: share identifying as LGBTQ+. The split among gay or lesbian, bisexual and other uses Gallup's 2025 breakdown.",
    };
  }

  if (id === "religion") {
    const years = level === "state" ? [2014, 2024] : SURVEY_YEARS.religion!;
    const sample = level === "state" ? `${state} sample` : "national survey";
    if (!years.includes(year)) {
      const [before, after] = between(years, year);
      return {
        status: "modeled",
        by: "Worldview",
        detail: `Interpolated between Pew's ${pewWave(before)} and ${pewWave(after)} Religious Landscape Study ${level === "state" ? "samples" : "surveys"}.`,
      };
    }
    return {
      status: "estimated",
      by: "Pew",
      detail: `Pew Research Center Religious Landscape Study, ${pewWave(year)} ${sample} of adults.`,
    };
  }

  // Age, sex and race: Census population estimates.
  if (id === "sex" && level === "national" && year <= DECENNIAL_THROUGH) {
    if (year % 10 === 0) return { status: "reported", by: "Census", detail: `${year} decennial census count.` };
    const decade = Math.floor(year / 10) * 10;
    return { status: "modeled", by: "Worldview", detail: `Interpolated between the ${decade} and ${decade + 10} censuses.` };
  }
  if (id === "sex" && level === "national" && year < 2000) {
    return { status: "modeled", by: "Worldview", detail: "Interpolated between the 1990 census and the 2000 estimate." };
  }
  return {
    status: "estimated",
    by: "Census",
    detail: `Census Bureau ${level === "state" ? `population estimate for ${state}` : "national population estimate"}, July 1.`,
  };
}

function future(id: DemographicDimensionId, level: GeoLevel, places: Places): YearProvenance {
  const state = places.state ?? "the state";
  if (level === "city") {
    return {
      status: "projected",
      by: "Worldview",
      detail: `Worldview model: ${state}'s projected change applied to ${places.city ?? "the city"}'s 2024 ACS composition. No source publishes city projections.`,
    };
  }
  if (level === "state") {
    if (id === "orientation") {
      return {
        status: "projected",
        by: "Worldview",
        detail: `Worldview model: the national projection scaled by ${state}'s 2015–16 Gallup LGBT share relative to the U.S.`,
      };
    }
    const scenarios = id === "religion" ? "Pew's national religious-switching scenarios" : "the Census Bureau's national projection scenarios";
    const since = id === "religion" ? "2014–2024" : "2015–2025";
    return {
      status: "projected",
      by: "Worldview",
      detail: `Worldview model: ${scenarios} applied to ${state}, averaged with ${state}'s own ${since} trend. No source publishes state projections.`,
    };
  }
  if (id === "orientation") {
    return {
      status: "projected",
      by: "Worldview",
      detail: "Worldview model: Gallup's 2012–2025 rise in identification, extended with a slowing trend.",
    };
  }
  if (id === "religion") {
    return {
      status: "projected",
      by: "Pew",
      detail: "Pew Research Center's religious-switching scenarios (2022), re-based by Worldview to the 2023–24 survey.",
    };
  }
  return {
    status: "projected",
    by: "Census",
    detail: "Census Bureau 2023 National Projections, middle series, re-based by Worldview to the 2025 estimate.",
  };
}

export function yearProvenance(
  series: DemographicSeries,
  level: GeoLevel,
  year: number,
  places: Places = {},
): YearProvenance {
  return year > series.observedThrough ? future(series.id, level, places) : past(series.id, level, year, places);
}

// The past years a source published directly; the rest are interpolated or
// scaled. Null when every past year is published.
export function publishedYears(series: DemographicSeries, level: GeoLevel): number[] | null {
  if (level === "city") return null;
  if (series.id === "orientation") return level === "state" ? [] : SURVEY_YEARS.orientation!;
  if (series.id === "religion") return level === "state" ? [2014, 2024] : SURVEY_YEARS.religion!;
  return null;
}

// What the shaded range spans, for the "projection range" explanation.
export function rangeExplanation(series: DemographicSeries, level: GeoLevel, places: Places = {}): string {
  const state = places.state ?? "the state";
  if (level === "city") {
    return `${state}'s projected range carried over to ${places.city ?? "the city"}. City migration, housing and boundary changes are not modeled.`;
  }
  if (series.id === "orientation") {
    const base =
      "Low end: LGBTQ+ identification holds at its 2025 level. High end: the 2012–2025 rise continues without slowing. Both are Worldview assumptions, not published scenarios.";
    return level === "state" ? `${base} ${state}'s range is the national one, scaled.` : base;
  }
  const published =
    series.id === "religion"
      ? "Pew's four religious-switching scenarios (steady switching, rising disaffiliation with and without limits, no switching)"
      : "the Census Bureau's high-, low- and zero-immigration scenarios";
  if (level === "state") {
    return `The spread of ${published}, applied to ${state}, together with ${state}'s own recent trend.`;
  }
  return `The spread of ${published}.`;
}

export const GEO_LABEL: Record<GeoLevel, string> = {
  national: "U.S.",
  state: "States",
  city: "Cities (65,000+)",
};
