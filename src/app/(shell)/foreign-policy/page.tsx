import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { IssueHeader, Prose, Section } from "@/components/data/issue-layout";
import { SectionNav } from "@/components/data/section-nav";
import { formatValue } from "@/lib/format";
import { loadForeignPolicy } from "@/lib/foreign-policy/data";

export const revalidate = 86_400;

export const metadata: Metadata = {
  title: "U.S. Foreign Policy | Worldview",
  description: "A measured view of U.S. foreign policy: military power, assistance, trade, diplomacy, legal authority, and country relationships.",
};

const SECTIONS = [
  ["commitments", "Commitments"],
  ["power", "Military power"],
  ["assistance", "Aid"],
  ["diplomacy", "Diplomacy"],
  ["economic", "Economic statecraft"],
  ["authority", "Authority"],
  ["countries", "Countries"],
] as const;

const OMB_SOURCE = { label: "Office of Management and Budget, Historical Tables", href: "/datasets/omb-historical-tables" };
const AID_SOURCE = { label: "ForeignAssistance.gov country summary", href: "/datasets/foreign-assistance" };
const TRADE_SOURCE = { label: "U.S. Census Bureau trade in goods", href: "/datasets/census-trade" };

const usd = (value: number | null) => formatValue(value, "usd", { compact: true });

function Framework({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
      <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
      <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{children}</div>
    </div>
  );
}

