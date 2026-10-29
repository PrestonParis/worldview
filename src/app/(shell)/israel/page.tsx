import type { Metadata } from "next";
import Link from "next/link";
import { ChartCard } from "@/components/charts/chart-card";
import { citeSources, type SourceSpec } from "@/components/charts/citation";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart, type SeriesSlot } from "@/components/charts/time-series-chart";
import { IssueEmpty, IssueHeader, Prose, Section } from "@/components/data/issue-layout";
import { SectionNav } from "@/components/data/section-nav";
import { Disclosure } from "@/components/ui/disclosure";
import { AidChart } from "@/components/israel/aid-chart";
import { ArmsTracker } from "@/components/israel/arms-tracker";
import { MemberVotes } from "@/components/israel/member-votes";
import { RelationshipMap, type LaneYear } from "@/components/israel/relationship-map";
import { Timeline } from "@/components/israel/timeline";
import { UnVotes } from "@/components/israel/un-votes";
import { formatValue } from "@/lib/format";
import { inOffice, loadIsrael, type IsraelData } from "@/lib/israel/data";
import {
  ARMS_FACTS,
  ARMS_SALES,
  EMERGENCY_LAWS,
  FOLLOW_THE_MONEY,
  KEY_VOTES,
  MOUS,
  TIMELINE,
  undocUrl,
  VETOES,
} from "@/lib/israel/records";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "U.S.–Israel Relations | Worldview",
  description:
    "What the United States provides Israel, what it receives, who shapes the relationship, and how it has changed: aid since 1949, arms sales, pro-Israel PAC spending and lobbying, congressional votes, UN votes and vetoes, trade, and a timeline.",
};

const SECTIONS = [
  ["money", "Aid"],
  ["arms", "Arms"],
  ["influence", "Influence"],
  ["congress", "Congress"],
  ["diplomacy", "Diplomacy"],
  ["trade", "Trade"],
  ["timeline", "Timeline"],
] as const;

const SOURCE_SPECS = {
  aid: { label: "CRS, U.S. Foreign Aid to Israel", href: "/datasets/crs-israel-aid" },
  trade: { label: "Census Bureau trade in goods", href: "/datasets/census-trade" },
} satisfies Record<string, SourceSpec>;

// un-votes is keyed by resolution symbol, so its coverage span isn't a date range.
const UN_SOURCE = {
  href: "/datasets/un-votes",
  label: (
    <>
      United Nations Dag Hammarskjöld Library. <cite>UN Digital Library, Voting Data</cite>.
    </>
  ),
};

const usd = (v: number | null) => formatValue(v, "usd", { compact: true });
const billions = (v: number) => `$${(v / 1e9).toFixed(1)} billion`;

// What the relationship map shows for each year, 1985 (trade data) onward.
function laneYears(d: IsraelData): Record<number, LaneYear> {
  const aidAt = (fy: number) => {
    const pick = (id: string) => d.aid.nominal.find((s) => s.id === id)?.points.find((p) => p.x === fy)?.value ?? 0;
    const military = pick("military");
    const missileDefense = pick("missile_defense");
    const economic = pick("economic");
    return military + missileDefense + economic ? { total: military + missileDefense + economic, military, missileDefense, economic } : null;
  };
  const tradeAt = (y: number) => {
    const exp = d.trade.series[0].points.find((p) => p.x === y)?.value;
    const imp = d.trade.series[1].points.find((p) => p.x === y)?.value;
    return exp !== undefined && imp !== undefined ? { exports: exp, imports: imp } : null;
  };
  const unAt = (y: number) => {
    const ga = d.un.votes.filter((v) => v.body === "General Assembly" && v.date.startsWith(String(y)) && v.us !== null && v.israel !== null);
    return ga.length ? { votes: ga.length, same: ga.filter((v) => v.us === v.israel).length } : null;
  };
  const moneyAt = (y: number) => {
    const cycle = y % 2 ? y + 1 : y;
    const rows = d.influence.groups.flatMap((g) => g.byCycle.filter((c) => c.cycle === cycle));
    if (!rows.length) return null;
    return { cycle, contributions: rows.reduce((s, r) => s + r.contributions, 0), outside: rows.reduce((s, r) => s + r.support + r.oppose, 0) };
  };
  const out: Record<number, LaneYear> = {};
  const last = Math.max(d.aid.lastFy, new Date().getFullYear());
  for (let y = 1985; y <= last; y++) {
    const arms = ARMS_SALES.filter((a) => a.notified.startsWith(String(y)));
    out[y] = {
      aid: aidAt(y),
      trade: tradeAt(y),
      arms: { count: arms.length, value: arms.reduce((s, a) => s + a.value, 0) },
      votes: KEY_VOTES.filter((v) => v.date.startsWith(String(y))).map((v) => ({ measure: v.measure, kind: v.kind, result: v.result })),
      money: moneyAt(y),
      un: unAt(y),
      vetoes: VETOES.filter((v) => v.date.startsWith(String(y))).length,
      events: TIMELINE.filter((e) => e.date.startsWith(String(y))).map((e) => ({ title: e.title, lane: e.lane })),
      president: inOffice(y),
    };
  }
  return out;
}

