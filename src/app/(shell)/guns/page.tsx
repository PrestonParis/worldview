import type { Metadata } from "next";
import { ChartCard, type ChartSource } from "@/components/charts/chart-card";
import { citeSources, type SourceSpec } from "@/components/charts/citation";
import { MeasureChartCard } from "@/components/charts/measure-chart-card";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { IssueEmpty, IssueHeader, Prose, Section } from "@/components/data/issue-layout";
import { SectionNav } from "@/components/data/section-nav";
import { loadGuns } from "@/lib/guns/data";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Guns in America | Worldview",
  description:
    "Firearm ownership, deaths, regulation, constitutional law, policy opinion, and state outcomes in the United States.",
};

const SECTIONS = [
  ["overview", "Overview"],
  ["ownership", "Gun ownership"],
  ["violence", "Gun violence"],
  ["laws", "Gun laws"],
  ["second-amendment", "Second Amendment"],
  ["policy", "Policy & evidence"],
  ["states", "States"],
] as const;

const SOURCE_SPECS = {
  cdc: { label: "CDC NCHS death certificates", href: "/datasets/cdc-violent-deaths" },
  cdcOld: { label: "CDC NCHS injury mortality", href: "/datasets/cdc-injury-mortality" },
  gallup: { label: "Gallup", href: "/datasets/gallup-guns" },
} satisfies Record<string, SourceSpec>;

const CDC_FINAL_2017: ChartSource = {
  label: "CDC NCHS, final mortality tables for 2017",
  href: "https://www.cdc.gov/nchs/data/nvsr/nvsr68/nvsr68_09-508.pdf",
};

const CDC_FINAL_2018: ChartSource = {
  label: "CDC NCHS, final mortality tables for 2018",
  href: "https://www.cdc.gov/nchs/data/nvsr/nvsr69/nvsr69-13-tables-508.pdf",
};

const REGULATORY_STAGES = [
  [
    "01",
    "Eligibility",
    "Age, residency, criminal history, qualifying domestic-violence restrictions, and other prohibited-person rules.",
  ],
  [
    "02",
    "Acquisition",
    "The seller and transfer type determine which identification, records, background checks, permits, or waiting periods apply.",
  ],
  [
    "03",
    "Possession",
    "Federal and state rules may address firearm types, registration, storage, minors, relinquishment, and restricted places.",
  ],
  [
    "04",
    "Carry and use",
    "Open or concealed carry, licensing, sensitive locations, reciprocity, transport, and self-defense rules vary by jurisdiction.",
  ],
] as const;

const LAW_FAMILIES = [
  [
    "Purchasing",
    "Dealer sales, private transfers, background checks, waiting periods, purchase permits, and minimum ages.",
  ],
  [
    "Eligibility",
    "Federal and state disqualifications, domestic-violence restrictions, surrender, and restoration of rights.",
  ],
  [
    "Firearm types",
    "Machine guns, short-barreled firearms, suppressors, magazine limits, and differing assault-weapon definitions.",
  ],
  ["Carrying", "Permitless carry, concealed and open carry, sensitive places, transport, and reciprocity."],
  [
    "Possession & storage",
    "Safe-storage and child-access rules, registration systems, and restrictions in particular locations.",
  ],
  [
    "Temporary restrictions",
    "Extreme-risk protection orders, required process, duration, renewal, and return of firearms.",
  ],
  ["Self-defense", "Castle doctrine, stand-your-ground rules, retreat requirements, and limits on the use of force."],
  [
    "Enforcement & liability",
    "Trafficking, straw purchasing, dealer oversight, tracing, and civil-liability rules and exceptions.",
  ],
] as const;

