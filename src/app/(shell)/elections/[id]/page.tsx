import Link from "next/link";
import { notFound } from "next/navigation";
import { getElection } from "@/lib/db/elections";
import { listCandidaciesForElection } from "@/lib/db/candidacies";
import { listResultsForElection, areaBreakdowns } from "@/lib/db/electionResults";
import { getCandidateFinanceForEntity, type CandidateFinance } from "@/lib/db/candidateFinance";
import { outsideSpendingByCandidate, type CandidateOutsideSpending } from "@/lib/db/independentExpenditures";
import { ratingHistory } from "@/lib/db/raceRatings";
import { getEntitiesByIds } from "@/lib/db/entities";
import { summarizeCandidacies, type Candidacy } from "@/lib/validation/candidacy";
import { partyColorFor } from "@/lib/party-colors";
import { formatAmount } from "@/lib/money";
import { candidateIdentityKey, normalizeCandidateName, normalizePartyName } from "@/lib/elections/display";
import { consensusRating, HANDICAPPERS, partyLetter } from "@/lib/elections/overview";
import { ratingLabel } from "@/lib/validation/raceRating";
import { ElectionStatusPill } from "@/components/elections/election-status";
import { DataSourceNote } from "@/components/elections/data-source-note";
import { FollowMoneyMenu } from "@/components/money/follow-money-menu";
import { partyColor as fecPartyColor, partyLetter as fecPartyLetter } from "@/lib/money/semantic";
import { ResultsSection } from "@/components/elections/results-section";
import type { Entity } from "@/lib/validation/entity";

// Rebuilt at most hourly; crawlers and visitors share the cached render.
export const revalidate = 3600;

