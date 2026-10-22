import type { Metadata } from "next";
import { ChartCard } from "@/components/charts/chart-card";
import { RankedBars, type RankedItem } from "@/components/charts/ranked-bars";
import { EmptyState } from "@/components/empty-state";
import { Coverage, MONEY_SOURCES, MoneyHeader, MoneySection, Snapshot, SupportOpposeBars, candidateTag, shortDate, usd } from "@/components/money/money-ui";
import { Term } from "@/components/money/term";
import { formatValue } from "@/lib/format";
import { listMoneyCycles, loadCampaignMoney, resolveCycle } from "@/lib/db/moneyOverview";
import { MONEY_COLORS } from "@/lib/money/semantic";
import { publicEntityPath } from "@/lib/people/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Outside spending | Money & Influence | Worldview",
  description: "Independent expenditures supporting and opposing federal candidates, by race, candidate, and group, from FEC Schedule E.",
};

export default async function OutsideSpendingPage({ searchParams }: PageProps<"/money/outside-spending">) {
  const sp = await searchParams;
  const cycles = await listMoneyCycles();
  const cycle = resolveCycle(sp.cycle, cycles);
  const { outside, races } = await loadCampaignMoney(cycle);
  const total = outside.support + outside.oppose;

  const targetedRaces = races.filter((r) => r.support + r.oppose > 0).sort((a, b) => b.support + b.oppose - (a.support + a.oppose));
  const spenders: RankedItem[] = outside.spenders.map((s) => ({
    label: s.label,
    value: s.total,
    note: `${s.count} filing${s.count === 1 ? "" : "s"}`,
    color: MONEY_COLORS.neutral,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-14 pb-16">
      <MoneyHeader
        title="Outside spending"
        features={[
          "Spent without coordinating with campaigns",
          "Ads, mail and canvassing",
          <>
            By <Term k="superPac">super PACs</Term>, parties and other groups
          </>,
          <>
            Reported as <Term k="independentExpenditure">independent expenditures</Term>
          </>,
        ]
        }
        cycle={cycle}
        cycles={cycles}
        basePath="/money/outside-spending"
      />

      {total === 0 ? (
        <EmptyState message="No independent expenditures recorded for this cycle yet. Add records in" cta={{ href: "/data/contributions", label: "Manage Data" }} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Coverage label="Records">
              {outside.filings.toLocaleString()} Schedule E filings from {outside.groups} groups
            </Coverage>
            {outside.lastDate ? <Coverage label="Latest expenditure">{shortDate(outside.lastDate)}</Coverage> : null}
          </div>

          <MoneySection title="Most-targeted races" intro="Every dollar spent for or against any candidate in the race. Opposition grows left, support right.">
            <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
              <SupportOpposeBars
                limit={15}
                rows={targetedRaces.map((r) => ({
                  key: r.key,
                  label: r.label,
                  support: r.support,
                  oppose: r.oppose,
                  href: r.electionId ? `/elections/${r.electionId}` : undefined,
                }))}
              />
            </div>
          </MoneySection>

          <Snapshot
            items={[
              { label: "Total outside spending", value: usd(total), detail: `Across ${targetedRaces.length} races and ${outside.targets.length} candidates.` },
              { label: "Supporting candidates", value: usd(outside.support), detail: "Spent to help a named candidate win.", color: MONEY_COLORS.support },
              { label: "Opposing candidates", value: usd(outside.oppose), detail: "Spent to defeat a named candidate.", color: MONEY_COLORS.oppose },
              { label: "Groups spending", value: outside.groups.toLocaleString(), detail: "Committees that filed at least one independent expenditure." },
            ]}
          />

          <div className="grid gap-12 lg:grid-cols-2">
            <MoneySection title="By candidate" intro="Who outside groups are spending for and against.">
              <SupportOpposeBars
                limit={15}
                rows={outside.targets.map((t, i) => ({
                  // FEC files some candidates under two name spellings, so names repeat.
                  key: `${i}-${t.name}`,
                  label: t.name,
                  sub: candidateTag(t),
                  support: t.support,
                  oppose: t.oppose,
                  href: t.entityId ? publicEntityPath({ id: t.entityId, name: t.name }) : undefined,
                }))}
              />
            </MoneySection>
            <MoneySection title="Top outside groups" intro="Committees by total independent expenditures this cycle.">
              <ChartCard
                title="Biggest spenders"
                source={MONEY_SOURCES.ie}
                table={{ columns: ["Committee", "Amount", "Filings"], rows: spenders.map((s) => [s.label, formatValue(s.value, "usd"), s.note ?? ""]) }}
              >
                <RankedBars items={spenders} unit="usd" limit={12} />
              </ChartCard>
            </MoneySection>
          </div>
        </>
      )}
    </div>
  );
}
