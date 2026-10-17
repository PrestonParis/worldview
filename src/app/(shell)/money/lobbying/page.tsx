import type { Metadata } from "next";
import { ChartCard } from "@/components/charts/chart-card";
import { RankedBars, type RankedItem } from "@/components/charts/ranked-bars";
import { LobbyingView } from "@/components/money/lobbying-view";
import { Coverage, MONEY_SOURCES, MoneyHeader, MoneySection, Snapshot, usd } from "@/components/money/money-ui";
import { Term } from "@/components/money/term";
import { formatValue } from "@/lib/format";
import { listBills } from "@/lib/db/bills";
import { listLobbyingRegistrations } from "@/lib/db/lobbying";
import { loadLobbyingSummary } from "@/lib/db/moneyOverview";
import { MONEY_COLORS } from "@/lib/money/semantic";
import { getEntitiesByIds } from "@/lib/db/entities";

export const metadata: Metadata = {
  title: "Lobbying | Money & Influence | Worldview",
  description: "Senate Lobbying Disclosure Act filings: clients, firms, spending, issues, and the bills they lobbied on.",
};

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

export default async function Page() {
  const [summary, registrations, allBills] = await Promise.all([loadLobbyingSummary(), listLobbyingRegistrations(), listBills()]);
  // Ship only the entities and bills the filings name, not the whole graph.
  const entities = await getEntitiesByIds(registrations.flatMap((r) => [r.clientEntityId, r.registrantEntityId]));
  const billIds = new Set(registrations.flatMap((r) => r.issues.map((i) => i.billId)).filter(Boolean));
  const bills = allBills.filter((b) => billIds.has(b.id));

  const filings = (n: number) => `${n.toLocaleString()} filing${n === 1 ? "" : "s"}`;
  const clients: RankedItem[] = summary.topClients.map((c) => ({ label: c.name, value: c.total, note: filings(c.count), color: MONEY_COLORS.lobbying }));
  const firms: RankedItem[] = summary.topFirms.map((c) => ({ label: c.name, value: c.total, note: filings(c.count), color: MONEY_COLORS.lobbying }));
  const issues: RankedItem[] = summary.issues.map((i) => ({ label: i.label, value: i.total, note: filings(i.total), color: MONEY_COLORS.lobbying }));
  const years = summary.years.join("–");

  return (
    <div className="mx-auto max-w-7xl space-y-14 pb-16">
      <MoneyHeader
        title="Lobbying"
        features={[
          "Spent on policy, not elections",
          <>
            What <Term k="lobbyingClient">clients</Term> pay <Term k="lobbyingRegistrant">lobbying firms</Term>
          </>,
          "The issues and bills they name",
        ]
        }
        extra={summary.latestYear ? <Coverage label="Latest lobbying year">{summary.latestYear}</Coverage> : null}
      />

      {summary.filings === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No lobbying filings yet. Add one in{" "}
          <a href="/data/lobbying" className="underline underline-offset-2">
            Manage Data
          </a>
          .
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Coverage label="Records">
              {filings(summary.filings)} from {summary.clients} clients and {summary.firms} registrants{years ? `, ${years}` : ""}
            </Coverage>
          </div>

          <MoneySection title="Who pays, who lobbies, and on what">
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard title="Top clients" subtitle="Reported spending" source={MONEY_SOURCES.lda} table={{ columns: ["Client", "Amount", "Filings"], rows: clients.map((c) => [c.label, formatValue(c.value, "usd"), c.note ?? ""]) }}>
                <RankedBars items={clients} unit="usd" limit={10} />
              </ChartCard>
              <ChartCard title="Top registrants" subtitle="Firm income, or in-house spending when an organization lobbies for itself" source={MONEY_SOURCES.lda} table={{ columns: ["Firm", "Amount", "Filings"], rows: firms.map((c) => [c.label, formatValue(c.value, "usd"), c.note ?? ""]) }}>
                <RankedBars items={firms} unit="usd" limit={10} />
              </ChartCard>
              <ChartCard title="Most-lobbied issues" subtitle="Number of filings naming each issue (not dollars)" source={MONEY_SOURCES.lda} table={{ columns: ["Issue", "Filings"], rows: issues.map((i) => [i.label, i.value]) }}>
                <RankedBars items={issues} unit="count" limit={10} />
              </ChartCard>
            </div>
          </MoneySection>

          <Snapshot
            items={[
              { label: `Reported lobbying${years ? `, ${years}` : ""}`, value: usd(summary.total), detail: "Firm income from clients plus in-house lobbying expenses." },
              { label: "Filings", value: summary.filings.toLocaleString(), detail: "Registrations and quarterly activity reports." },
              { label: "Clients", value: summary.clients.toLocaleString(), detail: "Organizations paying for lobbying." },
              { label: "Registrants", value: summary.firms.toLocaleString(), detail: "Lobbying firms, plus organizations lobbying in-house." },
            ]}
          />

          <MoneySection title="Client–firm relationships" intro="Each row is one client and the firm representing it, with the issues and bills named across their filings.">
            <div className="h-144">
              <LobbyingView registrations={registrations} entities={entities} bills={bills} />
            </div>
          </MoneySection>
        </>
      )}
    </div>
  );
}