export default async function ForeignPolicyPage() {
  const d = await loadForeignPolicy();
  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <IssueHeader title="U.S. Foreign Policy">
        <p className="mt-3 text-lg leading-7 text-slate-600 dark:text-slate-300">
          What the United States commits to, spends, trades, negotiates, and authorizes abroad—without reducing every relationship to a single ally-or-adversary score.
        </p>
      </IssueHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="National defense outlays" value={d.headline.defense?.value ?? null} unit="usd" period={d.headline.defense?.period.replace(/^FY/, "FY ")} note={d.headline.defenseShare === null ? undefined : `${d.headline.defenseShare.toFixed(1)}% of federal outlays`} spark={d.defense[0].points.slice(-20).map((p) => p.value)} href="#power" />
        <StatTile label="Foreign assistance obligated" value={d.headline.aid?.value ?? null} unit="usd" period={d.headline.aid?.period.replace(/^FY/, "FY ")} note="Includes military, humanitarian, development, and other assistance" spark={d.assistance[0].points.slice(-20).map((p) => p.value)} href="#assistance" />
        <StatTile label="Recipient countries" value={d.headline.aidRecipients} period={d.periods.aid?.replace(/^FY/, "FY ")} note="Countries with positive obligations in the latest reported fiscal year" href="#countries" />
        <StatTile label="Trade partners covered" value={d.headline.tradePartners} period={d.periods.trade ?? undefined} note="Census goods trade; services are not included" href="#economic" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Link href="/atlas/foreign-policy" className="rounded-2xl border border-slate-200 p-5 transition hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Your principles</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">Map your foreign-policy worldview →</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Separate restraint, internationalism, security, trade, and humanitarian priorities before judging particular cases.</p>
        </Link>
        <Link href="/israel" className="rounded-2xl border border-slate-200 p-5 transition hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Deep dossier</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">U.S.–Israel relations →</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Aid, arms notifications, lobbying, congressional and UN votes, trade, and the relationship over time.</p>
        </Link>
        <div className="rounded-2xl bg-slate-950 p-5 text-white dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">How to read this page</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">Commitments, capabilities, money, diplomacy, economics, and legal authority are different dimensions. Agreement on one does not imply alignment on the others.</p>
        </div>
      </div>

      <SectionNav sections={SECTIONS} />

      <Section id="commitments" title="Commitments" question="What has the United States promised, to whom, and under what conditions?">
        <div className="grid gap-4 md:grid-cols-3">
          <Framework title="Treaty commitments"><p>Ratified treaties can create binding international obligations. Their actual operation still depends on treaty language, domestic law, appropriations, and political decisions.</p></Framework>
          <Framework title="Security partnerships"><p>Defense cooperation can include basing, exercises, intelligence, arms transfers, or political assurances without carrying the same legal promise as a mutual-defense treaty.</p></Framework>
          <Framework title="Policy commitments"><p>Strategies, communiqués, and presidential statements matter diplomatically, but they are not interchangeable with statutes or Senate-ratified treaties.</p></Framework>
        </div>
        <Prose><p>This first release establishes the distinction. A later commitments ledger will attach each claim to the controlling text, dates, parties, reservations, and termination rules instead of presenting a simplistic list of “allies.”</p></Prose>
      </Section>

      <Section id="power" title="Military power" question="How much of the federal budget goes to defense, and how does it compare with international affairs?">
        <ChartCard title="Defense and international-affairs outlays" subtitle="Federal fiscal years · current dollars · different scales share one axis" source={OMB_SOURCE}>
          <TimeSeriesChart series={d.defense} unit="usd" />
        </ChartCard>
        <Prose><p>National-defense outlays measure budget function 050—not the full cost of every policy with international consequences. International-affairs outlays include diplomacy and foreign assistance, but some assistance also flows through Defense Department accounts.</p></Prose>
      </Section>

      <Section id="assistance" title="Foreign assistance" question="What does the United States commit and actually disburse abroad?">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Assistance over time" subtitle="All geographic recipients · current dollars" source={AID_SOURCE}>
            <TimeSeriesChart series={d.assistance} unit="usd" />
          </ChartCard>
          <ChartCard title="Largest recipient countries" subtitle={d.periods.aid?.replace(/^FY/, "FY ")} source={AID_SOURCE}>
            <RankedBars items={d.topRecipients} unit="usd" limit={15} />
          </ChartCard>
        </div>
        <Prose><p>An obligation is a legal commitment of funds; a disbursement is money actually paid. The country totals include different purposes—humanitarian relief, health, development, economic support, and security assistance—so a large number does not by itself explain the policy.</p></Prose>
      </Section>

      <Section id="diplomacy" title="Diplomacy" question="How should formal representation, negotiations, and multilateral action be measured?">
        <div className="grid gap-4 md:grid-cols-3">
          <Framework title="Bilateral diplomacy"><p>Embassies, high-level visits, agreements, and formal protests show channels and activity. They do not by themselves show whether a relationship is warm or effective.</p></Framework>
          <Framework title="Multilateral diplomacy"><p>Votes, vetoes, resolutions, and coalition statements show recorded positions. Abstentions, absences, and nonbinding resolutions need to remain visible.</p></Framework>
          <Framework title="Negotiated outcomes"><p>Ceasefires, settlements, and agreements should be tracked separately from meetings or announcements, with implementation and expiration dates.</p></Framework>
        </div>
        <Prose><p>The existing <Link href="/israel" className="underline underline-offset-2">Israel dossier</Link> already demonstrates resolution-level UN vote reporting. This page will generalize that model rather than treating a country’s voting-agreement percentage as a verdict.</p></Prose>
      </Section>

      <Section id="economic" title="Economic statecraft" question="Which relationships carry the most goods trade, and which tools go beyond ordinary commerce?">
        <ChartCard title="Largest goods-trade relationships" subtitle={`${d.periods.trade ?? "Latest period"} · exports plus imports`} source={TRADE_SOURCE}>
          <RankedBars items={d.topTrade} unit="usd" limit={20} slot={2} />
        </ChartCard>
        <div className="grid gap-4 md:grid-cols-3">
          <Framework title="Trade"><p>Exports, imports, and the balance describe goods flows—not who “wins.” Services, investment, supply-chain concentration, and value added require separate measures.</p></Framework>
          <Framework title="Sanctions"><p>Program authority, targeted people or entities, prohibited transactions, exceptions, licenses, and effective dates all matter. A country-level yes/no label loses those distinctions.</p></Framework>
          <Framework title="Investment and controls"><p>Export controls, investment screening, tariffs, and procurement restrictions operate under different laws and cover different products and transactions.</p></Framework>
        </div>
      </Section>

      <Section id="authority" title="Who has authority?" question="Which institution can initiate, authorize, fund, constrain, or review an action?">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Framework title="President"><p>Conducts diplomacy and commands the armed forces, subject to statutes, appropriations, treaties, and judicially enforceable limits.</p></Framework>
          <Framework title="Congress"><p>Legislates, appropriates, regulates commerce, oversees the executive, approves treaties through the Senate, and holds constitutional war powers.</p></Framework>
          <Framework title="Agencies"><p>State, Defense, Treasury, Commerce, and others administer distinct authorities. The implementing agency and statutory delegation should be named.</p></Framework>
          <Framework title="Courts"><p>Review depends on jurisdiction, standing, reviewability, and the claim presented. Some foreign-affairs disputes receive substantial political-branch deference.</p></Framework>
        </div>
      </Section>

      <Section id="countries" title="Country index" question="Where can you compare aid and trade before opening a relationship-specific dossier?">
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr><th className="px-4 py-3">Country</th><th className="px-4 py-3 text-right">Aid obligated</th><th className="px-4 py-3 text-right">Disbursed</th><th className="px-4 py-3 text-right">U.S. exports</th><th className="px-4 py-3 text-right">U.S. imports</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                {d.countries.map((country) => (
                  <tr key={country.code} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/60">
                    <th className="px-4 py-2.5 font-medium text-slate-950 dark:text-white">{country.code === "ISR" ? <Link href="/israel" className="underline decoration-slate-300 underline-offset-2">{country.name} →</Link> : country.name}<span className="ml-2 text-xs font-normal text-slate-400">{country.code}</span></th>
                    {[country.obligations, country.disbursements, country.exports, country.imports].map((value, i) => <td key={i} className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{value === null ? "—" : usd(value)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs leading-5 text-slate-500">Aid columns use {d.periods.aid?.replace(/^FY/, "FY ") ?? "the latest fiscal year"}; trade columns use {d.periods.trade ?? "the latest Census month"}. Missing values mean the source has no row for that country and period, not necessarily zero.</p>
      </Section>
    </div>
  );
}
