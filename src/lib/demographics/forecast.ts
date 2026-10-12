export type DemographicDimensionId = "age" | "sex" | "race" | "religion" | "orientation";

export type GeoLevel = "national" | "state" | "city";

export interface DemographicCategory {
  id: string;
  label: string;
  color: string;
}

export interface DemographicPoint {
  year: number;
  values: Record<string, number>;
  // Lowest / highest projection across scenarios. Present only from the last
  // observed year onward, where both equal `values` and then fan out.
  low?: Record<string, number>;
  high?: Record<string, number>;
}

export interface DemographicSource {
  label: string;
  href: string;
}

export interface DemographicSeries {
  id: DemographicDimensionId;
  label: string;
  description: string;
  population: string;
  // Census population estimates, or survey estimates of adults.
  measure: "census" | "survey";
  // Whom the shares are of: everyone, or adults 18 and over.
  universe: "residents" | "adults";
  // One sentence on what is measured, shown under the tabs.
  definition: string;
  // Finest-first list of the geographies the dimension is published for.
  geographies: GeoLevel[];
  observedThrough: number;
  categories: DemographicCategory[];
  points: DemographicPoint[];
  // How a sub-national series was derived (absent for the nation).
  basis?: string;
  // What the shaded projection range spans.
  rangeNote: string;
  // What each category counts, where the label alone is ambiguous.
  categoryNotes?: Record<string, string>;
  // The individual scenario paths behind the range, from the last observed
  // year on. State and city projections scale these.
  scenarios?: DemographicPoint[][];
  sources: DemographicSource[];
}

type Anchor = DemographicPoint;

const round = (value: number) => Math.round(value * 100) / 100;

const share = (part: number, total: number) => (part / total) * 100;

export function normalize(values: Record<string, number>): Record<string, number> {
  const entries = Object.entries(values);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const normalized = Object.fromEntries(
    entries.map(([key, value]) => [key, round((value / total) * 100)]),
  );
  const normalizedTotal = Object.values(normalized).reduce((sum, value) => sum + value, 0);
  const lastKey = entries.at(-1)?.[0];
  if (lastKey) normalized[lastKey] = round(normalized[lastKey] + (100 - normalizedTotal));
  return normalized;
}

export function interpolateAnchors(anchors: DemographicPoint[], startYear: number, endYear: number): DemographicPoint[] {
  return Array.from({ length: endYear - startYear + 1 }, (_, index) => {
    const year = startYear + index;
    const exact = anchors.find((anchor) => anchor.year === year);
    if (exact) return { year, values: normalize(exact.values) };

    const before = [...anchors].reverse().find((anchor) => anchor.year < year) ?? anchors[0];
    const after = anchors.find((anchor) => anchor.year > year) ?? anchors.at(-1)!;
    const span = Math.max(1, after.year - before.year);
    const progress = (year - before.year) / span;
    const values = Object.fromEntries(
      Object.keys(before.values).map((key) => [
        key,
        before.values[key] + ((after.values[key] ?? before.values[key]) - before.values[key]) * progress,
      ]),
    );
    return { year, values: normalize(values) };
  });
}

// Attach the projection range: for every year from `observedThrough` on, the
// lowest and highest value any scenario (or the central path itself) gives
// each category. Scenario paths must cover observedThrough..last year.
export function withRange(
  points: DemographicPoint[],
  observedThrough: number,
  scenarios: DemographicPoint[][],
): DemographicPoint[] {
  return points.map((point) => {
    if (point.year < observedThrough) return point;
    if (point.year === observedThrough) {
      return { ...point, low: { ...point.values }, high: { ...point.values } };
    }
    const matches = scenarios
      .map((path) => path.find((item) => item.year === point.year))
      .filter((item): item is DemographicPoint => Boolean(item));
    const low: Record<string, number> = {};
    const high: Record<string, number> = {};
    for (const [key, value] of Object.entries(point.values)) {
      const candidates = [value, ...matches.map((item) => item.values[key] ?? value)];
      low[key] = round(Math.max(0, Math.min(...candidates)));
      high[key] = round(Math.min(100, Math.max(...candidates)));
    }
    return { ...point, low, high };
  });
}

// Re-base a published projection onto the latest observed composition: keep
// the projection's change since `baseYear`, start from the observed values.
function rebase(
  observed: Record<string, number>,
  projection: Anchor[],
  baseYear: number,
): Anchor[] {
  const base = projection.find((point) => point.year === baseYear)!;
  return projection
    .filter((point) => point.year >= baseYear)
    .map((point) => ({
      year: point.year,
      values: normalize(Object.fromEntries(
        Object.keys(observed).map((key) => [
          key,
          Math.max(0, observed[key] + (point.values[key] ?? 0) - (base.values[key] ?? 0)),
        ]),
      )),
    }));
}