// Nothing prebuilt; each page is rendered on first request, then cached.
export async function generateStaticParams() {
  return [];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function candidateStage(candidacy: Candidacy): number {
  if (candidacy.withdrew || candidacy.status === "withdrew") return 0;
  if (candidacy.status === "nominee") return 5;
  if (candidacy.status === "primary_winner") return 4;
  if (candidacy.status === "filed") return 3;
  if (candidacy.status === "lost_primary") return 1;
  return 2;
}

function dedupeCandidacies(candidacies: Candidacy[], entityById: Map<string, Entity>): Candidacy[] {
  const unique = new Map<string, Candidacy>();
  for (const candidacy of candidacies) {
    const name = entityById.get(candidacy.candidateEntityId)?.name ?? "Unknown";
    const key = candidateIdentityKey(name);
    const existing = unique.get(key);
    if (!existing || candidateStage(candidacy) > candidateStage(existing) || (candidacy.incumbent && !existing.incumbent)) unique.set(key, candidacy);
  }
  return [...unique.values()];
}

export default async function ElectionDetailPage({ params }: PageProps<"/elections/[id]">) {
  const { id } = await params;
  const [election, candidacyRows, resultRows, ratings] = await Promise.all([
    getElection(id),
    listCandidaciesForElection(id),
    listResultsForElection(id),
    ratingHistory(id),
  ]);
  if (!election) notFound();

  const entities = await getEntitiesByIds(candidacyRows.map((candidacy) => candidacy.candidateEntityId));
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const candidacies = dedupeCandidacies(candidacyRows, entityById);
  const upcomingGeneral = election.status === "scheduled" && election.electionType === "general";
  const nominees = candidacies.filter((candidate) => !candidate.withdrew && (candidate.status === "nominee" || candidate.status === "primary_winner"));
  const active = upcomingGeneral ? nominees : candidacies.filter((candidate) => !candidate.withdrew && candidate.status !== "lost_primary");
  const historical = upcomingGeneral ? candidacies.filter((candidate) => !active.includes(candidate)) : [];
  const cycle = election.cycle ?? new Date(election.electionDate).getUTCFullYear();

  const [financeRows, outsideSpending] = await Promise.all([
    Promise.all(active.map((candidate) => getCandidateFinanceForEntity(candidate.candidateEntityId, cycle))),
    outsideSpendingByCandidate(active.map((candidate) => candidate.candidateEntityId), cycle),
  ]);
  const financeByEntity = new Map<string, CandidateFinance>();
  active.forEach((candidate, index) => { const finance = financeRows[index]; if (finance) financeByEntity.set(candidate.candidateEntityId, finance); });

  const summary = summarizeCandidacies(candidacies);
  const consensus = consensusRating(ratings.map((rating) => ({ source: rating.source, rating: rating.rating, asOf: rating.asOf })));
  const incumbent = candidacies.find((candidate) => candidate.incumbent);
  const incumbentName = incumbent ? normalizeCandidateName(entityById.get(incumbent.candidateEntityId)?.name ?? "Unknown") : null;
  const breakdowns = areaBreakdowns(resultRows).sort((a, b) => a.areaName.localeCompare(b.areaName));
  const denom = election.totalVotes ?? summary.totalVotes;
  const marginPct = summary.margin != null && denom > 0 ? (summary.margin / denom) * 100 : null;
  const isGeorgia = election.jurisdiction.toLowerCase() === "georgia";

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <Link href={`/elections?cycle=${cycle}`} className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">← Election center</Link>

      <header className="mt-5 border-y border-slate-300 py-7 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span>{election.office}</span><span aria-hidden>·</span><span>{election.jurisdiction}</span><ElectionStatusPill status={election.status} />
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{election.jurisdiction} {election.office}</h1>
        <p className="mt-3 text-lg text-slate-700 dark:text-slate-300">{election.electionType.replace(/^./, (character) => character.toUpperCase())} election · {formatDate(election.electionDate)}</p>

        <dl className="mt-7 grid gap-5 border-t border-slate-200 pt-5 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
          <Meta label="Incumbent" value={incumbentName ? `${incumbentName} (${partyLetter(incumbent?.party) ?? "Other"})` : election.openSeat ? "Open seat" : "Not identified"} />
          <Meta label="Seat" value={election.seatClass ? `Class ${election.seatClass} · 6-year term` : election.openSeat ? "Open seat" : election.office} />
          <Meta label="Race rating" value={consensus ? ratingLabel(consensus.rating) : "No published consensus"} />
          <Meta label="Last updated" value={shortDate(election.updatedAt)} />
        </dl>
        {isGeorgia ? (
          <p className="mt-5 text-sm text-slate-600 dark:text-slate-400">Georgia schedules a general-election runoff for December 1, 2026 when required. <a href="https://sos.ga.gov/2026-elections-calendar" className="underline underline-offset-2">Official calendar</a></p>
        ) : null}
      </header>

      {upcomingGeneral ? (
        <section className="mt-10">
          <div className="flex items-end justify-between gap-4 border-b border-slate-300 pb-3 dark:border-slate-700">
            <div><p className="text-sm font-semibold text-slate-500 dark:text-slate-400">General election</p><h2 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">Candidates on the November ballot</h2></div>
            <span className="text-sm text-slate-500 dark:text-slate-400">{active.length} {active.length === 1 ? "candidate" : "candidates"}</span>
          </div>
          {active.length ? (
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {active.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} entity={entityById.get(candidate.candidateEntityId)} finance={financeByEntity.get(candidate.candidateEntityId)} spending={outsideSpending.get(candidate.candidateEntityId)} />)}
            </div>
          ) : (
            <div className="mt-5 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
              General-election nominees have not been verified in the current data. Filed candidates are kept out of the matchup until their ballot status is confirmed.
            </div>
          )}
        </section>
      ) : (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Candidates and results</h2>
          {summary.margin != null ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Margin: {summary.margin.toLocaleString()} votes{marginPct != null ? ` (${marginPct.toFixed(1)} points)` : ""}</p> : null}
          <div className="mt-5 grid gap-4 md:grid-cols-2">{active.map((candidate) => <ResultCandidate key={candidate.id} candidate={candidate} entity={entityById.get(candidate.candidateEntityId)} total={denom} />)}</div>
        </section>
      )}

      {consensus || ratings.length ? (
        <section className="mt-12 border-t border-slate-300 pt-6 dark:border-slate-700">
          <div className="grid gap-6 md:grid-cols-[12rem_1fr]">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Race status</h2>
            <div>
              <p className="text-3xl font-semibold text-slate-950 dark:text-white">{consensus ? ratingLabel(consensus.rating) : "No consensus"}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">Race ratings describe which party is more likely to win, not the expected vote margin. Worldview uses the median of the latest available major forecaster ratings.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {consensus?.ratings.map((rating) => (
                  <div key={rating.source} className="border-t-2 border-slate-950 pt-3 dark:border-white">
                    <p className="font-semibold text-slate-950 dark:text-white">{HANDICAPPERS.find((source) => source.id === rating.source)?.label ?? rating.source}</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{ratingLabel(rating.rating)}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">As of {shortDate(rating.asOf)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {active.some((candidate) => financeByEntity.has(candidate.candidateEntityId) || outsideSpending.has(candidate.candidateEntityId)) ? (
        <FinanceComparison candidates={active} entityById={entityById} financeByEntity={financeByEntity} outsideSpending={outsideSpending} />
      ) : null}

      {historical.length ? (
        <details className="mt-12 border-t border-slate-300 pt-5 dark:border-slate-700">
          <summary className="cursor-pointer text-lg font-semibold text-slate-950 dark:text-white">Primary, withdrawn, and other filed candidates ({historical.length})</summary>
          <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
            {historical.map((candidate) => {
              const entity = entityById.get(candidate.candidateEntityId);
              return <li key={candidate.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span>{normalizeCandidateName(entity?.name ?? "Unknown")} · {normalizePartyName(candidate.party)}</span><span className="text-slate-500 dark:text-slate-400">{candidate.withdrew ? "Withdrawn" : candidate.status === "lost_primary" ? "Lost primary" : candidate.status ? candidate.status.replaceAll("_", " ") : "Filed"}</span></li>;
            })}
          </ul>
        </details>
      ) : null}

      {breakdowns.length > 0 ? (
        <section className="mt-12"><h2 className="mb-4 text-2xl font-semibold text-slate-950 dark:text-white">Results by county</h2><ResultsSection breakdowns={breakdowns} /></section>
      ) : null}

      {election.notes ? <p className="mt-10 text-sm text-slate-600 dark:text-slate-400">{election.notes}</p> : null}
      <DataSourceNote className="mt-8" />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-950 dark:text-white">{value}</dd></div>;
}

