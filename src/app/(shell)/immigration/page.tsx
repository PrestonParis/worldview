import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { citeSources } from "@/components/charts/citation";
import { periodTags } from "@/components/charts/period-tag";
import { IssueHeader } from "@/components/data/issue-layout";
import { ImmigrationExplorerProvider } from "@/components/immigration/green-card-explorer";
import { ImmigrationLawGuide } from "@/components/immigration/law-guide";
import { ImmigrationSystemExplorer, type Faq, type Headline } from "@/components/immigration/system/system-explorer";
import { Term } from "@/components/ui/term";
import { formatPeriod } from "@/lib/format";
import { loadImmigration } from "@/lib/immigration/data";
import { loadCrimeCitizenship } from "@/lib/immigration/crime";
import { CrimeCitizenshipSection } from "@/components/immigration/crime-citizenship";
import type { StatKey } from "@/lib/immigration/system";
import { entryFigures } from "./figures/entry";
import { outcomesFigures } from "./figures/outcomes";
import { pathwaysFigures } from "./figures/pathways";
import { populationFigures } from "./figures/population";
import { processingFigures } from "./figures/processing";
import { compact, pct, SOURCE_SPECS } from "./figures/shared";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Immigration | Worldview",
  description:
    "An interactive map of the U.S. immigration system: entry, permanent and temporary pathways, humanitarian protection, enforcement and due process, outcomes, and the foreign-born population — with data from CBP, DHS, ICE, and the Census Bureau.",
};

const NUMBER_WORDS: Record<number, string> = {
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
  10: "ten",
  11: "eleven",
  12: "twelve",
};
const year = (period: string) => period.replace(/\D/g, "");