const scenarioYears = [2025, 2030, 2035, 2040, 2045, 2050];

// Census 2023 National Projections alternative immigration scenarios
// (np2023_d1_hi / _low / _zero), share of total population. Age groups sum
// the single-year-of-age columns.
const censusScenarioRows: Record<"high" | "low" | "zero", Record<string, number[]>> = {
  high: {
    male: [49.57, 49.52, 49.46, 49.42, 49.39, 49.39],
    female: [50.43, 50.48, 50.54, 50.58, 50.61, 50.61],
    nhWhite: [57.58, 55.39, 53.17, 50.94, 48.74, 46.62],
    nhBlack: [12.64, 12.68, 12.74, 12.82, 12.93, 13.06],
    nhAian: [0.72, 0.7, 0.68, 0.67, 0.65, 0.63],
    nhAsian: [6.5, 7.15, 7.77, 8.38, 8.98, 9.56],
    nhNhpi: [0.2, 0.21, 0.22, 0.23, 0.25, 0.26],
    nhMultiracial: [2.54, 2.8, 3.08, 3.37, 3.67, 3.98],
    hispanic: [19.84, 21.07, 22.34, 23.59, 24.78, 25.89],
    under18: [20.99, 20.1, 19.57, 19.44, 19.29, 18.99],
    age18to24: [9.29, 8.94, 8.48, 8.03, 7.83, 7.93],
    age25to44: [27.02, 27.24, 27.26, 26.91, 26.41, 25.66],
    age45to64: [24.04, 23.33, 23.5, 24.17, 24.93, 25.53],
    age65plus: [18.65, 20.39, 21.19, 21.45, 21.54, 21.9],
  },
  low: {
    male: [49.57, 49.51, 49.46, 49.42, 49.41, 49.43],
    female: [50.43, 50.49, 50.54, 50.58, 50.59, 50.57],
    nhWhite: [58, 56.47, 54.86, 53.18, 51.47, 49.77],
    nhBlack: [12.66, 12.74, 12.83, 12.92, 13.03, 13.14],
    nhAian: [0.72, 0.72, 0.71, 0.71, 0.7, 0.7],
    nhAsian: [6.22, 6.48, 6.73, 6.98, 7.24, 7.51],
    nhNhpi: [0.2, 0.2, 0.21, 0.22, 0.22, 0.23],
    nhMultiracial: [2.55, 2.82, 3.12, 3.44, 3.78, 4.14],
    hispanic: [19.64, 20.56, 21.54, 22.55, 23.55, 24.52],
    under18: [20.98, 19.97, 19.2, 18.8, 18.44, 18.03],
    age18to24: [9.23, 8.87, 8.44, 8.01, 7.75, 7.71],
    age25to44: [26.85, 26.78, 26.59, 26.16, 25.7, 25],
    age45to64: [24.15, 23.59, 23.86, 24.57, 25.31, 25.84],
    age65plus: [18.79, 20.8, 21.91, 22.45, 22.81, 23.42],
  },
  zero: {
    male: [49.56, 49.51, 49.46, 49.43, 49.43, 49.46],
    female: [50.44, 50.49, 50.54, 50.57, 50.57, 50.54],
    nhWhite: [58.35, 57.39, 56.34, 55.21, 54.03, 52.86],
    nhBlack: [12.69, 12.8, 12.91, 13.02, 13.12, 13.22],
    nhAian: [0.73, 0.73, 0.74, 0.75, 0.75, 0.76],
    nhAsian: [6, 5.91, 5.82, 5.72, 5.61, 5.51],
    nhNhpi: [0.19, 0.2, 0.2, 0.2, 0.2, 0.21],
    nhMultiracial: [2.56, 2.84, 3.16, 3.5, 3.88, 4.28],
    hispanic: [19.48, 20.13, 20.84, 21.6, 22.4, 23.17],
    under18: [20.98, 19.86, 18.88, 18.23, 17.64, 17.08],
    age18to24: [9.17, 8.81, 8.41, 8, 7.68, 7.5],
    age25to44: [26.71, 26.39, 26.01, 25.48, 25.03, 24.36],
    age45to64: [24.24, 23.8, 24.16, 24.93, 25.65, 26.14],
    age65plus: [18.9, 21.14, 22.53, 23.37, 24, 24.92],
  },
};

function censusScenarioPaths(observed: Record<string, number>): DemographicPoint[][] {
  return Object.values(censusScenarioRows).map((rows) => {
    const anchors = scenarioYears.map((year, index) => ({
      year,
      values: Object.fromEntries(Object.keys(observed).map((key) => [key, rows[key][index]])),
    }));
    return interpolateAnchors(rebase(observed, anchors, 2025), 2025, 2050);
  });
}