function PersonList({ title, rows, field, note }: { title: string; rows: IsraelData["influence"]["topOpposed"]; field: "oppose" | "support" | "contributions"; note: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
      <h3 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{note}</p>
      <ol className="mt-3 space-y-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.key} className="flex items-baseline gap-2">
            <span className="min-w-0 truncate">
              {r.href ? (
                <Link href={r.href} className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white">
                  {r.name}
                </Link>
              ) : (
                <span className="font-medium text-slate-900 dark:text-white">{r.name}</span>
              )}{" "}
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {[r.party.slice(0, 1), r.state].filter(Boolean).join(" · ")} · {r.groups[field].join(", ")}
              </span>
            </span>
            <span className="ml-auto shrink-0 tabular-nums font-medium text-slate-900 dark:text-white">{usd(r[field])}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function IsraelPage() {
  const d = await loadIsrael();
  if (!d) return <IssueEmpty title="U.S.–Israel Relations" />;
  const SOURCES = citeSources(SOURCE_SPECS, d.datasets);
  const years = laneYears(d);
  const initialYear = Math.max(...Object.keys(years).map(Number).filter((y) => years[y].aid));
  const cycles = d.influence.cycles;
  const lobbying = d.influence.lobbying;
  const lobbyingYears = [...new Set(lobbying.flatMap((g) => g.years.map((l) => l.year)))].sort();

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <IssueHeader title="U.S.–Israel Relations">
        <p className="mt-3 text-lg leading-7 text-slate-600 dark:text-slate-300">
          What the United States provides Israel, what it receives, who shapes the relationship, and how it has changed since 1948.
        </p>
      </IssueHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="U.S. aid since 1949" unit="usd" value={d.aid.totalReal} period={`FY${d.aid.baseFy} dollars`} note={`${billions(d.aid.totalNominal)} in current dollars`} />
        <StatTile label="Aid this year" unit="usd" value={d.aid.latest.total} period={`FY${d.aid.lastFy}`} note="Military aid plus missile defense" spark={d.aid.spark} />
        <StatTile label="Arms sales notified since 2020" unit="usd" value={ARMS_SALES.reduce((s, a) => s + a.value, 0)} note={`${ARMS_SALES.length} sales; estimates, not payments`} />
        <StatTile label="Goods trade" unit="usd" value={(d.trade.latest.exports ?? 0) + (d.trade.latest.imports ?? 0)} period={d.trade.latestYear ?? undefined} note="Exports plus imports" />
      </div>

      <RelationshipMap years={years} initial={initialYear} />

      <SectionNav sections={SECTIONS} />

      {/* --------------------------------------------------------------- Aid */}
      <Section id="money" title="Financial assistance" question="How much do Americans spend supporting Israel, how is it authorized, and where does it go?">
        <AidChart nominal={d.aid.nominal} real={d.aid.real} baseFy={d.aid.baseFy} source={SOURCES.aid} />
        <Prose>
          <p>
            Almost all aid is now military: Foreign Military Financing grants that Israel spends on U.S. weapons, plus Defense Department
            money for missile defense developed with Israel. Economic aid ended in FY2008. FY2024 reached {billions(d.aid.fy2024)} with the
            Gaza war supplemental, the most in any year in current dollars. Adjusted for
            inflation, FY1974 and FY1979 were larger.
          </p>
        </Prose>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Aid by president"
            subtitle={`Fiscal years whose budgets each president signed · FY${d.aid.baseFy} dollars`}
            source={SOURCES.aid}
            table={{
              columns: ["President", "Fiscal years", `Total (FY${d.aid.baseFy} $)`, "Per year", "Current $"],
              rows: d.aid.byPresident.map((p) => [p.name, `FY${p.from}–FY${p.lastFy}`, usd(p.real), usd(p.perYearReal), usd(p.nominal)]),
            }}
          >
            <RankedBars
              items={d.aid.byPresident.map((p) => ({
                label: `${p.name} (${p.from}–${p.lastFy})`,
                value: p.perYearReal,
                note: `${usd(p.real)} over ${p.years} yr`,
                color: p.party === "D" ? "var(--viz-dem)" : "var(--viz-rep)",
              }))}
              unit="usd"
              limit={d.aid.byPresident.length}
            />
          </ChartCard>
          <ChartCard title="Missile defense by program" subtitle="Defense Department funding, FY2006 onward, current dollars" source={SOURCES.aid} table={rankedTable(d.aid.missileDefense, "Program", "usd")}>
            <RankedBars items={d.aid.missileDefense} unit="usd" slot={2} limit={d.aid.missileDefense.length} />
          </ChartCard>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Follow the money: FY2024</h3>
          {FOLLOW_THE_MONEY.map((f) => (
            <ol key={f.program} className="grid gap-2 text-sm sm:grid-cols-5">
              {[
                ["Congress", f.law],
                ["Agency", f.agency],
                ["Program", `${f.program} · ${usd(f.amount)}`],
                ["Recipient", f.recipient],
                ["Outcome", f.outcome],
              ].map(([step, text], i) => (
                <li key={step} className="relative rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {i + 1}. {step}
                  </p>
                  <p className="mt-1 text-slate-800 dark:text-slate-100">{text}</p>
                </li>
              ))}
            </ol>
          ))}
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Disclosure summary={`Ten-year aid agreements (${MOUS.length})`}>
            <p className="text-sm text-slate-500 dark:text-slate-400">Memoranda of understanding set the regular level; Congress still appropriates each year.</p>
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {MOUS.map((m) => (
                <li key={m.name} className="py-2.5">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {m.name} · {m.years}
                    </span>
                    <span className="tabular-nums font-semibold text-slate-950 dark:text-white">{usd(m.total)}</span>
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Signed {m.signed} under {m.president}. {m.terms}
                  </p>
                </li>
              ))}
            </ul>
          </Disclosure>
          <Disclosure summary={`Emergency appropriations (${EMERGENCY_LAWS.length})`}>
            <p className="text-sm text-slate-500 dark:text-slate-400">Money and guarantees above the regular annual level.</p>
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {EMERGENCY_LAWS.map((l) => (
                <li key={l.law} className="py-2.5">
                  <p className="font-medium text-slate-900 dark:text-white">
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">{l.date.slice(0, 4)}</span> · {l.law}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">{l.action}</p>
                </li>
              ))}
            </ul>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Three things are counted separately here. An appropriation is money Congress makes available; it may be spent over several
              years. A notified arms sale is a possible purchase that Israel may pay for with U.S. aid, its own money, or both. Loan
              guarantees, such as the $9 billion in 2003, back commercial loans and are not in the totals because no U.S. money changed
              hands.
            </p>
          </Disclosure>
        </div>
      </Section>

      {/* -------------------------------------------------------------- Arms */}
      <Section id="arms" title="Military cooperation and weapons transfers" question="What weapons does the U.S. send Israel, who makes them, and who pays?">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ARMS_FACTS.map((f) => (
            <StatTile key={f.label} label={f.label} unit="usd" value={f.value} period={f.period} note={f.note} />
          ))}
        </div>
        <ArmsTracker sales={ARMS_SALES} />
        <Prose>
          <p>
            Cooperation runs both ways. Israel co-develops the Arrow and David&apos;s Sling interceptors with Boeing and RTX, Israeli firms
            build F-35 wing sets and helmets, and the U.S. Marine Corps buys Iron Dome interceptors for its own air defense. The U.S. keeps
            a war-reserve stockpile in Israel (additions capped at $500 million a year) and has operated an X-band missile-defense radar there since
            2008.
          </p>
        </Prose>
      </Section>

      {/* --------------------------------------------------------- Influence */}
      <Section id="influence" title="Domestic political influence" question="Which groups spend money on U.S. policy toward Israel, and on whom?">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">Groups and their FEC spending</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Election cycles {cycles[0]}–{cycles.at(-1)}, from FEC filings. Contributions go to campaigns; independent expenditures are
            ads and mail a group runs itself. Contributions are each PAC&apos;s own; donations it forwards from individuals (earmarked
            conduit money, AIPAC&apos;s largest channel) are not loaded yet.
          </p>
          <table className="mt-3 w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-3 font-medium">Group</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 text-right font-medium">To candidates</th>
                <th className="py-2 pr-3 text-right font-medium">Spent for</th>
                <th className="py-2 pr-3 text-right font-medium">Spent against</th>
              </tr>
            </thead>
            <tbody>
              {d.influence.groups.map((g) => (
                <tr key={g.short} className="border-t border-slate-100 align-top dark:border-slate-800">
                  <td className="py-2 pr-3">
                    <span className="font-medium text-slate-900 dark:text-white">{g.name}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{g.stance}</span>
                  </td>
                  <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{g.kind}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{g.contributions ? usd(g.contributions) : "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{g.support ? usd(g.support) : "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{g.oppose ? usd(g.oppose) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <PersonList title="Most spent against" rows={d.influence.topOpposed} field="oppose" note="Independent expenditures opposing the candidate" />
          <PersonList title="Most spent for" rows={d.influence.topSupported} field="support" note="Independent expenditures supporting the candidate" />
          <PersonList title="Largest direct contributions" rows={d.influence.topContributions} field="contributions" note="PAC contributions to the campaign" />
        </div>
        {lobbyingYears.length > 0 && (
          <ChartCard
            title="Lobbying reported under the Lobbying Disclosure Act"
            subtitle="Spending on federal lobbying across all issues a filing names"
            table={{
              columns: ["Year", ...lobbying.map((g) => g.label)],
              rows: lobbyingYears.map((y) => [String(y), ...lobbying.map((g) => usd(g.years.find((l) => l.year === y)?.total ?? null))]),
            }}
          >
            <TimeSeriesChart
              type="column"
              unit="usd"
              height={260}
              series={lobbying.map((g, i) => ({
                id: g.label,
                label: g.label,
                slot: (i + 1) as SeriesSlot,
                points: g.years.map((l) => ({ x: l.year, label: String(l.year), value: l.total })),
              }))}
            />
          </ChartCard>
        )}
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Every group, PAC and candidate has a dossier in{" "}
          <Link href="/subpoena?q=aipac" className="underline underline-offset-2">
            Subpoena
          </Link>
          .
        </p>
      </Section>

      {/* ---------------------------------------------------------- Congress */}
      <Section id="congress" title="Congress and executive decisions" question="How has Congress voted on aid, arms sales and Israel, and how did each member vote?">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">Key roll calls, grouped by what they would do</h3>
          <table className="mt-3 w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Measure</th>
                <th className="py-2 pr-3 font-medium">Kind</th>
                <th className="py-2 pr-3 text-right font-medium">Result</th>
                <th className="py-2 pr-3 text-right font-medium">Dem yes–no</th>
                <th className="py-2 pr-3 text-right font-medium">Rep yes–no</th>
              </tr>
            </thead>
            <tbody>
              {[...KEY_VOTES].reverse().map((v) => {
                const s = d.votes.partySplit[v.id];
                return (
                  <tr key={v.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300">{v.date}</td>
                    <td className="py-2 pr-3">
                      <a href={v.url} className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white">
                        {v.chamber === "Senate" ? "Senate" : "House"} · {v.measure}
                      </a>
                    </td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{v.kind}</td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                      {v.result} {v.yea}–{v.nay}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s ? `${s.D.yea + s.I.yea}–${s.D.nay + s.I.nay}` : "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s ? `${s.R.yea}–${s.R.nay}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Democratic counts include independents who caucus with Democrats.</p>
        </div>
        <MemberVotes members={d.votes.members} votes={KEY_VOTES} />
      </Section>

      {/* --------------------------------------------------------- Diplomacy */}
      <Section id="diplomacy" title="Diplomacy and the UN" question="Where do U.S. and Israeli positions line up at the UN, and where does the U.S. use its veto?">
        {d.un.world && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="General Assembly votes recorded" value={d.un.world.votes} period={`since ${d.un.world.since}`} note="On Israel, the Palestinians and the region" />
            <StatTile label="U.S. voted no" unit="percent" value={d.un.world.usNoShare} note="Share of those General Assembly votes" />
            <StatTile label="Gaza drafts vetoed by the U.S." value={VETOES.length} period="Oct 2023 – Sep 2025" />
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          {d.un.agreement[0]?.points.length > 0 && (
            <ChartCard title="How often the U.S. votes with Israel" subtitle="General Assembly votes on the region, by five-year period" source={UN_SOURCE} table={seriesTable(d.un.agreement, "percent")}>
              <TimeSeriesChart series={d.un.agreement} unit="percent" height={280} />
            </ChartCard>
          )}
          <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">U.S. Security Council vetoes since October 7</h3>
            <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {VETOES.map((v) => (
                <li key={v.draft} className="flex items-baseline gap-3 py-2">
                  <span className="w-24 shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{v.date}</span>
                  <span className="min-w-0">
                    <a href={undocUrl(v.draft)} className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white">
                      {v.draft}
                    </a>{" "}
                    <span className="text-slate-600 dark:text-slate-300">{v.subject}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {d.un.count > 0 && <UnVotes votes={d.un.votes} />}
      </Section>

      {/* ------------------------------------------------------------- Trade */}
      <Section id="trade" title="Trade and commercial ties" question="What do the two economies buy from each other?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Goods trade with Israel" subtitle="Calendar years since 1985, current dollars" source={SOURCES.trade} table={seriesTable(d.trade.series, "usd")}>
            <TimeSeriesChart series={d.trade.series} unit="usd" height={280} endLabels={false} markers={[{ x: 1985, label: "Free trade agreement" }]} />
          </ChartCard>
          <ChartCard title="U.S. trade balance with Israel" subtitle="Exports minus imports · negative is a U.S. deficit" source={SOURCES.trade} table={seriesTable(d.trade.balance, "usd")}>
            <TimeSeriesChart series={d.trade.balance} type="column" unit="usd" height={280} />
          </ChartCard>
        </div>
        <ChartCard
          title="Israel against other U.S. partners"
          subtitle={`Goods trade (exports plus imports), ${d.trade.latestYear}`}
          source={SOURCES.trade}
          table={{
            columns: ["Partner", "U.S. exports", "U.S. imports", "Total"],
            rows: d.trade.compare.map((c) => [c.name, usd(c.exports), usd(c.imports), usd(c.total)]),
          }}
        >
          <RankedBars
            items={d.trade.compare.filter((c) => c.total !== null).map((c) => ({ label: c.name, value: c.total!, note: `${usd(c.exports)} out · ${usd(c.imports)} in` }))}
            unit="usd"
            limit={6}
          />
        </ChartCard>
        <Prose>
          <p>
            The 1985 U.S.–Israel Free Trade Agreement was the first the United States signed. Trade data here covers goods only; Israel&apos;s
            large technology services exports are not included.
          </p>
        </Prose>
      </Section>

      {/* ---------------------------------------------------------- Timeline */}
      <Section id="timeline" title="Timeline" question="What happened, what each country did, and what changed afterward.">
        <Timeline events={TIMELINE} />
      </Section>
    </div>
  );
}
