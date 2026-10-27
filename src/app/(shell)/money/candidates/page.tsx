import type { Metadata } from "next";
import Link from "next/link";
import { ChartCard } from "@/components/charts/chart-card";
import { RankedBars, type RankedItem } from "@/components/charts/ranked-bars";
import { SortableTable } from "@/components/data/sortable-table";
import { EmptyState } from "@/components/empty-state";
import {
  Coverage,
  MONEY_SOURCES,
  MixBar,
  MoneyHeader,
  MoneySection,
  RaceCard,
  candidateTag,
  pct,
  shortDate,
  usd,
  withCycle,
} from "@/components/money/money-ui";
import { Term } from "@/components/money/term";
import { formatValue } from "@/lib/format";
import { listMoneyCycles, loadCampaignMoney, resolveCycle, type CampaignCandidate } from "@/lib/db/moneyOverview";
import { partyColor, partyLetter } from "@/lib/money/semantic";
import { publicEntityPath } from "@/lib/people/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Candidates & races | Money & Influence | Worldview",
  description: "Campaign fundraising by race and candidate, from FEC committee filings.",
};

const FIRST_RACES = 9;

export default async function CandidatesPage({ searchParams }: PageProps<"/money/candidates">) {
  const sp = await searchParams;
  const cycles = await listMoneyCycles();
  const cycle = resolveCycle(sp.cycle, cycles);
  const latest = cycles[0] ?? null;
  const campaign = await loadCampaignMoney(cycle);
  const cand = campaign.candidates;

  const totals = cand.reduce(
    (s, c) => ({ receipts: s.receipts + c.receipts, individual: s.individual + c.individual, pac: s.pac + c.pac, party_: s.party_ + c.party_ }),
    { receipts: 0, individual: 0, pac: 0, party_: 0 },
  );
  const bar = (c: CampaignCandidate, value: number): RankedItem & { color: string } => ({
    label: `${c.name} (${candidateTag(c)})`,
    value,
    color: partyColor(c.party),
  });
  const fundraisers = cand.slice(0, 15).map((c) => ({ ...bar(c, c.receipts), note: `${pct(c.individual, c.receipts)} from individuals` }));
  const cash = [...cand].sort((a, b) => b.cashOnHand - a.cashOnHand).slice(0, 15).map((c) => bar(c, c.cashOnHand));
  const senate = cand.filter((c) => c.office === "S").length;
  const house = cand.filter((c) => c.office === "H").length;
  const contested = campaign.races.filter((r) => r.candidates.length > 0);

  return (
    <div className="mx-auto max-w-7xl space-y-14 pb-16">
      <MoneyHeader
        title="Candidates & races"
        features={[
          <>
            Money <Term k="receipts">raised</Term> and <Term k="disbursements">spent</Term>
          </>,
          <Term key="cash" k="cashOnHand">Cash on hand</Term>,
          "Compared race by race",
          "From the campaigns' own FEC reports",
        ]
        }
        cycle={cycle}
        cycles={cycles}
        basePath="/money/candidates"
      />

      {cand.length === 0 ? (
        <EmptyState message="No candidate filings for this cycle yet. Add records in" cta={{ href: "/data/contributions", label: "Manage Data" }} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Coverage label="Coverage">
              {cand.length} tracked candidates · {[senate ? `${senate} Senate` : "", house ? `${house} House` : ""].filter(Boolean).join(", ")} ·{" "}
              {contested.length} races
            </Coverage>
            {campaign.asOf ? <Coverage label="Latest report">{shortDate(campaign.asOf)}</Coverage> : null}
            <Coverage label="Raised by tracked candidates">{usd(totals.receipts)}</Coverage>
          </div>

          <MoneySection
            id="races"
            title="Races by money"
            intro="Campaign receipts plus outside spending in each race. The badge shows the fundraising lead between the top Democrat and Republican."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {contested.slice(0, FIRST_RACES).map((race) => (
                <RaceCard key={race.key} race={race} cycle={cycle} latest={latest} />
              ))}
            </div>
            {contested.length > FIRST_RACES ? (
              <details className="group">
                <summary className="cursor-pointer list-none text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
                  <span className="group-open:hidden">Show {contested.length - FIRST_RACES} more races ↓</span>
                  <span className="hidden group-open:inline">Show fewer races ↑</span>
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {contested.slice(FIRST_RACES).map((race) => (
                    <RaceCard key={race.key} race={race} cycle={cycle} latest={latest} />
                  ))}
                </div>
              </details>
            ) : null}
          </MoneySection>

          <MoneySection id="fundraisers" title="Top campaigns" intro="Bars are coloured by party.">
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Most raised"
                subtitle="Total receipts this cycle"
                source={MONEY_SOURCES.fec}
                table={{ columns: ["Candidate", "Raised", "Individuals"], rows: fundraisers.map((f) => [f.label, formatValue(f.value, "usd"), f.note ?? ""]) }}
              >
                <RankedBars items={fundraisers} unit="usd" limit={15} />
              </ChartCard>
              <ChartCard
                title="Most cash on hand"
                subtitle="As of each campaign's latest report"
                source={MONEY_SOURCES.fec}
                table={{ columns: ["Candidate", "Cash on hand"], rows: cash.map((f) => [f.label, formatValue(f.value, "usd")]) }}
              >
                <RankedBars items={cash} unit="usd" limit={15} />
              </ChartCard>
            </div>
          </MoneySection>

          <MoneySection
            title="Where campaign money comes from"
            intro={
              <>
                All {cand.length} tracked campaigns combined. <Term k="transfer">Transfers</Term> from{" "}
                <Term k="jfc">joint fundraising committees</Term>, candidate loans, and refunds make up &ldquo;other&rdquo;.
              </>
            }
          >
            <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <span className="text-2xl font-semibold text-slate-950 tabular-nums dark:text-white">{usd(totals.receipts)}</span> total receipts
              </p>
              <div className="mt-4">
                <MixBar c={totals} height="h-4" />
              </div>
            </div>
          </MoneySection>

          <MoneySection title="Every tracked campaign" intro="Sortable; click a column header to re-sort.">
            <details className="group rounded-2xl border border-slate-200 dark:border-slate-800">
              <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span className="group-open:hidden">View all {cand.length} candidates ↓</span>
                <span className="hidden group-open:inline">Hide table ↑</span>
              </summary>
              <div className="border-t border-slate-200 p-5 dark:border-slate-800">
                <CandidateTable rows={cand} races={new Map(campaign.races.map((r) => [r.key, r]))} cycle={cycle} latest={latest} />
              </div>
            </details>
          </MoneySection>
        </>
      )}
    </div>
  );
}