const censusProjectionYears = [2022, 2025, 2030, 2035, 2040, 2045, 2050];

const sexTotals = {
  total: [333288, 338016, 345074, 350861, 355309, 358438, 360639],
  male: [165283, 167544, 170857, 173533, 175598, 177091, 178197],
  female: [168004, 170473, 174216, 177328, 179711, 181347, 182442],
};

const sexProjectionAnchors: Anchor[] = censusProjectionYears.map((year, index) => ({
  year,
  values: {
    male: (sexTotals.male[index] / sexTotals.total[index]) * 100,
    female: (sexTotals.female[index] / sexTotals.total[index]) * 100,
  },
}));

const historicalSexCounts: Array<[number, number, number]> = [
  [1820, 4896605, 4741848],
  [1830, 6532489, 6333531],
  [1840, 8688532, 8380921],
  [1850, 11837660, 11354216],
  [1860, 16085204, 15358117],
  [1870, 19493565, 19064806],
  [1880, 25518820, 24636963],
  [1890, 32237101, 30710613],
  [1900, 38816448, 37178127],
  [1910, 47332277, 44639989],
  [1920, 53900431, 51810189],
  [1930, 62137080, 60637966],
  [1940, 66061592, 65607683],
];

const historicalSexRatios: Array<[number, number]> = [
  [1950, 98.6],
  [1960, 97.1],
  [1970, 94.8],
  [1980, 94.5],
  [1990, 95.1],
];

const modernYears = Array.from({ length: 26 }, (_, index) => 2000 + index);
const modernPopulation = [
  282162411, 284968955, 287625193, 290107933, 292805298, 295516599, 298379912,
  301231207, 304093966, 306771529, 309378227, 311839461, 314339099, 316726282,
  319257560, 321815121, 324353340, 326608609, 328529577, 330226227, 331578104,
  332100166, 333996304, 336755052, 340003797, 341784857,
];
const modernSexCounts = {
  male: [
    138443407, 139891492, 141230559, 142428897, 143828012, 145197078, 146647265,
    148064854, 149489951, 150807454, 152089200, 153271722, 154502917, 155666964,
    156895739, 158153791, 159379789, 160454561, 161348648, 162127491, 162780726,
    162980790, 163868084, 165233378, 166868649, 167737525,
  ],
  female: [
    143719004, 145077463, 146394634, 147679036, 148977286, 150319521, 151732647,
    153166353, 154604015, 155964075, 157289027, 158567739, 159836182, 161059318,
    162361821, 163661330, 164973551, 166154048, 167180929, 168098736, 168797378,
    169119376, 170128220, 171521674, 173135148, 174047332,
  ],
};

const sexHistoricalAnchors: Anchor[] = [
  ...historicalSexCounts.map(([year, male, female]) => ({
    year,
    values: { male: share(male, male + female), female: share(female, male + female) },
  })),
  ...historicalSexRatios.map(([year, ratio]) => ({
    year,
    values: { male: ratio / (1 + ratio / 100), female: 100 / (1 + ratio / 100) },
  })),
];

const sexActualAnchors: Anchor[] = modernYears.map((year, index) => ({
  year,
  values: {
    male: share(modernSexCounts.male[index], modernPopulation[index]),
    female: share(modernSexCounts.female[index], modernPopulation[index]),
  },
}));

const sexProjectionBase = sexProjectionAnchors.find((point) => point.year === 2025)!;
const sexActualBase = sexActualAnchors.at(-1)!;
const sexAnchors: Anchor[] = [
  ...sexHistoricalAnchors,
  ...sexActualAnchors,
  ...sexProjectionAnchors
    .filter((point) => point.year > 2025)
    .map((point) => ({
      year: point.year,
      values: normalize(Object.fromEntries(
        Object.keys(point.values).map((key) => [
          key,
          sexActualBase.values[key] + point.values[key] - sexProjectionBase.values[key],
        ]),
      )),
    })),
];

const raceProjectionRows = {
  nhWhite: [58.88, 57.83, 56.03, 54.17, 52.25, 50.32, 48.43],
  nhBlack: [12.62, 12.65, 12.72, 12.79, 12.88, 12.98, 13.11],
  nhAian: [0.73, 0.72, 0.71, 0.7, 0.69, 0.68, 0.67],
  nhAsian: [6.08, 6.33, 6.75, 7.16, 7.57, 7.97, 8.38],
  nhNhpi: [0.19, 0.2, 0.21, 0.22, 0.22, 0.23, 0.24],
  nhMultiracial: [2.4, 2.55, 2.81, 3.1, 3.41, 3.74, 4.07],
  hispanic: [19.1, 19.72, 20.77, 21.87, 22.98, 24.07, 25.1],
};

