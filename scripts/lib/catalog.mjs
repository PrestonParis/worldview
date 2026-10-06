// Catalog entries for the built-in public datasets: one per `area_stats`
// source. Each importer calls registerDataset(pg, slug) so the `datasets`
// row (title, publisher, methodology, metric labels) exists before its
// rows do; `node scripts/sync-catalog.mjs` registers them all at once.
// Partner datasets are created with scripts/partner.mjs instead.

const m = (label, unit, description) => ({ label, unit, ...(description ? { description } : {}) });

export const CATALOG = {
  cbp: {
    title: "Southwest and Nationwide Border Encounters",
    topic: "immigration",
    publisher: "U.S. Customs and Border Protection",
    sourceUrl: "https://www.cbp.gov/document/stats/nationwide-encounters",
    cadence: "Monthly",
    license: "Public domain (U.S. government work)",
    description:
      "Monthly encounters at and between ports of entry: U.S. Border Patrol apprehensions, Office of Field Operations inadmissibles, and Title 42 expulsions (March 2020 to May 2023).",
    methodology:
      "Counts are events, not unique people: one person encountered twice is counted twice. Months follow the federal fiscal year (October to September). State rows are the state of the encountering field office or sector.",
    metrics: {
      encounters_total: m("Total encounters", "encounters"),
      encounters_by_citizenship: m("Encounters by citizenship", "encounters"),
      encounters_single_adults: m("Single adults", "encounters"),
      encounters_fmua: m("Individuals in family units", "encounters"),
      encounters_uac: m("Unaccompanied children", "encounters"),
      encounters_uc_single_minors: m("Unaccompanied children / single minors", "encounters"),
      encounters_accompanied_minors: m("Accompanied minors", "encounters"),
      encounters_title_8: m("Title 8 encounters", "encounters", "Apprehensions and inadmissibles processed under immigration law (Title 8)."),
      encounters_title_42: m("Title 42 expulsions", "encounters", "Public-health expulsions, March 2020 to May 2023."),
    },
  },
  "dhs-yearbook": {
    title: "Yearbook of Immigration Statistics",
    topic: "immigration",
    publisher: "DHS Office of Homeland Security Statistics",
    sourceUrl: "https://ohss.dhs.gov/topics/immigration/yearbook",
    cadence: "Annual",
    license: "Public domain (U.S. government work)",
    description:
      "Legal immigration and humanitarian admissions by fiscal year: new lawful permanent residents (green cards), naturalizations, refugee arrivals, and asylum grants — nationally, by state of residence, and by country of birth or nationality.",
    methodology:
      "Fiscal years run October to September. DHS rounds every published cell to the nearest 10. LPR counts include both new arrivals and adjustments of status by people already in the U.S.",
    metrics: {
      lpr_total: m("New lawful permanent residents", "people"),
      lpr_adjustments: m("LPRs adjusting status inside the U.S.", "people"),
      lpr_new_arrivals: m("LPRs arriving from abroad", "people"),
      lpr_by_country: m("New LPRs by country of birth", "people"),
      lpr_by_region: m("New LPRs by region of birth", "people"),
      lpr_by_class: m("New LPRs by class of admission", "people"),
      naturalizations_total: m("Persons naturalized", "people"),
      naturalization_applications: m("Naturalization applications filed", "applications"),
      naturalization_denials: m("Naturalization applications denied", "applications"),
      naturalizations_by_country: m("Naturalizations by country of birth", "people"),
      naturalizations_by_region: m("Naturalizations by region of birth", "people"),
      refugee_arrivals: m("Refugee arrivals", "people"),
      refugee_arrivals_by_country: m("Refugee arrivals by nationality", "people"),
      refugee_arrivals_by_region: m("Refugee arrivals by region of nationality", "people"),
      asylum_grants_total: m("Individuals granted asylum", "people"),
      asylum_grants_affirmative: m("Asylum granted affirmatively (USCIS)", "people"),
      asylum_grants_defensive: m("Asylum granted defensively (immigration courts)", "people"),
      asylum_affirmative_by_country: m("Affirmative asylum grants by nationality", "people"),
      asylum_affirmative_by_region: m("Affirmative asylum grants by region of nationality", "people"),
    },
  },
  "census-pep": {
    title: "Population Estimates and Components of Change",
    topic: "immigration",
    publisher: "U.S. Census Bureau",
    sourceUrl: "https://www.census.gov/programs-surveys/popest.html",
    cadence: "Annual (each December)",
    license: "Public domain (U.S. government work)",
    description:
      "Annual July 1 population for the nation, states, and counties, with the components of change: net international migration, net domestic migration, and natural change (births minus deaths).",
    methodology:
      "Each component covers the 12 months ending June 30 of the year shown. Net international migration includes all foreign-born and native-born moves across the U.S. border regardless of legal status. 2011–2020 values come from Vintage 2020; 2021 onward from the latest vintage.",
    metrics: {
      population: m("Population (July 1)", "people"),
      population_change: m("Population change", "people"),
      international_migration: m("Net international migration", "people"),
      domestic_migration: m("Net domestic migration", "people"),
      natural_change: m("Natural change", "people", "Births minus deaths."),
      international_migration_rate: m("Net international migration rate", "per_1000"),
      domestic_migration_rate: m("Net domestic migration rate", "per_1000"),
    },
  },
  "census-acs1-immigration": {
    title: "Foreign-Born Population (ACS 1-year)",
    topic: "immigration",
    publisher: "U.S. Census Bureau",
    sourceUrl: "https://www.census.gov/topics/population/foreign-born.html",
    cadence: "Annual (each September)",
    license: "Public domain (U.S. government work)",
    description:
      "The foreign-born population of the nation and each state from the American Community Survey 1-year estimates: totals, citizenship, region of birth, and year of entry.",
    methodology:
      "Survey estimates with margins of error (stored in metadata.moe). The 2020 1-year release was not published because of pandemic data-collection disruption.",
    metrics: {
      foreign_born: m("Foreign-born population", "people"),
      foreign_born_share: m("Foreign-born share of population", "percent"),
      naturalized: m("Naturalized citizens", "people"),
      noncitizen: m("Noncitizens", "people"),
      naturalized_share_of_foreign_born: m("Naturalized share of foreign-born", "percent"),
      foreign_born_by_region: m("Foreign-born by region of birth", "people"),
      foreign_born_entered_2010_or_later: m("Foreign-born who entered 2010 or later", "people"),
    },
  },
  "ice-detention": {
    title: "ICE Detention Statistics",
    topic: "immigration",
    publisher: "U.S. Immigration and Customs Enforcement",
    sourceUrl: "https://www.ice.gov/detain/detention-management",
    cadence: "Biweekly",
    license: "Public domain (U.S. government work)",
    description:
      "Average daily population held in ICE detention facilities, by facility and state, for the fiscal year to date.",
    methodology:
      "Average daily population (ADP) is the number of people in a facility at the midnight count, averaged over the fiscal year (to date, for the current year), across facilities with at least one detainee at the time of ICE's data pull; it excludes hold rooms, hospitals, juvenile and ORR facilities. Conviction split follows ICE threat levels: levels 1–3 are assigned by criminal conviction; \"No ICE Threat Level\" means no conviction on record.",
    metrics: {
      detained_adp: m("Average daily detained population", "people"),
      detained_adp_convicted: m("Detained with a criminal conviction", "people", "ICE threat levels 1–3."),
      detained_adp_no_conviction: m("Detained with no criminal conviction", "people", "No ICE threat level."),
      detained_adp_mandatory: m("Detained under mandatory detention", "people"),
      facility_alos: m("Average length of stay", "days"),
      facilities: m("Detention facilities in use", "facilities"),
    },
  },
  "fbi-cde": {
    title: "Crime in the United States (UCR / NIBRS)",
    topic: "crime",
    publisher: "FBI Crime Data Explorer",
    sourceUrl: "https://cde.ucr.cjis.gov/",
    cadence: "Monthly",
    license: "Public domain (U.S. government work)",
    description:
      "Monthly reported offenses, rates per 100,000 residents, and clearances for violent and property crime, nationally and by state.",
    methodology:
      "Counts cover only agencies that reported in a given month, so counts are not comparable across years with different participation — the per-100,000 rates, which the FBI estimates for the full population, are. metadata.coverage is the percent of population covered by reporting agencies.",
    metrics: Object.fromEntries(
      [
        ["violent_crime", "Violent crime"], ["property_crime", "Property crime"], ["homicide", "Homicide"],
        ["rape", "Rape"], ["robbery", "Robbery"], ["aggravated_assault", "Aggravated assault"],
        ["burglary", "Burglary"], ["larceny", "Larceny-theft"], ["motor_vehicle_theft", "Motor vehicle theft"],
        ["arson", "Arson"],
      ].flatMap(([k, label]) => [
        [`${k}_count`, m(`${label} offenses`, "offenses")],
        [`${k}_rate`, m(`${label} rate`, "per_100k")],
        [`${k}_clearances`, m(`${label} clearances`, "clearances")],
      ]),
    ),
  },
  "census-acs5": {
    title: "American Community Survey 5-year Profiles",
    topic: "demographics",
    publisher: "U.S. Census Bureau",
    sourceUrl: "https://www.census.gov/programs-surveys/acs",
    cadence: "Annual",
    license: "Public domain (U.S. government work)",
    description:
      "Population, income, housing, education, race and ethnicity, nativity, and citizenship for the nation, states, counties, congressional districts, and state legislative districts.",
    methodology: "Five-year pooled survey estimates; the period shown is the final year of the five-year window.",
    metrics: {
      population: m("Population", "people"),
      median_age: m("Median age", "years"),
      median_household_income: m("Median household income", "usd"),
      per_capita_income: m("Per capita income", "usd"),
      median_home_value: m("Median home value", "usd"),
      median_gross_rent: m("Median gross rent", "usd"),
      poverty_rate: m("Poverty rate", "percent"),
      unemployment_rate: m("Unemployment rate", "percent"),
      bachelors_or_higher: m("Bachelor's degree or higher", "percent"),
      white_non_hispanic: m("White, non-Hispanic", "percent"),
      black_non_hispanic: m("Black, non-Hispanic", "percent"),
      asian_non_hispanic: m("Asian, non-Hispanic", "percent"),
      hispanic: m("Hispanic or Latino", "percent"),
      foreign_born: m("Foreign-born", "percent"),
      noncitizen: m("Noncitizen", "percent"),
      veterans: m("Veterans", "percent"),
      owner_occupied: m("Owner-occupied housing", "percent"),
      married_couple_households: m("Married-couple households", "percent"),
    },
  },
  usaspending: {
    title: "Federal Spending by Geography",
    topic: "government",
    publisher: "USAspending.gov (U.S. Treasury)",
    sourceUrl: "https://www.usaspending.gov/",
    cadence: "Daily",
    license: "Public domain (U.S. government work)",
    description: "Federal contracts, grants, loans, and direct payments by state and congressional district, plus agency budgets.",
    methodology: "Obligations by place of performance, fiscal year to date.",
    metrics: {
      federal_spending_total: m("Total federal spending", "usd"),
      federal_contracts: m("Contracts", "usd"),
      federal_grants: m("Grants", "usd"),
      federal_loans: m("Loans", "usd"),
      federal_direct_payments: m("Direct payments", "usd"),
      federal_other_assistance: m("Other financial assistance", "usd"),
      agency_budget_authority: m("Agency budget authority", "usd"),
      agency_obligated: m("Agency obligations", "usd"),
      agency_outlays: m("Agency outlays", "usd"),
    },
  },
  eavs: {
    title: "Election Administration and Voting Survey",
    topic: "elections",
    publisher: "U.S. Election Assistance Commission",
    sourceUrl: "https://www.eac.gov/research-and-data/datasets-codebooks-and-surveys",
    cadence: "Biennial",
    license: "Public domain (U.S. government work)",
    description: "Voter registration, list maintenance, mail and provisional ballots, and turnout by voting method for every election jurisdiction.",
    methodology: "Aggregates count only jurisdictions that reported each item (metadata.reporting).",
    metrics: {},
  },
};

export async function registerDataset(pg, slug) {
  const d = CATALOG[slug];
  if (!d) throw new Error(`No catalog entry for dataset "${slug}" (scripts/lib/catalog.mjs)`);
  await pg.query(
    `insert into datasets (slug, title, topic, publisher, description, methodology, source_url, license, cadence, metrics, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'published')
     on conflict (slug) do update set title = excluded.title, topic = excluded.topic, publisher = excluded.publisher,
       description = excluded.description, methodology = excluded.methodology, source_url = excluded.source_url,
       license = excluded.license, cadence = excluded.cadence,
       metrics = datasets.metrics || excluded.metrics, updated_at = now()`,
    [slug, d.title, d.topic, d.publisher, d.description, d.methodology, d.sourceUrl, d.license, d.cadence, JSON.stringify(d.metrics)],
  );
}
