import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { MoneyFlow, type FlowCandidate, type FlowDonor } from "@/components/money/money-flow";
import {
  MONEY_SOURCES,
  MoneyHeader,
  MoneySection,
  RaceCard,
  RankList,
  Snapshot,
  SupportOpposeBars,
  candidateTag,
  pct,
  raceLeaders,
  shortDate,
  usd,
  withCycle,
} from "@/components/money/money-ui";
import { Term } from "@/components/money/term";
import { formatPeriod } from "@/lib/format";
import {
  listMoneyCycles,
  loadCampaignMoney,
  loadContributionSummary,
  loadLobbyingSummary,
  resolveCycle,
  type CampaignMoney,
} from "@/lib/db/moneyOverview";
import { GLOSSARY } from "@/lib/money/glossary";
import { MONEY_COLORS, partyColor } from "@/lib/money/semantic";
import { pagesContent } from "@/lib/pages-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Money & Influence | Worldview",
  description:
    "Campaign fundraising, outside spending, and lobbying, from FEC and Senate Lobbying Disclosure Act filings.",
};

export default async function MoneyPage({ searchParams }: PageProps<"/money">) {
  const sp = await searchParams;
  const cycles = await listMoneyCycles();
  const cycle = resolveCycle(sp.cycle, cycles);
  const latest = cycles[0] ?? null;
  const [campaign, gifts, lobbying] = await Promise.all([
    loadCampaignMoney(cycle),
    loadContributionSummary(cycle),
    loadLobbyingSummary(),
  ]);
  const content = pagesContent["money"];
  const href = (h: string) => withCycle(h, cycle, latest);

  const cand = campaign.candidates;
  const raised = cand.reduce((s, c) => s + c.receipts, 0);
  const outside = campaign.outside.support + campaign.outside.oppose;
  const isEmpty = cand.length === 0 && gifts.totals.count === 0 && lobbying.filings === 0;

  const donorsByCandidate: Record<string, FlowDonor[]> = {};
  for (const r of gifts.topDonorsByRecipient) {
    (donorsByCandidate[r.recipientId] ??= []).push({ name: r.donorName, industry: r.industry, total: r.total, count: r.count });
  }
  const opponents = opponentMap(campaign);
  const requested = typeof sp.candidate === "string" ? sp.candidate : null;
  const targeted = campaign.races.filter((r) => r.support + r.oppose > 0).sort((a, b) => b.support + b.oppose - (a.support + a.oppose));
  const giftRange = gifts.byMonth.length ? `${formatPeriod(gifts.byMonth[0].month)} – ${formatPeriod(gifts.byMonth.at(-1)!.month)}` : "";

  return (
    <div className="mx-auto max-w-7xl space-y-14 pb-16">
      <MoneyHeader
        title={content.title}
        features={["What campaigns raise", "Outside spending to win or defeat candidates", "Lobbying in Washington"]}
        cycle={cycle}
        cycles={cycles}
        basePath="/money"
      />

      {isEmpty ? (
        <EmptyState
          message="No money recorded yet. Add records in"
          cta={{ href: "/data/contributions", label: "Manage Data" }}
        />
      ) : (
        <>
          {cand.length > 0 && cycle != null ? (
            <MoneySection
              id="follow"
              title="Follow the money"
              intro="Where each party's campaign money comes from. Pick a candidate to see their funding mix, largest donor committees, and their opponent."
            >
              <MoneyFlow
                key={requested ?? "all"}
                cycle={cycle}
                candidates={cand.map(toFlowCandidate)}
                donorsByCandidate={donorsByCandidate}
                opponents={opponents}
                initialCandidateId={requested}
                source={MONEY_SOURCES.fec}
              />
            </MoneySection>
          ) : null}

          <MoneySection
            title="Four kinds of political money"
            intro="Each number below measures a different flow from a different filing, so they don't add up to one total. A contribution record is a single transaction that also counts toward some campaign's receipts; lobbying pays for influence over policy, not for winning elections."
          >
            <Snapshot
              items={[
                {
                  label: <>Campaign money{cycle ? `, ${cycle}` : ""}</>,
                  value: usd(raised),
                  detail: (
                    <>
                      Raised directly by candidates&rsquo; campaign committees. Covers the {cand.length} tracked candidates
                      {seatMix(campaign)}
                      {campaign.asOf ? `, reports through ${shortDate(campaign.asOf)}` : ""}.
                    </>
                  ),
                  href: href("/money/candidates"),
                },
                {
                  label: <Term k="outsideSpending" />,
                  value: usd(outside),
                  detail: (
                    <>
                      Spent independently to help or defeat candidates: {usd(campaign.outside.support)} supporting,{" "}
                      {usd(campaign.outside.oppose)} opposing. {campaign.outside.filings.toLocaleString()} filings from{" "}
                      {campaign.outside.groups} groups.
                    </>
                  ),
                  href: href("/money/outside-spending"),
                },
                {
                  label: <>Lobbying{lobbying.latestYear ? `, ${lobbying.years.join("–")}` : ""}</>,
                  value: usd(lobbying.total),
                  detail: (
                    <>
                      Paid to influence Congress and federal agencies, not to elect anyone. {lobbying.filings.toLocaleString()} filings from{" "}
                      {lobbying.clients} clients.
                    </>
                  ),
                  href: "/money/lobbying",
                },
                {
                  label: "Contribution records",
                  value: gifts.totals.count.toLocaleString(),
                  detail: (
                    <>
                      Individual committee-to-campaign transactions totalling {usd(gifts.totals.amount)}
                      {giftRange ? `, ${giftRange}` : ""}, from {gifts.totals.donors.toLocaleString()} donor committees.
                    </>
                  ),
                  href: href("/money/contributions"),
                },
              ]}
            />
          </MoneySection>

          {campaign.races.length > 0 ? (
            <MoneySection
              title="Biggest races by money"
              intro="Campaign receipts plus outside spending, race by race. Each card compares the leading Democrat and Republican."
              action={{ href: href("/money/candidates"), label: "All races" }}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {campaign.races.slice(0, 6).map((race) => (
                  <RaceCard key={race.key} race={race} cycle={cycle} latest={latest} />
                ))}
              </div>
            </MoneySection>
          ) : null}

          <div className="grid gap-12 lg:grid-cols-2">
            {cand.length > 0 ? (
              <MoneySection title="Biggest fundraisers" intro={<>Total <Term k="receipts">receipts</Term> this cycle.</>} action={{ href: href("/money/candidates#fundraisers"), label: "All candidates" }}>
                <RankList
                  rows={cand.map((c) => ({
                    key: c.entityId,
                    label: c.name,
                    sub: `${candidateTag(c)} · ${pct(c.individual, c.receipts)} individuals`,
                    value: c.receipts,
                    color: partyColor(c.party),
                    href: href(`/money?candidate=${c.entityId}#follow`),
                  }))}
                />
              </MoneySection>
            ) : null}
            {targeted.length > 0 ? (
              <MoneySection title="Most-targeted races" intro={<><Term k="independentExpenditure">Independent expenditures</Term> by race.</>} action={{ href: href("/money/outside-spending"), label: "Outside spending" }}>
                <SupportOpposeBars
                  limit={5}
                  rows={targeted.map((r) => ({
                    key: r.key,
                    label: r.label,
                    support: r.support,
                    oppose: r.oppose,
                    href: r.electionId ? `/elections/${r.electionId}` : undefined,
                  }))}
                />
              </MoneySection>
            ) : null}
          </div>

          {lobbying.filings > 0 ? (
            <MoneySection
              title={`Lobbying${lobbying.latestYear ? `, ${lobbying.latestYear}` : ""}`}
              intro={
                <>
                  Who pays to lobby, and on what. Lobbying is reported by calendar year, separately from election cycles; the latest year
                  loaded is {lobbying.latestYear}.
                </>
              }
              action={{ href: "/money/lobbying", label: "Explore lobbying" }}
            >
              <div className="grid gap-12 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Top <Term k="lobbyingClient">clients</Term> by reported spending
                  </h3>
                  <RankList
                    rows={lobbying.topClients.map((c) => ({
                      key: c.id,
                      label: c.name,
                      sub: `${c.count} filing${c.count === 1 ? "" : "s"}`,
                      value: c.total,
                      color: MONEY_COLORS.lobbying,
                      href: `/data/entities/${c.id}`,
                    }))}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Most-lobbied issues, by number of filings</h3>
                  <RankList
                    unit="count"
                    rows={lobbying.issues.map((i) => ({
                      key: i.label,
                      label: i.label,
                      value: i.total,
                      display: `${i.total.toLocaleString()} filings`,
                      color: MONEY_COLORS.lobbying,
                    }))}
                  />
                </div>
              </div>
            </MoneySection>
          ) : null}

          <nav aria-label="Explore" className="grid gap-px overflow-hidden rounded-2xl bg-slate-200 sm:grid-cols-2 lg:grid-cols-5 dark:bg-slate-800">
            {[
              ["Candidates & races", "Every tracked campaign, race by race", href("/money/candidates")],
              ["Donors", "Committees, industries, and where gifts come from", href("/money/donors")],
              ["Outside spending", "Who spends for and against whom", href("/money/outside-spending")],
              ["Lobbying", "Clients, firms, issues, and filings", "/money/lobbying"],
              ["Contributions explorer", "Search and export every record", href("/money/contributions")],
            ].map(([label, body, h]) => (
              <Link key={label} href={h} className="group bg-white p-5 hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{label} →</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{body}</span>
              </Link>
            ))}
          </nav>

          <MoneySection title="Campaign-finance terms" intro="Hover any dotted term on these pages for its definition; the full list is here.">
            <details className="group rounded-2xl border border-slate-200 dark:border-slate-800">
              <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span className="group-open:hidden">Show all {Object.keys(GLOSSARY).length} definitions</span>
                <span className="hidden group-open:inline">Hide definitions</span>
              </summary>
              <dl className="grid gap-x-8 gap-y-4 border-t border-slate-200 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-800">
                {Object.values(GLOSSARY).map((g) => (
                  <div key={g.term}>
                    <dt className="text-sm font-semibold text-slate-900 dark:text-white">{g.term}</dt>
                    <dd className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{g.def}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </MoneySection>
        </>
      )}
    </div>
  );
}

function seatMix(campaign: CampaignMoney): string {
  const senate = campaign.candidates.filter((c) => c.office === "S").length;
  const house = campaign.candidates.filter((c) => c.office === "H").length;
  const parts = [senate ? `${senate} Senate` : "", house ? `${house} House` : ""].filter(Boolean);
  return parts.length > 1 ? ` (${parts.join(", ")})` : parts.length ? ` (${parts[0]})` : "";
}

function opponentMap(campaign: CampaignMoney): Record<string, string> {
  const out: Record<string, string> = {};
  for (const race of campaign.races) {
    const [a, b] = raceLeaders(race);
    if (a && b && a.party !== b.party) {
      out[a.entityId] = b.entityId;
      out[b.entityId] = a.entityId;
    }
  }
  return out;
}

function toFlowCandidate(c: CampaignMoney["candidates"][number]): FlowCandidate {
  return {
    id: c.entityId,
    name: c.name,
    party: c.party,
    state: c.state,
    office: c.office,
    district: c.district,
    receipts: c.receipts,
    disbursements: c.disbursements,
    cashOnHand: c.cashOnHand,
    individual: c.individual,
    pac: c.pac,
    party_: c.party_,
  };
}