const raceProjectionAnchors: Anchor[] = censusProjectionYears.map((year, index) => ({
  year,
  values: Object.fromEntries(
    Object.entries(raceProjectionRows).map(([key, values]) => [key, values[index]]),
  ),
}));

const modernRaceCounts = {
  nhWhite: [
    195701752, 195974813, 196140540, 196232760, 196461761, 196620983, 196832697,
    197011394, 197183535, 197274549, 197345271, 197267542, 197242823, 197115571,
    197046032, 196903710, 196739408, 196419849, 195977452, 195497130, 194812290,
    193988515, 193278374, 192798749, 192348445, 191766696,
  ],
  nhBlack: [
    34405800, 34780280, 35130061, 35438251, 35797599, 36147348, 36520961, 36905758,
    37290709, 37656592, 37995012, 38286019, 38586891, 38872252, 39167911, 39465913,
    39755005, 40019864, 40251518, 40466469, 40636282, 40750040, 40999412, 41318813,
    41652991, 41905537,
  ],
  nhAian: [
    2101969, 2119929, 2136918, 2152127, 2169359, 2186123, 2203091, 2220301, 2237304,
    2252408, 2264939, 2270353, 2276599, 2281888, 2286822, 2290185, 2292625, 2292952,
    2290668, 2288287, 2291688, 2303368, 2315058, 2328551, 2341978, 2354987,
  ],
  nhAsian: [
    10468759, 10925853, 11372498, 11801041, 12219990, 12657844, 13097737, 13526680,
    13955911, 14361474, 14778664, 15299657, 15835447, 16382802, 16969228, 17581439,
    18175874, 18725793, 19158629, 19557483, 19894304, 20119460, 20716790, 21432240,
    22219127, 22716301,
  ],
  nhNhpi: [
    370224, 383282, 396089, 408032, 421181, 434180, 447629, 460973, 474526, 487588,
    500695, 514920, 529167, 544002, 557604, 572064, 587310, 602450, 616487, 629777,
    642191, 650571, 662900, 676451, 689258, 701287,
  ],
  nhMultiracial: [
    3452022, 3640702, 3831467, 4026293, 4234033, 4446507, 4671492, 4909248, 5158196,
    5411429, 5733882, 6258354, 6786489, 7316163, 7850253, 8388180, 8927563, 9460466,
    9987245, 10509512, 10983648, 11201587, 11444764, 11698010, 11955179, 12194923,
  ],
  hispanic: [
    35661885, 37144096, 38617620, 40049429, 41501375, 43023614, 44606305, 46196853,
    47793785, 49327489, 50759764, 51942616, 53081683, 54213604, 55379710, 56613630,
    57875555, 59087235, 60247578, 61277569, 62317701, 63086625, 64579006, 66502238,
    68796819, 70145126,
  ],
};

const raceActualAnchors: Anchor[] = modernYears.map((year, index) => ({
  year,
  values: Object.fromEntries(
    Object.entries(modernRaceCounts).map(([key, values]) => [
      key,
      share(values[index], modernPopulation[index]),
    ]),
  ),
}));

const raceProjectionBase = raceProjectionAnchors.find((point) => point.year === 2025)!;
const raceActualBase = raceActualAnchors.at(-1)!;
const raceAnchors: Anchor[] = [
  ...raceActualAnchors,
  ...raceProjectionAnchors
    .filter((point) => point.year > 2025)
    .map((point) => ({
      year: point.year,
      values: normalize(Object.fromEntries(
        Object.keys(point.values).map((key) => [
          key,
          raceActualBase.values[key] + point.values[key] - raceProjectionBase.values[key],
        ]),
      )),
    })),
];

// Census population estimates by age (Vintage 2020 for 2010–2019, Vintage
// 2025 for 2020–2025), summed across the 50 states and D.C., in thousands:
// under 18, 18–24, 25–44, 45–64, 65+.
const AGE_KEYS = ["under18", "age18to24", "age25to44", "age45to64", "age65plus"] as const;
const ageCounts: Record<number, number[]> = {
  2010: [74123, 30764, 82193, 81769, 40478],
  2011: [73917, 31087, 82435, 82795, 41351],
  2012: [73713, 31385, 82816, 82832, 43132],
  2013: [73592, 31506, 83301, 83029, 44632],
  2014: [73593, 31438, 83879, 83315, 46161],
  2015: [73654, 31156, 84514, 83759, 47656],
  2016: [73699, 30830, 85239, 84095, 49208],
  2017: [73632, 30544, 86088, 84101, 50758],
  2018: [73386, 30396, 86911, 83791, 52355],
  2019: [73089, 30235, 87678, 83292, 54037],
  2020: [73660, 31242, 86887, 83841, 55948],
  2021: [73021, 31298, 87287, 83046, 57448],
  2022: [72785, 31607, 88143, 82354, 59107],
  2023: [72653, 31879, 89388, 81880, 60955],
  2024: [72549, 32095, 90945, 81602, 62813],
  2025: [72021, 31937, 91885, 81325, 64617],
};