export default async function ImmigrationPage() {
  const [d, crime] = await Promise.all([loadImmigration(), loadCrimeCitizenship()]);
  const { stats: s } = d;
  const lastMonth = d.border.lastMonth;
  const trailing = lastMonth ? periodTags.trailing12(lastMonth).label : "";
  const yearbookYear = s.lpr ? year(s.lpr.period) : "";
  const removalsYear = s.removals ? year(s.removals.period) : "";
  const SOURCES = citeSources(SOURCE_SPECS, d.datasets);

  const longRun = d.population.longRun[0].points;
  const nowShare = longRun.at(-1);
  const since = nowShare ? longRun.findLast((p) => p.x < nowShare.x && p.value >= nowShare.value) : undefined;

  // ------------------------------------- Charts and figures, by stage
  const ctx = { d, SOURCES, trailing };
  const parts = [entryFigures, pathwaysFigures, processingFigures, outcomesFigures, populationFigures].map((f) => f(ctx));
  const stats: Partial<Record<StatKey, ReactNode>> = Object.assign({}, ...parts.map((p) => p.stats));
  const headlines: Partial<Record<StatKey, Headline>> = Object.assign({}, ...parts.map((p) => p.headlines));

  // --------------------------------------------- Questions, by node
  const faq: Faq[] = [
    {
      q: "What are Title 8 and Title 42?",
      a: "Title 8 is ordinary federal immigration law; almost every encounter is processed under it. Title 42 was a public-health authority used from March 2020 to May 2023 to expel people quickly without immigration processing.",
      nodes: ["border-encounter", "out-other-departure", "entry-between"],
    },
    {
      q: "Is a border encounter the same as an illegal immigrant? Is each encounter a different person?",
      a: "No to both. An encounter is an event: someone stopped twice counts twice, and people who arrive at an airport without valid papers are encounters too. Encounters also don't count people who crossed without being stopped.",
      nodes: ["border-encounter", "unauthorized-population"],
    },
    {
      q: "What's the difference between an encounter and an apprehension?",
      a: (
        <>
          An apprehension is one kind of encounter: Border Patrol taking someone into custody between ports of entry.
          The other kind is a person found inadmissible at a port of entry.
          {s.encounters12?.usbpShare != null && (
            <>
              {" "}
              In the last 12 months, {pct(s.encounters12.usbpShare)} of encounters were Border Patrol apprehensions or
              expulsions.
            </>
          )}
        </>
      ),
      nodes: ["border-encounter", "entry-between", "entry-port"],
    },
    {
      q: "Why do Florida and New York have border encounters? Does “Texas encounters” mean people settled in Texas?",
      a: "Encounters are filed under the state of the CBP office that recorded them. Florida and New York have large international airports and seaports, where people found inadmissible are counted. Where someone was encountered says nothing about where they live or go.",
      nodes: ["border-encounter", "states"],
    },
    {
      q: "How many people were deported?",
      a: s.removals
        ? `DHS carried out ${compact(s.removals.value)} removals in ${formatPeriod(s.removals.period)}, the latest year published, plus returns and Title 42 expulsions.`
        : "See Removal.",
      nodes: ["out-removal", "enforcement", "out-other-departure"],
    },
    {
      q: "How many asylum claims were granted?",
      a: s.asylum
        ? `${compact(s.asylum.value)} people were granted asylum in ${formatPeriod(s.asylum.period)}, by USCIS asylum officers or immigration judges.`
        : "See Asylum adjudication.",
      nodes: ["asylum-adjudication", "aff-interview", "def-hearing", "out-protection", "humanitarian"],
    },
    {
      q: "Does passing a credible-fear screening mean someone got asylum?",
      a: "No. A positive credible-fear finding only means the claim can go forward to a full hearing, where it is decided on the merits — often years later.",
      nodes: ["credible-fear", "proc-expedited", "humanitarian"],
    },
    {
      q: "How many unauthorized immigrants live in the U.S.?",
      a: s.unauthorized
        ? `DHS estimates ${compact(s.unauthorized.value)} as of January 1, ${s.unauthorized.period}, its latest estimate. Pew Research Center estimates 14 million as of July 2023.`
        : "See Unauthorized population.",
      nodes: ["unauthorized-population", "unauthorized"],
    },
    {
      q: "Do green cards mean that many people entered the country that year?",
      a: s.lpr
        ? `No. In ${formatPeriod(s.lpr.period)}, ${pct(s.lpr.adjustmentShare)} of the ${compact(s.lpr.value)} new green cards went to people who were already living in the U.S. and adjusted their status.`
        : "No — many go to people already living here.",
      nodes: ["lpr", "adjustment", "permanent"],
    },
    {
      q: "Is net international migration just immigration minus deportations? Why doesn't it match green cards?",
      a: "Neither. Net international migration counts everyone who moved here for a year or more — any status, including returning U.S. citizens — minus everyone who moved abroad. Green cards count status grants, mostly to people who were already here, so the two measure different things.",
      nodes: ["net-migration", "lpr"],
    },
    {
      q: "What's the difference between a refugee and an asylum seeker?",
      a: "Both must show the same fear of persecution. Refugees are approved while outside the U.S. and then resettled here; asylum is requested after reaching the U.S. or its border.",
      nodes: ["humanitarian", "refugee-admission", "asylum-adjudication"],
    },
    {
      q: "Does everyone facing deportation get a hearing before a judge?",
      a: "No. People in §240 proceedings do, with appeals. Expedited removal, reinstatement of a prior order, and administrative removal are decided by immigration officers; their main safeguard is a fear screening, with limited review.",
      nodes: ["enforcement", "procedure-choice", "proc-expedited", "proc-reinstatement", "proc-admin", "proc-240"],
    },
    {
      q: "Do people in immigration court get a free lawyer?",
      a: "No. They have the right to a lawyer, but at no expense to the government. Courts provide a list of free legal service providers.",
      nodes: ["proc-240", "p240-nta", "p240-master"],
    },
    {
      q: "Why are people without criminal convictions in ICE detention?",
      a: (
        <>
          Immigration detention is civil custody while a removal case is decided or a removal is arranged, not
          punishment for a crime. Being in the U.S. without status is a civil violation. Some people are held under
          mandatory-detention laws; “no criminal conviction” can include people with pending charges.
          {s.detention?.noConvictionShare != null && (
            <>
              {" "}
              In {formatPeriod(s.detention.period)} so far, {pct(s.detention.noConvictionShare)} of the average daily
              population had no criminal conviction.
            </>
          )}
        </>
      ),
      nodes: ["detention", "mandatory-detention", "custody-decision"],
    },
    {
      q: "How long is the immigration court backlog?",
      a: s.courts
        ? `${compact(s.courts.value, "cases")} cases were pending before immigration judges at the end of ${formatPeriod(s.courts.period)}. Judges completed ${compact(d.courts.flow.find((x) => x.id === "completions")?.points.at(-1)?.value, "cases")} cases in the latest full year.`
        : "See Removal proceedings.",
      nodes: ["proc-240", "p240-master", "enforcement"],
    },
    {
      q: "How many people overstay their visas?",
      a: s.overstays
        ? `CBP counted ${compact(s.overstays.value)} visitors who arrived by air or sea and were still believed to be in the U.S. at the end of ${formatPeriod(s.overstays.period)} after their stay ended — ${s.overstays.rate}% of those due to leave. The count falls as later departures and status changes are recorded.`
        : "See Visa overstay.",
      nodes: ["overstay", "unauthorized", "unauthorized-population"],
    },
    {
      q: "Does “foreign-born” include naturalized citizens and unauthorized immigrants?",
      a: "Yes. It counts everyone living here who wasn't a U.S. citizen at birth, whatever their status today.",
      nodes: ["foreign-born", "naturalization"],
    },
    {
      q: "Why are some figures from 2024 or earlier?",
      a: `Each agency publishes on its own schedule. DHS releases each Yearbook of Immigration Statistics about a year and a half after the fiscal year ends — FY ${yearbookYear} is the newest — and its enforcement chapter${removalsYear ? ` (FY ${removalsYear})` : ""} trails by another year. DHS's unauthorized-population estimate is published irregularly. CBP publishes monthly.`,
      nodes: ["system"],
    },
    {
      q: "Why are moves between states on this page?",
      a: "They aren't immigration, but they're often confused with it, so they sit under Related migration, with Americans living abroad.",
      nodes: ["related-migration"],
    },
  ];

  return (
    <ImmigrationExplorerProvider>
      <div className="mx-auto max-w-[96rem] space-y-6">
        <IssueHeader title="Immigration">
          {nowShare && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-6">
              <p className="shrink-0 text-5xl leading-none font-semibold tracking-tight text-slate-950 tabular-nums sm:text-6xl dark:text-white">
                {nowShare.value.toFixed(1)}%
              </p>
              <div className="space-y-1.5">
                <p className="text-base leading-7 text-slate-700 sm:text-lg dark:text-slate-200">
                  About one in {NUMBER_WORDS[Math.round(100 / nowShare.value)] ?? Math.round(100 / nowShare.value)}{" "}
                  people living in the U.S. is <Term id="foreign-born">foreign-born</Term>
                  {since ? <> — the highest share since {since.x}.</> : <> — the highest share on record.</>} Below is
                  how they, and everyone else who comes, moves through the system.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Foreign-born share of U.S. residents, {nowShare.x}.{" "}
                  <Link
                    href={SOURCES.historical.href ?? "/datasets"}
                    className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900 dark:decoration-slate-600 dark:hover:text-white"
                  >
                    Census Bureau, American Community Survey
                  </Link>
                </p>
              </div>
            </div>
          )}
        </IssueHeader>

        <ImmigrationSystemExplorer stats={stats} headlines={headlines} faq={faq} />

        {crime && <CrimeCitizenshipSection d={crime} />}
        <ImmigrationLawGuide />
      </div>
    </ImmigrationExplorerProvider>
  );
}
