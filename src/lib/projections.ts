// Published projections for the current year, used where the official annual
// series only runs through last year. Updated by hand as sources revise.

// Census Bureau, Vintage 2025 release: net international migration "is
// projected to further decline to approximately 321,000 in 2026" (year to
// July 1, 2026).
export const NET_MIGRATION_2026 = {
  year: "2026",
  value: 321_000,
  source: "https://www.census.gov/newsroom/blogs/random-samplings/2026/01/historic-decline-in-net-international-migration.html",
};

// Crime Index (Jeff Asher, crimeindex.org): violent crime Jan–Aug 2026 vs
// Jan–Aug 2025 across 547 agencies. Applied to the FBI's 2025 rate.
export const VIOLENT_CRIME_2026 = {
  year: "2026",
  ytdChange: -5.9,
  through: "Aug",
  source: "https://crimeindex.org/",
};