const ageActualAnchors: Anchor[] = Object.entries(ageCounts).map(([year, counts]) => {
  const total = counts.reduce((sum, value) => sum + value, 0);
  return {
    year: Number(year),
    values: Object.fromEntries(AGE_KEYS.map((key, index) => [key, share(counts[index], total)])),
  };
});

// Census 2023 National Projections, middle series (np2023_d1_mid).
const ageProjectionRows = {
  under18: [21.74, 20.99, 20.02, 19.35, 19.07, 18.79, 18.44],
  age18to24: [9.4, 9.25, 8.9, 8.46, 8.02, 7.78, 7.8],
  age25to44: [26.76, 26.92, 26.97, 26.87, 26.48, 26, 25.28],
  age45to64: [24.76, 24.11, 23.48, 23.71, 24.4, 25.15, 25.71],
  age65plus: [17.34, 18.73, 20.63, 21.61, 22.04, 22.27, 22.77],
};

const ageProjectionAnchors: Anchor[] = censusProjectionYears.map((year, index) => ({
  year,
  values: Object.fromEntries(
    Object.entries(ageProjectionRows).map(([key, values]) => [key, values[index]]),
  ),
}));

const ageActualBase = ageActualAnchors.at(-1)!;
const ageProjectionBase = ageProjectionAnchors.find((point) => point.year === 2025)!;
const ageAnchors: Anchor[] = [
  ...ageActualAnchors,
  ...ageProjectionAnchors
    .filter((point) => point.year > 2025)
    .map((point) => ({
      year: point.year,
      values: normalize(Object.fromEntries(
        Object.keys(point.values).map((key) => [
          key,
          ageActualBase.values[key] + point.values[key] - ageProjectionBase.values[key],
        ]),
      )),
    })),
];

// Census 2023 National Projections, middle series: total and 18+
// population, 2026–2050, in thousands.
const projectedResidents = [
  339513, 340970, 342385, 343754, 345074, 346339, 347545, 348702, 349808, 350861, 351861, 352806, 353696,
  354530, 355309, 356034, 356705, 357327, 357903, 358438, 358936, 359400, 359836, 360247, 360639,
];
const projectedAdults = [
  269163, 271046, 272804, 274438, 275986, 277482, 278942, 280376, 281738, 282962, 284072, 285060, 285965,
  286733, 287563, 288319, 289044, 289742, 290417, 291071, 291710, 292333, 292946, 293550, 294149,
];

// U.S. residents or adults in a year: Census estimates through 2025, the
// Census middle-series projection after. Null where neither exists.
export function nationalPopulation(universe: "residents" | "adults", year: number): number | null {
  if (year > 2025 && year <= 2050) {
    return (universe === "residents" ? projectedResidents : projectedAdults)[year - 2026] * 1000;
  }
  if (universe === "residents") return modernPopulation[year - 2000] ?? null;
  const counts = ageCounts[year];
  return counts ? counts.slice(1).reduce((sum, value) => sum + value, 0) * 1000 : null;
}

const orientationTotals = [
  [2012, 3.5],
  [2013, 3.6],
  [2014, 3.7],
  [2015, 3.9],
  [2016, 4.1],
  [2017, 4.5],
  [2020, 5.6],
  [2021, 7.1],
  [2022, 7.2],
  [2023, 7.6],
  [2024, 9.3],
  [2025, 9.0],
] as const;

// Years the surveys behind each national series actually fielded; the years
// between are interpolated.
export const SURVEY_YEARS: Partial<Record<DemographicDimensionId, number[]>> = {
  orientation: orientationTotals.map(([year]) => year),
  religion: [2007, 2014, 2024],
};

function regressionSlope(points: readonly (readonly [number, number])[]): number {
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  const numerator = points.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0);
  const denominator = points.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0);
  return numerator / denominator;
}

const orientationMix = {
  gayLesbian: 2.8 / 9.5,
  bisexual: 4.6 / 9.5,
  other: 2.1 / 9.5,
};

function orientationValues(total: number, notReported: number): Record<string, number> {
  return normalize({
    straight: 100 - total - notReported,
    gayLesbian: total * orientationMix.gayLesbian,
    bisexual: total * orientationMix.bisexual,
    other: total * orientationMix.other,
    notReported,
  });
}

const orientationObservedAnchors: Anchor[] = orientationTotals.map(([year, total]) => {
  const notReported = year <= 2022
    ? 7.5 + ((7 - 7.5) * (year - 2012)) / 10
    : year === 2023
      ? 6.8
      : year === 2024
        ? 5.4
        : 5;
  return { year, values: orientationValues(total, notReported) };
});