function CandidateTable({
  rows,
  races,
  cycle,
  latest,
}: {
  rows: CampaignCandidate[];
  races: Map<string, { label: string; electionId: string | null }>;
  cycle: number | null;
  latest: number | null;
}) {
  const status: Record<string, string> = { I: "Incumbent", C: "Challenger", O: "Open seat" };
  const num = "px-3 py-1.5 tabular-nums";
  const muted = `${num} text-slate-500 dark:text-slate-400`;
  return (
    <div className="max-h-[32rem] overflow-auto rounded-lg border border-slate-100 dark:border-slate-800">
      <SortableTable
        className="w-full min-w-[820px] text-sm"
        theadClassName="sticky top-0 bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400"
        rowClassName="hover:bg-slate-50 dark:hover:bg-slate-900/60"
        columns={[
          { label: "Candidate" },
          { label: "Race" },
          { label: "Raised", align: "right" },
          { label: "Spent", align: "right" },
          { label: "Cash on hand", align: "right" },
          { label: "Individuals", align: "right" },
          { label: "PACs", align: "right" },
          { label: "" },
        ]}
        rows={rows.map((r) => {
          const race = races.get(r.raceKey);
          const share = (part: number) => (r.receipts > 0 ? part / r.receipts : null);
          return {
            key: r.entityId,
            cells: [
              {
                content: (
                  <>
                    <Link href={publicEntityPath({ id: r.entityId, name: r.name })} className="font-medium text-slate-800 hover:underline dark:text-slate-200">
                      {r.name}
                    </Link>
                    <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: partyColor(r.party) }} />
                      {partyLetter(r.party)}
                    </span>
                  </>
                ),
                sort: r.name.toLowerCase(),
                className: "px-3 py-1.5",
              },
              {
                content: (
                  <>
                    {race?.electionId ? (
                      <Link href={`/elections/${race.electionId}`} className="hover:underline">
                        {race.label}
                      </Link>
                    ) : (
                      (race?.label ?? r.state)
                    )}
                    {status[r.incumbentChallenge] ? <span className="text-slate-400"> · {status[r.incumbentChallenge]}</span> : null}
                  </>
                ),
                sort: (race?.label ?? r.state).toLowerCase(),
                className: "px-3 py-1.5 whitespace-nowrap text-slate-500 dark:text-slate-400",
              },
              { content: formatValue(r.receipts, "usd"), sort: r.receipts, className: num },
              { content: formatValue(r.disbursements, "usd"), sort: r.disbursements, className: muted },
              { content: formatValue(r.cashOnHand, "usd"), sort: r.cashOnHand, className: num },
              { content: pct(r.individual, r.receipts), sort: share(r.individual), className: muted },
              { content: pct(r.pac, r.receipts), sort: share(r.pac), className: muted },
              {
                content: (
                  <Link href={withCycle(`/money?candidate=${r.entityId}#follow`, cycle, latest)} className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    Donors →
                  </Link>
                ),
                className: "px-3 py-1.5 whitespace-nowrap",
              },
            ],
          };
        })}
      />
    </div>
  );
}
