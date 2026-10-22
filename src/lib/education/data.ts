// Everything /education shows: NAEP math and reading results, educational
// attainment (ACS), tuition prices and student debt (FRED), and the states —
// all from area_stats.

import { getSeriesByGeo, getSeriesMany, type Point } from "@/lib/db/stats";
import { STATES_51 } from "@/lib/geo/states";
import { datasetsFor, last, stateTable, toPoints } from "@/lib/issues/series";
import type { Series } from "@/components/charts/time-series-chart";

const NAEP = "naep";
const ACS = "census-acs1-social";
const FRED = "fred-education";
const ECON = "fred-economy";

const TESTS = ["math_4", "math_8", "reading_4", "reading_8"] as const;
const LABEL: Record<(typeof TESTS)[number], string> = { math_4: "Grade 4 math", math_8: "Grade 8 math", reading_4: "Grade 4 reading", reading_8: "Grade 8 reading" };
const BASE_YEAR = "2019"; // the last test before the pandemic

/** A monthly index rebased so its average in `year` is 100. */
function rebase(points: Point[], year: string): Point[] {
  const base = points.filter((p) => p.period.startsWith(year));
  if (!base.length) return [];
  const avg = base.reduce((t, p) => t + p.value, 0) / base.length;
  return points.filter((p) => p.period >= year).map((p) => ({ ...p, value: (p.value / avg) * 100 }));
}

export async function loadEducation() {
  const [naep, acs, fred, econ] = await Promise.all([
    getSeriesMany(NAEP, TESTS.flatMap((t) => [`${t}_score`, `${t}_proficient`])),
    getSeriesMany(ACS, ["hs_plus_share", "bachelors_plus_share"]),
    getSeriesMany(FRED, ["student_loans", "tuition_cpi"]),
    getSeriesMany(ECON, ["cpi"]),
  ]);
  if (!naep.math_8_score.length) return null;

  // ---- Test scores ----
  const scores = (subject: "math" | "reading"): Series[] => [
    { id: "4", label: "Grade 4", slot: 1, points: toPoints(naep[`${subject}_4_score`]) },
    { id: "8", label: "Grade 8", slot: 2, points: toPoints(naep[`${subject}_8_score`]) },
  ];
  const proficient: Series[] = TESTS.map((t, i) => ({ id: t, label: LABEL[t], slot: ((i % 3) + 1) as 1 | 2 | 3, ...(i === 3 ? { color: "var(--viz-muted)" } : {}), points: toPoints(naep[`${t}_proficient`]) }));

  // ---- Attainment ----
  const attainment: Series[] = [
    { id: "hs", label: "High school diploma or more", slot: 1, points: toPoints(acs.hs_plus_share) },
    { id: "ba", label: "Bachelor's degree or more", slot: 2, points: toPoints(acs.bachelors_plus_share) },
  ];

  // ---- College costs ----
  const tuition = rebase(fred.tuition_cpi, "1980");
  const prices = rebase(econ.cpi, "1980");
  const tuitionVsPrices: Series[] = [
    { id: "tuition", label: "Tuition, school fees, and child care", slot: 2, points: toPoints(tuition) },
    { id: "cpi", label: "All consumer prices", slot: 1, points: toPoints(prices) },
  ];
  const loans: Series[] = [{ id: "loans", label: "Student loans outstanding", slot: 1, points: toPoints(fred.student_loans) }];

  // ---- States ----
  const states = await stateTable([
    ...TESTS.map((t) => ({ source: NAEP, metric: `${t}_proficient`, label: `${LABEL[t]}, at or above Proficient`, unit: "percent", group: "Proficient", sourceLabel: "NAEP" })),
    ...TESTS.map((t) => ({ source: NAEP, metric: `${t}_score`, label: `${LABEL[t]}, average score`, unit: "points", group: "Average score", sourceLabel: "NAEP" })),
    { source: ACS, metric: "bachelors_plus_share", label: "Bachelor's degree or more", unit: "percent", group: "Adults 25+", sourceLabel: "American Community Survey" },
    { source: ACS, metric: "hs_plus_share", label: "High school diploma or more", unit: "percent", group: "Adults 25+", sourceLabel: "American Community Survey" },
  ]);
  // Change in grade 8 math since the last pre-pandemic test.
  const m8 = await getSeriesByGeo(NAEP, "math_8_score", "state");
  const m8Latest = last(naep.math_8_score)?.period ?? "";
  states.metrics.splice(8, 0, {
    key: "math_8_change", label: `Grade 8 math, change since ${BASE_YEAR}`, unit: "points", group: "Average score", source: "NAEP",
    period: `${BASE_YEAR}–${m8Latest}`, description: "Points on NAEP's 0–500 scale.",
  });
  for (const r of states.rows) {
    const pts = m8[STATES_51.find((s) => s.abbr === r.abbr)!.fips] ?? [];
    const a = pts.find((p) => p.period === BASE_YEAR);
    const b = pts.find((p) => p.period === m8Latest);
    r.values.math_8_change = a && b ? Math.round((b.value - a.value) * 10) / 10 : null;
  }

  // ---- Headline ----
  const headline = {
    math8: { point: last(naep.math_8_proficient), spark: naep.math_8_proficient.map((p) => p.value) },
    reading4: { point: last(naep.reading_4_proficient), spark: naep.reading_4_proficient.map((p) => p.value) },
    ba: { point: last(acs.bachelors_plus_share), spark: acs.bachelors_plus_share.map((p) => p.value) },
    loans: { point: last(fred.student_loans), spark: fred.student_loans.map((p) => p.value) },
  };

  return {
    headline,
    math: scores("math"),
    reading: scores("reading"),
    proficient,
    attainment,
    tuitionVsPrices,
    loans,
    states,
    datasets: await datasetsFor([NAEP, ACS, FRED, ECON]),
  };
}