const orientationObserved = interpolateAnchors(orientationObservedAnchors, 2012, 2025);
const orientationSlope = regressionSlope(orientationTotals);
const projectedNotReported = (year: number) => 5 + ((3 - 5) * (year - 2025)) / 25;
let projectedOrientationTotal = 9;
const orientationProjected: DemographicPoint[] = [];
for (let year = 2026; year <= 2050; year += 1) {
  projectedOrientationTotal += orientationSlope * 0.94 ** (year - 2026);
  orientationProjected.push({
    year,
    values: orientationValues(projectedOrientationTotal, projectedNotReported(year)),
  });
}

const orientationScenarioYears = Array.from({ length: 26 }, (_, index) => 2025 + index);
const orientationScenarios: DemographicPoint[][] = [
  // Identification holds at its 2025 level.
  orientationScenarioYears.map((year) => ({
    year,
    values: orientationValues(9, projectedNotReported(year)),
  })),
  // The 2012–2025 trend continues without slowing.
  orientationScenarioYears.map((year) => ({
    year,
    values: orientationValues(9 + orientationSlope * (year - 2025), projectedNotReported(year)),
  })),
];

const religionAnchors: Anchor[] = [
  {
    year: 2007,
    values: { christian: 77.4, multiChristian: 1, unaffiliated: 16.1, otherReligions: 4.7, notReported: 0.8 },
  },
  {
    year: 2014,
    values: { christian: 69.6, multiChristian: 1, unaffiliated: 22.8, otherReligions: 5.9, notReported: 0.7 },
  },
  {
    year: 2024,
    values: { christian: 61, multiChristian: 1, unaffiliated: 29, otherReligions: 7.1, notReported: 1.9 },
  },
  {
    year: 2050,
    values: { christian: 46, multiChristian: 1, unaffiliated: 42, otherReligions: 10, notReported: 1 },
  },
];

// Pew's four religious-switching scenarios (Sept. 2022): Christian and
// unaffiliated shares at each year the report states, from the 2020 base.
// "Other religions" takes the remainder.
const pewScenarioAnchors: Array<Array<[number, number, number]>> = [
  // Steady switching
  [[2020, 64, 30], [2070, 46, 41]],
  // Rising disaffiliation with limits
  [[2020, 64, 30], [2050, 47, 42], [2070, 39, 48]],
  // Rising disaffiliation without limits
  [[2020, 64, 30], [2055, 43, 46], [2070, 35, 52]],
  // No switching
  [[2020, 64, 30], [2070, 54, 34]],
];

function religionScenarioPaths(observed: Record<string, number>): DemographicPoint[][] {
  return pewScenarioAnchors.map((published) => {
    const anchors: Anchor[] = interpolateAnchors(
      published.map(([year, christian, unaffiliated]) => ({
        year,
        values: { christian, unaffiliated, other: 100 - christian - unaffiliated },
      })),
      2020,
      2070,
    ).filter((point) => point.year >= 2024 && point.year <= 2050);
    const base = anchors[0].values;
    return anchors.map((point) => ({
      year: point.year,
      values: normalize({
        ...observed,
        christian: Math.max(0, observed.christian + point.values.christian - base.christian),
        unaffiliated: Math.max(0, observed.unaffiliated + point.values.unaffiliated - base.unaffiliated),
        otherReligions: Math.max(0, observed.otherReligions + point.values.other - base.other),
      }),
    }));
  });
}

const agePoints = interpolateAnchors(ageAnchors, 2010, 2050);
const sexPoints = interpolateAnchors(sexAnchors, 1820, 2050);
const racePoints = interpolateAnchors(raceAnchors, 2000, 2050);
const religionPoints = interpolateAnchors(religionAnchors, 2007, 2050);
const religionScenarios = religionScenarioPaths(
  religionPoints.find((point) => point.year === 2024)!.values,
);
const ageScenarios = censusScenarioPaths(ageActualBase.values);
const sexScenarios = censusScenarioPaths(sexActualBase.values);
const raceScenarios = censusScenarioPaths(raceActualBase.values);

