import type { Metadata } from "next";
import Link from "next/link";
import { ChartCard } from "@/components/charts/chart-card";
import { RankedBars, type RankedItem } from "@/components/charts/ranked-bars";
import { TimeSeriesChart, type Series } from "@/components/charts/time-series-chart";
import { EmptyState } from "@/components/empty-state";
import { Coverage, MONEY_SOURCES, MoneyHeader, MoneySection, pct, usd, withCycle } from "@/components/money/money-ui";
import { Term } from "@/components/money/term";
import { formatPeriod, formatValue, periodToX } from "@/lib/format";
import { listMoneyCycles, loadContributionSummary, resolveCycle } from "@/lib/db/moneyOverview";
import { MONEY_COLORS, donorTypeGroup, partyColor } from "@/lib/money/semantic";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Donors | Money & Influence | Worldview",
  description: "Which committees give to federal candidates, by donor type and industry, from FEC filings.",
};

const table = (items: RankedItem[], label: string, extra = "Gifts") => ({
  columns: [label, "Amount", extra],
  rows: items.map((i) => [i.label, formatValue(i.value, "usd"), i.note ?? ""]),
});

export default async function DonorsPage({ searchParams }: PageProps<"/money/donors">) {
  const sp = await searchParams;
  const cycles = await listMoneyCycles();
  const cycle = resolveCycle(sp.cycle, cycles);
  const latest = cycles[0] ?? null;
  const d = await loadContributionSummary(cycle);
  const gifts = (n: number) => `${n.toLocaleString()} gift${n === 1 ? "" : "s"}`;

  const monthly: Series[] = [
    {
      id: "contributions",
      label: "Contributions",
      slot: 1,
      color: MONEY_COLORS.neutral,
      points: d.byMonth.map((m) => ({ x: periodToX(m.month), label: formatPeriod(m.month), value: m.total })),
    },
  ];
  const recipients: RankedItem[] = d.topRecipients.map((r) => ({ label: r.name, value: r.total, note: gifts(r.count), color: partyColor(d.partyByEntity[r.id]) }));
  const donors: RankedItem[] = d.topDonors.map((r) => ({ label: r.name, value: r.total, note: gifts(r.count), color: MONEY_COLORS.pac }));

  // FEC entity types folded into plain-language groups; the FEC category
  // stays in each bar's note.
  const typeGroups = new Map<string, RankedItem & { fec: string[]; count: number }>();
  for (const t of d.donorTypes) {
    const g = donorTypeGroup(t.type);
    const cur = typeGroups.get(g.key) ?? { label: g.label, value: 0, count: 0, color: g.color, fec: [] };
    cur.value += t.total;
    cur.count += t.count;
    if (!cur.fec.includes(g.fec)) cur.fec.push(g.fec);
    typeGroups.set(g.key, cur);
  }
  const types: RankedItem[] = [...typeGroups.values()]
    .sort((a, b) => b.value - a.value)
    .map((g) => ({ label: g.label, value: g.value, color: g.color, note: `${gifts(g.count)} · FEC: ${g.fec.join("; ")}` }));

  const industries: RankedItem[] = d.industries.map((i) => ({ label: i.label, value: i.total, note: gifts(i.count), color: MONEY_COLORS.neutral }));
  const classified = d.industries.reduce((s, i) => s + i.total, 0);
  const all = classified + d.unclassified.total;
  const range = d.byMonth.length ? `${formatPeriod(d.byMonth[0].month)} – ${formatPeriod(d.byMonth.at(-1)!.month)}` : "";

  return (
    <div className="mx-auto max-w-7xl space-y-14 pb-16">
      <MoneyHeader
        title="Donors"
        features={[
          <>
            Gifts from <Term k="pac">PACs</Term>, <Term k="partyCommittee">parties</Term> and{" "}
            <Term k="candidateCommittee">campaigns</Term>
          </>,
          "Matched to the candidates they fund",
          "As reported to the FEC",
        ]
        }
        cycle={cycle}
        cycles={cycles}
        basePath="/money/donors"
      />

      {d.totals.count === 0 ? (
        <EmptyState message="No contributions recorded for this cycle yet. Add records in" cta={{ href: "/data/contributions", label: "Manage Data" }} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Coverage label="Records">
              {d.totals.count.toLocaleString()} contributions · {usd(d.totals.amount)}
              {range ? ` · ${range}` : ""}
            </Coverage>
            <Coverage label="Donors">
              {d.totals.donors.toLocaleString()} committees giving to {d.totals.recipients.toLocaleString()} recipients
            </Coverage>
            <span className="ml-auto flex gap-4 text-sm font-medium">
              <Link href="/money/industries" className="text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
                Industry explorer →
              </Link>
              <Link href="/money/map" className="text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
                Donor map by state →
              </Link>
            </span>
          </div>

          <MoneySection title="Giving over time" intro="Itemized contributions by the month they were made.">
            <ChartCard
              title="Contributions by month"
              subtitle={range}
              source={MONEY_SOURCES.fec}
              table={{ columns: ["Month", "Amount", "Gifts"], rows: [...d.byMonth].reverse().map((m) => [formatPeriod(m.month), formatValue(m.total, "usd"), m.count]) }}
            >
              <TimeSeriesChart series={monthly} type="column" unit="usd" height={240} />
            </ChartCard>
          </MoneySection>

          <MoneySection
            title="Who gives, and who receives"
            intro="Recipients are coloured by party; donor bars are committees."
            action={{ href: withCycle("/money/contributions", cycle, latest), label: "Search every contribution" }}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Top donor committees" subtitle="By total given" source={MONEY_SOURCES.fec} table={table(donors, "Donor")}>
                <RankedBars items={donors} unit="usd" limit={12} />
              </ChartCard>
              <ChartCard title="Top recipients" subtitle="By total received from committees" source={MONEY_SOURCES.fec} table={table(recipients, "Recipient")}>
                <RankedBars items={recipients} unit="usd" limit={12} />
              </ChartCard>
            </div>
          </MoneySection>

          <MoneySection
            title="Kinds of donors"
            intro="Each gift grouped by the contributor type on the filing. Hover a bar for the exact FEC category."
          >
            <ChartCard title="Giving by donor type" subtitle="Share of all recorded contributions" source={MONEY_SOURCES.fec} table={{ columns: ["Donor type", "Amount", "Share", "Detail"], rows: types.map((t) => [t.label, formatValue(t.value, "usd"), pct(t.value, d.totals.amount), t.note ?? ""]) }}>
              <RankedBars items={types} unit="usd" />
            </ChartCard>
          </MoneySection>

          <MoneySection
            title="Industries"
            intro="Industry is assigned from the donor committee's name, so a gift is only classified when that name identifies a sector."
            action={{ href: "/money/industries", label: "Industry explorer" }}
            aside={
              <Coverage label="Classified">
                {pct(classified, all)} of dollars ({usd(classified)} of {usd(all)})
              </Coverage>
            }
          >
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900" title={`${pct(classified, all)} of contribution dollars have an industry`}>
              <div className="h-2 rounded-full" style={{ width: `${all > 0 ? (classified / all) * 100 : 0}%`, background: MONEY_COLORS.neutral }} />
            </div>
            <ChartCard
              title="Giving by donor industry"
              subtitle={`Classified gifts only · ${usd(d.unclassified.total)} across ${gifts(d.unclassified.count)} has no industry`}
              source={MONEY_SOURCES.fec}
              table={table(industries, "Industry")}
            >
              <RankedBars items={industries} unit="usd" limit={12} />
            </ChartCard>
          </MoneySection>
        </>
      )}
    </div>
  );
}
