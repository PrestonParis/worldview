import { ChevronDown, Scale } from "lucide-react";

type Era = {
  years: string;
  title: string;
  summary: string;
  milestones: { year: string; title: string; detail: string }[];
  sources: { label: string; href: string }[];
};

const ERAS: Era[] = [
  {
    years: "1789–1875",
    title: "States regulate arrival; Congress regulates citizenship",
    summary:
      "Congress set federal naturalization rules, while port states used passenger, quarantine, bond, and poor-relief laws to control who could land.",
    milestones: [
      {
        year: "1790",
        title: "First Naturalization Act",
        detail:
          "Created a uniform federal route to citizenship, limited to “free white persons” of good character after two years’ residence.",
      },
      {
        year: "1798",
        title: "Alien and Sedition Acts",
        detail:
          "Raised the citizenship residence period to 14 years and gave the president temporary powers over noncitizens considered dangerous; the wartime Alien Enemies Act endured.",
      },
      {
        year: "1820s–1840s",
        title: "Passenger and anti-pauper laws",
        detail:
          "New York, Massachusetts, and other port states required passenger reports, bonds, or fees. Courts first tolerated some police-power rules, then limited state head taxes.",
      },
    ],
    sources: [
      {
        label: "National Archives — major immigration and naturalization laws, 1790–2005",
        href: "https://www.archives.gov/files/research/naturalization/420-major-immigration-laws.pdf",
      },
      {
        label: "National Archives — Alien and Sedition Acts",
        href: "https://www.archives.gov/milestone-documents/alien-and-sedition-acts",
      },
    ],
  },
  {
    years: "1875–1921",
    title: "Federal exclusion and a national immigration service",
    summary:
      "Federal law began excluding named classes and nationalities, while Supreme Court decisions displaced state passenger controls with a national system.",
    milestones: [
      {
        year: "1875–1876",
        title: "Page Act and the federal transition",
        detail:
          "The Page Act created the first federal exclusions. Henderson and Chy Lung then struck down state passenger restrictions that interfered with national immigration and foreign relations.",
      },
      {
        year: "1882",
        title: "General regulation and Chinese exclusion",
        detail:
          "Congress imposed a federal arrival tax and excluded several categories of entrants. A separate law suspended immigration by Chinese laborers and barred Chinese naturalization.",
      },
      {
        year: "1891–1917",
        title: "Administration and broader exclusions",
        detail:
          "The federal government created an immigration superintendent, opened Ellis Island, standardized naturalization, added literacy tests, and established an Asiatic Barred Zone.",
      },
    ],
    sources: [
      {
        label: "Library of Congress — the 1875 Page Act in context",
        href: "https://guides.loc.gov/american-women-law/federal-laws",
      },
      {
        label: "Library of Congress — Chy Lung v. Freeman",
        href: "https://www.loc.gov/item/usrep092275/",
      },
      {
        label: "National Archives — Chinese Exclusion Act",
        href: "https://www.archives.gov/milestone-documents/chinese-exclusion-act",
      },
    ],
  },
  {
    years: "1921–1965",
    title: "National-origins quotas",
    summary:
      "Numerical quotas favored northern and western Europe, sharply restricted southern and eastern Europe, and reinforced Asian exclusion.",
    milestones: [
      {
        year: "1921",
        title: "Emergency Quota Act",
        detail:
          "Introduced country quotas tied to the number of people from each country already recorded in the United States.",
      },
      {
        year: "1924",
        title: "Johnson–Reed Act",
        detail:
          "Tightened the quota formula, required immigrant visas before travel, and barred people ineligible for citizenship—effectively excluding immigration from Asia. Congress created the Border Patrol in a separate appropriations law that year.",
      },
      {
        year: "1943–1952",
        title: "Exclusion repealed; the INA assembled",
        detail:
          "Congress repealed Chinese exclusion and gradually removed racial naturalization bars. The 1952 Immigration and Nationality Act consolidated the law but retained national-origins quotas.",
      },
    ],
    sources: [
      {
        label: "State Department historian — Immigration Act of 1924",
        href: "https://history.state.gov/milestones/1921-1936/immigration-act",
      },
      {
        label: "State Department historian — Immigration and Nationality Act of 1952",
        href: "https://history.state.gov/milestones/1945-1952/immigration-act",
      },
      {
        label: "USCIS History Office — overview of INS history",
        href: "https://www.uscis.gov/sites/default/files/document/fact-sheets/INSHistory.pdf",
      },
    ],
  },
  {
    years: "1965–1985",
    title: "Family, skills, and a general refugee framework",
    summary:
      "The modern admissions structure replaced national origins with preferences for family relationships and skills, while refugee policy became a standing system.",
    milestones: [
      {
        year: "1965",
        title: "Hart–Celler amendments",
        detail:
          "Ended the national-origins quota system and established preference categories centered on family reunification and needed skills, with annual and per-country limits.",
      },
      {
        year: "1980",
        title: "Refugee Act",
        detail:
          "Created a general framework for refugee admissions and brought the U.S. definition of refugee into line with the international standard.",
      },
    ],
    sources: [
      {
        label: "USCIS History Office — postwar reform and the 1965 amendments",
        href: "https://www.uscis.gov/sites/default/files/document/fact-sheets/INSHistory.pdf",
      },
      {
        label: "National Archives — from exclusion to the 1965 system",
        href: "https://www.archives.gov/milestone-documents/chinese-exclusion-act",
      },
    ],
  },
  {
    years: "1986–2001",
    title: "Legalization, employer rules, and expanded enforcement",
    summary:
      "Congress paired legalization and revised visa channels with employer sanctions and major changes to detention, removal, and review.",
    milestones: [
      {
        year: "1986",
        title: "Immigration Reform and Control Act",
        detail:
          "Created legalization programs for many long-term and agricultural residents, made knowingly hiring unauthorized workers unlawful, and increased enforcement resources.",
      },
      {
        year: "1990",
        title: "Immigration Act of 1990",
        detail:
          "Revised and expanded permanent immigration through family, employment, and diversity categories and moved naturalization decisions into the immigration agency.",
      },
      {
        year: "1996",
        title: "IIRIRA",
        detail:
          "Reworked removal procedure, expanded expedited removal and detention rules, added unlawful-presence consequences, and narrowed some forms of judicial review.",
      },
    ],
    sources: [
      {
        label: "USCIS — IRCA implementation overview",
        href: "https://www.uscis.gov/sites/default/files/document/data/tri3fullreport.pdf",
      },
      {
        label: "USCIS History Office — 1986 and 1990 reforms",
        href: "https://www.uscis.gov/sites/default/files/document/fact-sheets/INSHistory.pdf",
      },
      {
        label: "Congressional Research Service — reading the INA and later amendments",
        href: "https://www.congress.gov/crs_external_products/R/PDF/R45190/R45190.5.pdf",
      },
    ],
  },
  {
    years: "2002–present",
    title: "One statute, divided agencies",
    summary:
      "The INA remains the statutory foundation, but the former INS mission is now divided among benefits, border, interior-enforcement, court, and visa agencies.",
    milestones: [
      {
        year: "2002–2003",
        title: "Homeland Security reorganization",
        detail:
          "The Homeland Security Act created DHS. In 2003, INS functions moved principally to USCIS, Customs and Border Protection, and Immigration and Customs Enforcement; immigration courts remained in the Justice Department.",
      },
      {
        year: "Today",
        title: "A repeatedly amended framework",
        detail:
          "Congressional statutes set the core rules, while agencies, presidents, and courts continue to shape how admission, benefits, enforcement, detention, and humanitarian protection operate.",
      },
    ],
    sources: [
      {
        label: "DHS Inspector General — creation of CBP and ICE",
        href: "https://www.oig.dhs.gov/sites/default/files/assets/Mgmt/OIG_06-04_Nov05.pdf",
      },
      {
        label: "DHS immigration statistics — the 2003 reorganization",
        href: "https://ohss.dhs.gov/sites/default/files/2023-12/Yearbook_Immigration_Statistics_2003.pdf",
      },
    ],
  },
];