const CONSTITUTIONAL_TIMELINE = [
  [
    "1791",
    "Second Amendment ratified",
    "The amendment protects a right to keep and bear arms; the scope of that protection has been developed through later cases.",
    "https://constitution.congress.gov/browse/amendment-2/",
  ],
  [
    "1934",
    "National Firearms Act",
    "Congress imposed registration and taxation requirements on a defined set of firearms, including machine guns and short-barreled weapons.",
    "https://www.atf.gov/rules-and-regulations/national-firearms-act",
  ],
  [
    "1968",
    "Gun Control Act",
    "The federal licensing and prohibited-person framework was substantially expanded after the assassinations of the 1960s.",
    "https://www.atf.gov/rules-and-regulations/gun-control-act",
  ],
  [
    "1993",
    "Brady Act",
    "The law created the federal background-check framework that became the National Instant Criminal Background Check System.",
    "https://www.congress.gov/bill/103rd-congress/house-bill/1025",
  ],
  [
    "2008",
    "District of Columbia v. Heller",
    "The Supreme Court held that the Second Amendment protects an individual right to possess a handgun in the home for self-defense.",
    "https://tile.loc.gov/storage-services/service/ll/usrep/usrep554/usrep554570/usrep554570.pdf",
  ],
  [
    "2010",
    "McDonald v. Chicago",
    "The Court held that the Second Amendment right recognized in Heller applies to state and local governments through the Fourteenth Amendment.",
    "https://tile.loc.gov/storage-services/service/ll/usrep/usrep561/usrep561742/usrep561742.pdf",
  ],
  [
    "2022",
    "New York State Rifle & Pistol Association v. Bruen",
    "The Court held that ordinary citizens have a right to carry handguns publicly for self-defense and announced a history-and-tradition test for gun regulations.",
    "https://www.supremecourt.gov/opinions/21pdf/20-843_7j80.pdf",
  ],
  [
    "2022",
    "Bipartisan Safer Communities Act",
    "Congress expanded background-check review for purchasers under 21, funded state crisis-intervention programs, and changed several federal firearm provisions.",
    "https://www.congress.gov/bill/117th-congress/senate-bill/2938",
  ],
  [
    "2024",
    "United States v. Rahimi",
    "The Court upheld the federal restriction on firearm possession by people subject to qualifying domestic-violence restraining orders.",
    "https://www.supremecourt.gov/opinions/23pdf/22-915_8o6b.pdf",
  ],
] as const;