export const demographicSeries: DemographicSeries[] = [
  {
    id: "age",
    label: "Age",
    description: "Age groups, by age at last birthday",
    population: "U.S. resident population",
    measure: "census",
    universe: "residents",
    definition: "Census estimates of the resident population by age, as of July 1 each year.",
    geographies: ["national", "state", "city"],
    observedThrough: 2025,
    categories: [
      { id: "under18", label: "Under 18", color: "#0ea5e9" },
      { id: "age18to24", label: "18–24", color: "#6366f1" },
      { id: "age25to44", label: "25–44", color: "#a855f7" },
      { id: "age45to64", label: "45–64", color: "#ec4899" },
      { id: "age65plus", label: "65 and older", color: "#f97316" },
    ],
    points: withRange(agePoints, 2025, ageScenarios),
    scenarios: ageScenarios,
    rangeNote: "Census high-, low- and zero-immigration scenarios",
    sources: [
      {
        label: "U.S. Census Bureau — State population by characteristics, 2010–2020",
        href: "https://www.census.gov/programs-surveys/popest/technical-documentation/research/evaluation-estimates/2020-evaluation-estimates/2010s-state-detail.html",
      },
      {
        label: "U.S. Census Bureau — State population by characteristics, 2020–2025",
        href: "https://www.census.gov/data/tables/time-series/demo/popest/2020s-state-detail.html",
      },
      {
        label: "U.S. Census Bureau — 2023 National Population Projections",
        href: "https://www.census.gov/data/datasets/2023/demo/popproj/2023-popproj.html",
      },
    ],
  },
  {
    id: "sex",
    label: "Sex",
    description: "Share of the total resident population",
    population: "U.S. resident population",
    measure: "census",
    universe: "residents",
    definition:
      "Sex as recorded in Census population estimates, which classify every resident as male or female. Gender identity is not measured.",
    geographies: ["national", "state", "city"],
    observedThrough: 2025,
    categories: [
      { id: "male", label: "Male", color: "#2563eb" },
      { id: "female", label: "Female", color: "#ec4899" },
    ],
    points: withRange(sexPoints, 2025, sexScenarios),
    scenarios: sexScenarios,
    rangeNote: "Census high-, low- and zero-immigration scenarios",
    sources: [
      {
        label: "U.S. Census Bureau — historical sex composition, 1820–1900",
        href: "https://www2.census.gov/library/publications/decennial/1900/bulletins/demographic/14-proportion-of-sexes-in-us.pdf",
      },
      {
        label: "U.S. Census Bureau — decennial sex ratios, 1900–1990",
        href: "https://www2.census.gov/library/publications/decennial/1990/cqc/cqc-03.pdf",
      },
      {
        label: "U.S. Census Bureau — 2000–2010 intercensal estimates",
        href: "https://www.census.gov/data/tables/time-series/demo/popest/intercensal-2000-2010-national.html",
      },
      {
        label: "U.S. Census Bureau — 2010–2020 intercensal estimates",
        href: "https://www.census.gov/data/tables/time-series/demo/popest/intercensal-2010-2020-national-detail.html",
      },
      {
        label: "U.S. Census Bureau — Vintage 2025 national estimates",
        href: "https://www.census.gov/data/tables/time-series/demo/popest/2020s-national-detail.html",
      },
      {
        label: "U.S. Census Bureau — 2023 National Population Projections",
        href: "https://www.census.gov/data/tables/2023/demo/popproj/2023-summary-tables.html",
      },
    ],
  },
  {
    id: "race",
    label: "Race & ethnicity",
    description: "Mutually exclusive race and ethnicity categories",
    population: "U.S. resident population",
    measure: "census",
    universe: "residents",
    definition:
      "Census estimates of the resident population in mutually exclusive race and ethnicity groups.",
    geographies: ["national", "state", "city"],
    observedThrough: 2025,
    categories: [
      { id: "nhWhite", label: "White, non-Hispanic", color: "#94a3b8" },
      { id: "hispanic", label: "Hispanic or Latino", color: "#f97316" },
      { id: "nhBlack", label: "Black, non-Hispanic", color: "#8b5cf6" },
      { id: "nhAsian", label: "Asian, non-Hispanic", color: "#06b6d4" },
      { id: "nhMultiracial", label: "Two or more races, non-Hispanic", color: "#f43f5e" },
      { id: "nhAian", label: "American Indian / Alaska Native, non-Hispanic", color: "#f59e0b" },
      { id: "nhNhpi", label: "Native Hawaiian / Pacific Islander, non-Hispanic", color: "#10b981" },
    ],
    points: withRange(racePoints, 2025, raceScenarios),
    scenarios: raceScenarios,
    rangeNote: "Census high-, low- and zero-immigration scenarios",
    categoryNotes: {
      hispanic:
        "The Census treats Hispanic or Latino origin as an ethnicity, not a race. Anyone of Hispanic origin is counted here, whatever their race; every other group is non-Hispanic.",
      nhWhite: "Non-Hispanic people who report White as their only race.",
      nhMultiracial: "Non-Hispanic people who report two or more races.",
    },
    sources: [
      {
        label: "U.S. Census Bureau — 2000–2010 intercensal estimates",
        href: "https://www.census.gov/data/tables/time-series/demo/popest/intercensal-2000-2010-national.html",
      },
      {
        label: "U.S. Census Bureau — 2010–2020 intercensal estimates",
        href: "https://www.census.gov/data/tables/time-series/demo/popest/intercensal-2010-2020-national-detail.html",
      },
      {
        label: "U.S. Census Bureau — Vintage 2025 national estimates",
        href: "https://www.census.gov/data/tables/time-series/demo/popest/2020s-national-detail.html",
      },
      {
        label: "U.S. Census Bureau — 2023 National Population Projections, Table 5",
        href: "https://www.census.gov/data/tables/2023/demo/popproj/2023-summary-tables.html",
      },
    ],
  },
  {
    id: "religion",
    label: "Religion",
    description: "Adult religious affiliation",
    population: "U.S. adults",
    measure: "survey",
    universe: "adults",
    definition:
      "Survey estimates of the religious identity of U.S. adults (18+). The Census does not ask about religion.",
    geographies: ["national", "state"],
    observedThrough: 2024,
    categories: [
      { id: "christian", label: "Christian", color: "#2563eb" },
      { id: "unaffiliated", label: "Religiously unaffiliated", color: "#f97316" },
      { id: "otherReligions", label: "Other religions", color: "#10b981" },
      { id: "multiChristian", label: "Multiple / other Christian", color: "#8b5cf6" },
      { id: "notReported", label: "Not reported", color: "#cbd5e1" },
    ],
    points: withRange(religionPoints, 2024, religionScenarios),
    scenarios: religionScenarios,
    rangeNote: "Pew religious-switching scenarios",
    categoryNotes: {
      christian:
        "Protestants (evangelical, mainline and historically Black), Catholics, Orthodox Christians, Latter-day Saints and Jehovah's Witnesses, as Pew classifies them.",
      unaffiliated: "Atheists, agnostics and people who say their religion is “nothing in particular.”",
      otherReligions: "Jewish, Muslim, Buddhist, Hindu and all other non-Christian faiths, combined.",
      multiChristian: "Pew's small “other Christian” group outside the traditions above. National series only.",
      notReported: "Respondents who declined to answer or said they didn't know.",
    },
    sources: [
      {
        label: "Pew Research Center — 2007, 2014 and 2023–24 Religious Landscape Studies",
        href: "https://www.pewresearch.org/religion/2025/02/26/religious-landscape-study-religious-identity/",
      },
      {
        label: "Pew Research Center — U.S. religious projections",
        href: "https://www.pewresearch.org/religion/2022/09/13/modeling-the-future-of-religion-in-america/",
      },
      {
        label: "PRRI — Census of American Religion",
        href: "https://prri.org/wp-content/uploads/2026/04/PRRI-Apr-2026-Census-of-American-Religion-final.pdf",
      },
    ],
  },
  {
    id: "orientation",
    label: "Sexual orientation",
    description: "Adult self-identification",
    population: "U.S. adults",
    measure: "survey",
    universe: "adults",
    definition:
      "Survey estimates of how U.S. adults (18+) describe their sexual orientation. The Census does not count sexual orientation.",
    geographies: ["national", "state"],
    observedThrough: 2025,
    categories: [
      { id: "straight", label: "Straight / heterosexual", color: "#64748b" },
      { id: "bisexual", label: "Bisexual", color: "#8b5cf6" },
      { id: "gayLesbian", label: "Gay or lesbian", color: "#ec4899" },
      { id: "other", label: "Another orientation", color: "#06b6d4" },
      { id: "notReported", label: "Not reported", color: "#cbd5e1" },
    ],
    points: withRange([...orientationObserved, ...orientationProjected], 2025, orientationScenarios),
    scenarios: orientationScenarios,
    rangeNote: "2025 identification level held flat to the 2012–2025 trend continuing",
    categoryNotes: {
      straight: "Adults who identify as straight or heterosexual.",
      bisexual: "Gallup's 2025 split of the LGBTQ+ total, applied to every year.",
      gayLesbian: "Gallup's 2025 split of the LGBTQ+ total, applied to every year.",
      other: "Pansexual, asexual, queer and other identities (Gallup's “something else”).",
      notReported: "Respondents who declined to answer or said they didn't know.",
    },
    sources: [
      {
        label: "Gallup — U.S. LGBTQ+ identification trend, 2012–2025",
        href: "https://news.gallup.com/poll/702206/lgbtq-identification-holds.aspx",
      },
      {
        label: "CDC/NCHS — 2024 sexual-orientation distribution",
        href: "https://www.cdc.gov/nchs/data/rss/codebook.pdf",
      },
    ],
  },
];

export function getDemographicSeries(id: DemographicDimensionId): DemographicSeries {
  return demographicSeries.find((series) => series.id === id) ?? demographicSeries[0];
}