function CandidateCard({ candidate, entity, finance, spending }: { candidate: Candidacy; entity?: Entity; finance?: CandidateFinance; spending?: CandidateOutsideSpending }) {
  const color = partyColorFor(candidate.party);
  return (
    <article className="border-t-4 pt-4" style={{ borderColor: color.border }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/people?root=${candidate.candidateEntityId}`} className="text-xl font-semibold text-slate-950 hover:underline dark:text-white">{normalizeCandidateName(entity?.name ?? "Unknown")}</Link>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{normalizePartyName(candidate.party)}{candidate.incumbent ? " · Incumbent" : ""}</p>
        </div>
        <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: color.bg, color: color.text }}>{partyLetter(candidate.party) ?? "Other"}</span>
      </div>
      {entity?.description ? <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-300">{entity.description}</p> : null}
      {finance || spending ? (
        <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
          <Money label="Raised" value={finance?.totalReceipts} />
          <Money label="Spent" value={finance?.totalDisbursements} />
          <Money label="Cash on hand" value={finance?.cashOnHand} />
          <Money label="Outside spending" value={spending ? spending.support + spending.oppose : null} />
        </dl>
      ) : <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">Campaign finance totals are not currently linked.</p>}
    </article>
  );
}

function Money({ label, value }: { label: string; value: number | null | undefined }) {
  return <div><dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-0.5 font-medium tabular-nums text-slate-950 dark:text-white">{value == null ? "Not reported" : formatAmount(value, "USD")}</dd></div>;
}

function ResultCandidate({ candidate, entity, total }: { candidate: Candidacy; entity?: Entity; total: number }) {
  const color = partyColorFor(candidate.party);
  const percent = total > 0 && candidate.votes != null ? (candidate.votes / total) * 100 : null;
  return <article className="border-t-4 pt-3" style={{ borderColor: color.border }}><div className="flex justify-between gap-4"><div><Link href={`/people?root=${candidate.candidateEntityId}`} className="font-semibold hover:underline">{normalizeCandidateName(entity?.name ?? "Unknown")}</Link><p className="text-sm text-slate-500">{normalizePartyName(candidate.party)}{candidate.incumbent ? " · Incumbent" : ""}</p></div><div className="text-right"><p className="font-semibold tabular-nums">{candidate.votes == null ? "Votes not reported" : candidate.votes.toLocaleString()}</p>{percent != null ? <p className="text-sm tabular-nums text-slate-500">{percent.toFixed(1)}%</p> : null}</div></div>{candidate.won ? <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Winner</p> : null}</article>;
}

function FinanceComparison({ candidates, entityById, financeByEntity, outsideSpending }: { candidates: Candidacy[]; entityById: Map<string, Entity>; financeByEntity: Map<string, CandidateFinance>; outsideSpending: Map<string, CandidateOutsideSpending> }) {
  const latest = [...financeByEntity.values()].map((finance) => finance.coverageEndDate).filter(Boolean).sort().at(-1);
  // Follow the money charts Democrats and Republicans, so offer this race's
  // major-party candidates with FEC data and let the reader pick.
  const followOptions = candidates
    .flatMap((candidate) => {
      const finance = financeByEntity.get(candidate.candidateEntityId);
      return finance && (finance.party === "DEM" || finance.party === "REP") ? [{ candidate, finance }] : [];
    })
    .sort((a, b) => (b.finance.totalReceipts ?? 0) - (a.finance.totalReceipts ?? 0))
    .map(({ candidate, finance }) => ({
      href: `/money?candidate=${finance.entityId}&cycle=${finance.cycle}#follow`,
      name: normalizeCandidateName(entityById.get(candidate.candidateEntityId)?.name ?? "Unknown"),
      party: fecPartyLetter(finance.party),
      color: fecPartyColor(finance.party),
      raised: formatAmount(finance.totalReceipts ?? 0, "USD"),
    }));
  return (
    <section className="mt-12 border-t border-slate-300 pt-6 dark:border-slate-700">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Campaign money</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">FEC candidate filings for the {candidates[0] ? financeByEntity.get(candidates[0].candidateEntityId)?.cycle ?? "current" : "current"} cycle{latest ? `, through ${shortDate(latest)}` : ""}.</p></div><FollowMoneyMenu label="Follow the money in this race →" options={followOptions} className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300" /></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[42rem] text-sm"><thead className="border-b border-slate-300 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"><tr><th className="py-2 pr-4">Candidate</th><th className="px-3 py-2 text-right">Raised</th><th className="px-3 py-2 text-right">Spent</th><th className="px-3 py-2 text-right">Cash on hand</th><th className="py-2 pl-3 text-right">Outside spending</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{candidates.map((candidate) => { const finance = financeByEntity.get(candidate.candidateEntityId); const outside = outsideSpending.get(candidate.candidateEntityId); const cell = (value: number | null | undefined) => value == null ? "Not reported" : formatAmount(value, "USD"); return <tr key={candidate.id}><td className="py-3 pr-4 font-medium">{normalizeCandidateName(entityById.get(candidate.candidateEntityId)?.name ?? "Unknown")}</td><td className="px-3 py-3 text-right tabular-nums">{cell(finance?.totalReceipts)}</td><td className="px-3 py-3 text-right tabular-nums">{cell(finance?.totalDisbursements)}</td><td className="px-3 py-3 text-right tabular-nums">{cell(finance?.cashOnHand)}</td><td className="py-3 pl-3 text-right tabular-nums">{cell(outside ? outside.support + outside.oppose : null)}</td></tr>; })}</tbody></table></div>
    </section>
  );
}
