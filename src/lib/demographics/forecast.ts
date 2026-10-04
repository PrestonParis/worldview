export type DemographicDimensionId = "sex" | "race" | "orientation" | "religion";

export interface DemographicCategory {
  id: string;
  label: string;
  color: string;
}

export interface DemographicPoint {
  year: number;
  values: Record<string, number>;
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
  observedThrough: number;
  categories: DemographicCategory[];
  points: DemographicPoint[];
  sources: DemographicSource[];
}

type Anchor = DemographicPoint;

const round = (value: number) => Math.round(value * 100) / 100;

const share = (part: number, total: number) => (part / total) * 100;

function normalize(values: Record<string, number>): Record<string, number> {
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

function interpolateAnchors(anchors: Anchor[], startYear: number, endYear: number): DemographicPoint[] {
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
let projectedOrientationTotal = 9;
const orientationProjected: DemographicPoint[] = [];
for (let year = 2026; year <= 2050; year += 1) {
  projectedOrientationTotal += orientationSlope * 0.94 ** (year - 2026);
  const notReported = 5 + ((3 - 5) * (year - 2025)) / 25;
  orientationProjected.push({ year, values: orientationValues(projectedOrientationTotal, notReported) });
}

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

export const demographicSeries: DemographicSeries[] = [
  {
    id: "sex",
    label: "Sex",
    description: "Share of the total resident population",
    population: "U.S. resident population",
    observedThrough: 2025,
    categories: [
      { id: "male", label: "Male", color: "#2563eb" },
      { id: "female", label: "Female", color: "#ec4899" },
    ],
    points: interpolateAnchors(sexAnchors, 1820, 2050),
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
    label: "Race",
    description: "Mutually exclusive race and ethnicity categories",
    population: "U.S. resident population",
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
    points: interpolateAnchors(raceAnchors, 2000, 2050),
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
    id: "orientation",
    label: "Sexual orientation",
    description: "Adult self-identification",
    population: "U.S. adults",
    observedThrough: 2025,
    categories: [
      { id: "straight", label: "Straight / heterosexual", color: "#64748b" },
      { id: "bisexual", label: "Bisexual", color: "#8b5cf6" },
      { id: "gayLesbian", label: "Gay or lesbian", color: "#ec4899" },
      { id: "other", label: "Another orientation", color: "#06b6d4" },
      { id: "notReported", label: "Not reported", color: "#cbd5e1" },
    ],
    points: [...orientationObserved, ...orientationProjected],
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
  {
    id: "religion",
    label: "Religion",
    description: "Adult religious affiliation",
    population: "U.S. adults",
    observedThrough: 2024,
    categories: [
      { id: "christian", label: "Christian", color: "#2563eb" },
      { id: "unaffiliated", label: "Religiously unaffiliated", color: "#f97316" },
      { id: "otherReligions", label: "Other religions", color: "#10b981" },
      { id: "multiChristian", label: "Multiple / other Christian", color: "#8b5cf6" },
      { id: "notReported", label: "Not reported", color: "#cbd5e1" },
    ],
    points: interpolateAnchors(religionAnchors, 2007, 2050),
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
];

export function getDemographicSeries(id: DemographicDimensionId): DemographicSeries {
  return demographicSeries.find((series) => series.id === id) ?? demographicSeries[0];
}