export function ImmigrationLawGuide() {
  return (
    <section id="law-guide" aria-labelledby="law-guide-title" className="scroll-mt-24 pt-8">
      <header className="max-w-3xl">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
          <Scale aria-hidden className="size-4" />
          Immigration law guide
        </p>
        <h2 id="law-guide-title" className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
          How the legal system took shape
        </h2>
        <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
          A selective history of the laws and court decisions that changed who controlled immigration, who could enter
          or naturalize, and how today&apos;s agencies and procedures emerged. Expand an era for its turning points.
        </p>
      </header>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        {ERAS.map((era) => (
          <details key={era.years} className="group border-b border-slate-200 last:border-b-0 dark:border-slate-800">
            <summary className="grid cursor-pointer list-none gap-3 px-5 py-5 transition hover:bg-slate-50 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-start sm:px-6 dark:hover:bg-slate-900/60">
              <span className="font-semibold text-blue-700 tabular-nums dark:text-blue-300">{era.years}</span>
              <span>
                <span className="block text-lg font-semibold text-slate-950 dark:text-white">{era.title}</span>
                <span className="mt-1 block max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {era.summary}
                </span>
              </span>
              <ChevronDown
                aria-hidden
                className="hidden size-5 text-slate-400 transition group-open:rotate-180 sm:block"
              />
            </summary>

            <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-5 sm:pl-[10.5rem] sm:px-6 dark:border-slate-800 dark:bg-slate-900/30">
              <ol className="grid gap-4 lg:grid-cols-3">
                {era.milestones.map((milestone) => (
                  <li
                    key={`${era.years}:${milestone.year}:${milestone.title}`}
                    className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-950"
                  >
                    <p className="text-xs font-semibold text-blue-700 tabular-nums dark:text-blue-300">
                      {milestone.year}
                    </p>
                    <h3 className="mt-1 font-semibold text-slate-950 dark:text-white">{milestone.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{milestone.detail}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Primary and federal references:
                </span>
                {era.sources.map((source) => (
                  <a
                    key={source.href}
                    href={source.href}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-slate-300 underline-offset-2 hover:text-blue-700 dark:decoration-slate-600 dark:hover:text-blue-300"
                  >
                    {source.label} ↗
                  </a>
                ))}
              </div>
            </div>
          </details>
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
        Selected milestones, not legal advice or an exhaustive legislative history. The guide uses the project&apos;s
        research notes as a starting outline and federal primary or institutional sources for verification.
      </p>
    </section>
  );
}