export default async function GunsPage() {
  const d = await loadGuns();
  if (!d) return <IssueEmpty title="Guns" />;
  const h = d.headline;
  const SOURCES = citeSources(SOURCE_SPECS, d.datasets);
  const mortalitySources = [SOURCES.cdcOld, CDC_FINAL_2017, CDC_FINAL_2018, SOURCES.cdc];

  return (
    <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[minmax(0,1fr)_10rem] lg:gap-10">
      <aside className="contents lg:order-2 lg:block">
        <SectionNav sections={SECTIONS} side />
      </aside>
      <div className="min-w-0 space-y-14 pt-8 lg:pt-0">
        <IssueHeader title="Guns in America">
          <p className="mt-4 text-lg leading-7 text-slate-600 dark:text-slate-300">
            Ownership, violence, rights, regulation, and policy in the United States.
          </p>
        </IssueHeader>

        <Section id="overview" title="Overview" question="What does this page measure, and where should you start?">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              href="#violence"
              label="Firearm deaths"
              unit="deaths"
              value={h.deaths.point?.value ?? null}
              tag={h.deaths.point ? { label: h.deaths.point.period, latest: true } : undefined}
              note="All intents · recent CDC estimates may be provisional"
              spark={h.deaths.spark}
            />
            <StatTile
              href="#violence"
              label="Suicides"
              unit="percent"
              value={h.suicideShare?.value ?? null}
              tag={h.suicideShare ? { label: h.suicideShare.period, latest: true } : undefined}
              note="Share of all firearm deaths"
            />
            <StatTile
              href="#ownership"
              label="Personally own a gun"
              unit="percent"
              value={h.own.point?.value ?? null}
              tag={h.own.point ? { label: `${h.own.point.period} survey`, latest: true } : undefined}
              note="Share of U.S. adults · Gallup"
              spark={h.own.spark}
            />
            <StatTile
              href="#ownership"
              label="Gun in the home"
              unit="percent"
              value={h.home.point?.value ?? null}
              tag={h.home.point ? { label: `${h.home.point.period} survey`, latest: true } : undefined}
              note="Household exposure, not personal ownership · Gallup"
              spark={h.home.spark}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              [
                "What is happening?",
                "Ownership estimates, firearm deaths by intent, who dies, and differences among states.",
                "#ownership",
              ],
              [
                "What does the law allow?",
                "The federal baseline, state layers, major regulatory families, and constitutional decisions.",
                "#laws",
              ],
              [
                "What should change?",
                "Public opinion is shown separately from legal permissibility and evidence of policy effects.",
                "#policy",
              ],
            ].map(([title, body, href]) => (
              <a
                key={title}
                href={href}
                className="rounded-2xl border border-slate-200 p-5 transition hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
              >
                <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p>
              </a>
            ))}
          </div>
        </Section>

        <Section
          id="ownership"
          title="Gun ownership"
          question="How many Americans personally own a gun or live in a home with one?"
        >
          <ChartCard
            title="Personal ownership and household exposure"
            subtitle="Share of U.S. adults · survey estimates"
            source={SOURCES.gallup}
            table={seriesTable(d.ownership, "percent")}
          >
            <TimeSeriesChart series={d.ownership} unit="percent" height={300} />
          </ChartCard>
          <Prose>
            <p>
              These are different measures. “Gun in the home” includes adults who do not personally own the firearm;
              “personally own” is the respondent&apos;s self-report. Neither estimates the number of firearms. Purchase
              and background-check transactions would be a third measure, and a transaction is not the same thing as a
              gun sold.
            </p>
          </Prose>
        </Section>

        <Section
          id="violence"
          title="Gun violence"
          question="How many people die from firearms, by what intent, and at what ages?"
        >
          <MeasureChartCard
            title="Firearm deaths"
            source={mortalitySources}
            measures={[
              { label: "Deaths", subtitle: "By intent, annual counts since 1999", series: d.deaths, unit: "deaths" },
              {
                label: "Rate",
                subtitle: "By intent, deaths per 100,000 residents since 1999",
                series: d.rates,
                unit: "per_100k",
              },
            ]}
            height={340}
            markers={[{ x: 2020.2, label: "COVID-19 pandemic" }]}
          />
          <Prose>
            <p>
              Deaths are counted from death certificates and classified by intent. The series now bridges 2017 and 2018
              with CDC&apos;s final annual mortality tables—39,773 and 39,740 firearm deaths, respectively—rather than
              showing a false data gap. The newest dashboard periods can be provisional and may be revised.
            </p>
          </Prose>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Every recorded intent"
              subtitle="Final firearm deaths by intent, 2018"
              source={CDC_FINAL_2018}
              table={rankedTable(d.intentBreakdown, "Intent", "deaths")}
            >
              <RankedBars items={d.intentBreakdown} unit="deaths" slot={1} limit={5} />
            </ChartCard>
            <ChartCard
              title="Firearm death rate by age"
              subtitle={`All intents, per 100,000 people in each age group · ${d.ageYear ?? "year unavailable"}`}
              source={SOURCES.cdcOld}
              table={rankedTable(d.byAge, "Age", "per_100k")}
            >
              <RankedBars items={d.byAge} unit="per_100k" slot={2} />
            </ChartCard>
          </div>
          <ChartCard
            title="Homicides committed with a firearm"
            subtitle="Share of all homicide deaths · annual"
            source={SOURCES.cdc}
            table={seriesTable(d.gunShare, "percent")}
          >
            <TimeSeriesChart series={d.gunShare} unit="percent" height={240} fromZero={false} />
          </ChartCard>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
            <h3 className="font-semibold text-slate-950 dark:text-white">Mortality is not all firearm violence</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
              These charts do not count nonfatal injuries, threats, robberies, aggravated assaults, defensive gun use,
              or shootings defined by a particular incident rule. Those measures come from different surveillance and
              survey systems and should be added with their definitions and uncertainty visible, not folded into the
              death series.
            </p>
          </div>
        </Section>

        <Section
          id="laws"
          title="Gun laws"
          question="How do federal and state rules shape acquisition, possession, carrying, and use?"
        >
          <div className="rounded-2xl border border-slate-200 p-5 sm:p-6 dark:border-slate-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Regulatory system</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                  A firearm moves through layers of law
                </h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Explanatory model—not an eligibility decision
              </span>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              {REGULATORY_STAGES.map(([number, title, body], index) => (
                <div key={title} className="relative rounded-xl bg-slate-50 p-4 dark:bg-slate-900/70">
                  <p className="font-mono text-xs text-slate-400">{number}</p>
                  <h4 className="mt-2 font-semibold text-slate-950 dark:text-white">{title}</h4>
                  <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">{body}</p>
                  {index < REGULATORY_STAGES.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 -right-2.5 z-10 hidden text-slate-300 md:block dark:text-slate-700"
                    >
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Federal law supplies a nationwide baseline. State and local law can add requirements, exceptions, and
              location-specific rules. Always verify the jurisdiction, effective date, transaction type, and firearm
              type.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LAW_FAMILIES.map(([title, body]) => (
              <article key={title} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h3>
                <p className="mt-1.5 text-sm leading-5 text-slate-600 dark:text-slate-300">{body}</p>
              </article>
            ))}
          </div>
          <Prose>
            <p>
              A useful legal comparison must identify the actual rule, exceptions, effective date, and source. A count
              of “gun laws” cannot show whether two states regulate the same conduct or whether a rule applies in a
              particular case.
            </p>
          </Prose>
        </Section>

        <Section
          id="second-amendment"
          title="Second Amendment"
          question="How did the constitutional and federal framework develop?"
        >
          <ol className="space-y-0 border-l border-slate-200 pl-5 dark:border-slate-800">
            {CONSTITUTIONAL_TIMELINE.map(([year, title, body, href]) => (
              <li key={`${year}-${title}`} className="relative pb-7 last:pb-0">
                <span
                  aria-hidden
                  className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-white bg-slate-500 dark:border-slate-950"
                />
                <p className="font-mono text-xs font-medium text-slate-500 dark:text-slate-400">{year}</p>
                <h3 className="mt-0.5 font-semibold text-slate-950 dark:text-white">{title}</h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-block text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Read the primary source ↗
                </a>
              </li>
            ))}
          </ol>
          <Prose>
            <p>
              A decision that a restriction is constitutional does not establish that it is effective policy, and
              evidence that a policy affects an outcome does not by itself establish that the Constitution permits it.
            </p>
          </Prose>
        </Section>

        <Section
          id="policy"
          title="Policy & evidence"
          question="What do people prefer, and what would show whether a policy works?"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Want gun-sale laws more strict"
              unit="percent"
              value={h.strict.point?.value ?? null}
              tag={h.strict.point ? { label: `${h.strict.point.period} survey`, latest: true } : undefined}
              note="Broad preference, not support for every individual proposal · Gallup"
              spark={h.strict.spark}
            />
          </div>
          <ChartCard
            title="Preferred direction for gun-sale laws"
            subtitle="Share of U.S. adults · more strict, less strict, or kept as now"
            source={SOURCES.gallup}
            table={seriesTable(d.opinion, "percent")}
          >
            <TimeSeriesChart series={d.opinion} unit="percent" height={280} />
          </ChartCard>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              [
                "Legal permissibility",
                "Whether a policy is allowed under the Constitution, federal law, and controlling court decisions.",
              ],
              [
                "Public preference",
                "Whether people favor a named proposal; results depend on wording, scope, and available choices.",
              ],
              [
                "Empirical effect",
                "Whether credible research links a defined policy to a defined outcome, with uncertainty and alternative explanations visible.",
              ],
            ].map(([title, body]) => (
              <article key={title} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section id="states" title="Across the states" question="How do firearm outcomes differ among states?">
          <StateExplorer metrics={d.states.metrics} rows={d.states.rows} color="#b91c1c" />
          <Prose>
            <p>
              The map compares outcomes, not causes. Differences can reflect population composition, urbanization,
              economic conditions, firearm access, neighboring states, enforcement, and many other factors. A state-law
              overlay should be read as timing and context—not as proof that a law caused the observed difference.
            </p>
          </Prose>
        </Section>
      </div>
    </div>
  );
}
