import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, Download, ListOrdered } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { buttonVariants } from "@/components/ui/button";
import { partyColorFor } from "@/lib/party-colors";
import { writDocketHref } from "@/lib/tools/writ";
import type { CloseRacesData, TrackedElection } from "@/lib/db/closeRaces";
import type { CloseRaceFilters, ReportRow } from "@/lib/elections/close-races/rows";
import { countyNameFromSlug } from "@/lib/elections/close-races/csv";
import { closeRaceQuery, FILTER_FLAGS, FLAG_LABELS, LEVEL_LABELS, STATUS_LABELS } from "@/lib/elections/close-races/filters";
import { CONTEST_LEVELS, RESULT_STATUSES, type ContestFlag, type ResultStatus } from "@/lib/elections/close-races/types";
import { ContestDetailToggle, ElectionPicker } from "./close-races-client";

// Writ's close-races report: every contest in the state's official results
// feed, ranked by the votes separating the last winner from the first loser.

const PARTY_NAMES: Record<string, string> = { R: "republican", D: "democratic", L: "libertarian", G: "green", I: "independent", NP: "nonpartisan" };
const STALE_MS = 10 * 60_000;
const SHOWN_UNCONTESTED = 120;
export const PAGE = 100;

function pageQuery(query: string, limit: number | "all") {
  const q = new URLSearchParams(query.replace(/^\?/, ""));
  q.set("show", String(limit));
  return `?${q}`;
}

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US"));
const et = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET"
    : "—";

function electionLabel(e: TrackedElection) {
  return `${e.date} · ${e.name}`;
}

export function CloseRacesView({
  data,
  filters,
  isOwner,
  now,
  limit,
}: {
  data: CloseRacesData;
  filters: CloseRaceFilters;
  isOwner: boolean;
  now: number;
  /** Ranked rows shown on the page; the CSV always has all of them. */
  limit: number | null;
}) {
  const { election, report, coverage } = data;
  const base = `/writ/close-races/${encodeURIComponent(election.id)}`;
  const query = closeRaceQuery(filters);
  const stale = !election.isOfficial && election.lastStateFetchAt != null && now - new Date(election.lastStateFetchAt).getTime() > STALE_MS;
  const shown = limit == null ? report.ranked : report.ranked.slice(0, limit);
  const filtered = Boolean(filters.level || filters.county || filters.municipality || filters.office || filters.maxPct != null || filters.maxVotes != null || filters.status || filters.flag);

  return (
    <div className="space-y-6">
      <Surface className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-rose-600 uppercase dark:text-rose-400">
              <ListOrdered aria-hidden className="h-4 w-4" />
              Close races · Georgia
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">{election.name}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {fmt(data.totalContests)} contests from the Georgia Secretary of State&apos;s results system, closest first.
            </p>
          </div>
          <div className="w-full lg:w-96">
            <ElectionPicker current={election.id} elections={data.elections.map((e) => ({ id: e.id, label: electionLabel(e) }))} query={query} />
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Fact label="Source updated" value={et(election.sourceUpdatedAt)} />
          <Fact label="Worldview updated" value={et(election.lastWriteAt)} tone={stale ? "warn" : undefined} note={stale ? `No state fetch since ${et(election.lastStateFetchAt)}` : undefined} />
          <Fact
            label="Coverage"
            value={coverage.expectedContests ? `${fmt(coverage.observedContests)} / ${fmt(coverage.expectedContests)} expected` : `${coverage.jurisdictions - coverage.missing} of ${coverage.jurisdictions} feeds`}
            note={coverage.unverified ? `${coverage.unverified} not yet checked against ballots` : undefined}
            href="#coverage"
          />
          <Fact label="Results" value={election.isOfficial ? "State certified" : resultSummary(data.statusCounts)} />
        </dl>
      </Surface>

      <Surface className="p-4 sm:p-5">
        <form action={base} method="get" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Select name="sort" label="Rank by" value={filters.sort} options={[["votes", "Fewest votes"], ["percent", "Fewest points"]]} />
          <Select name="level" label="Level" value={filters.level ?? ""} options={[["", "All levels"], ...CONTEST_LEVELS.map((l) => [l, LEVEL_LABELS[l]] as [string, string])]} />
          <Select name="county" label="County" value={filters.county ?? ""} options={[["", "All counties"], ...data.counties.map((c) => [c.slug, c.name] as [string, string])]} />
          <Select name="status" label="Status" value={filters.status ?? ""} options={[["", "Any status"], ...RESULT_STATUSES.map((s) => [s, STATUS_LABELS[s]] as [string, string])]} />
          <Select name="flag" label="Flag" value={filters.flag ?? ""} options={[["", "Any"], ...FILTER_FLAGS.map((f) => [f, FLAG_LABELS[f]] as [string, string])]} />
          <Input name="max_votes" label="Max votes" value={filters.maxVotes} inputMode="numeric" />
          <Input name="max_pts" label="Max points" value={filters.maxPct} inputMode="decimal" />
          <Input name="q" label="Office or place" value={filters.office} />
          <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-4 xl:col-span-8">
            <button type="submit" className={buttonVariants({ size: "sm" })}>
              Apply
            </button>
            {filtered ? (
              <Link href={`${base}${filters.sort === "percent" ? "?sort=percent" : ""}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Clear filters
              </Link>
            ) : null}
            <a href={`/api/writ/close-races/${encodeURIComponent(election.id)}${query}`} className={buttonVariants({ variant: "outline", size: "sm" }) + " ml-auto gap-2"}>
              <Download aria-hidden className="h-3.5 w-3.5" />
              Download CSV ({fmt(report.ranked.length)})
            </a>
          </div>
        </form>
      </Surface>

      <section aria-labelledby="ranked">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 id="ranked" className="text-lg font-bold text-slate-950 dark:text-white">
            {fmt(report.ranked.length)} ranked contests, {filters.sort === "percent" ? "smallest percentage-point margin" : "smallest vote margin"} first
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Reporting counts are reporting units (precincts or counties), not ballots. Provisional, cured absentee, and eligible overseas ballots can be added until certification.
          </p>
        </div>
        {report.ranked.length ? (
          <>
            <RankedTable rows={shown} sort={filters.sort} />
            <RankedCards rows={shown} sort={filters.sort} />
            {shown.length < report.ranked.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`${base}${pageQuery(query, (limit ?? 0) + PAGE)}`} scroll={false} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Show {Math.min(PAGE, report.ranked.length - shown.length)} more
                </Link>
                <Link href={`${base}${pageQuery(query, "all")}`} scroll={false} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Show all {fmt(report.ranked.length)}
                </Link>
              </div>
            ) : null}
          </>
        ) : (
          <Surface className="p-6 text-sm text-slate-500">No contests match these filters.</Surface>
        )}
      </section>

      {report.waiting.length ? (
        <Section title={`${fmt(report.waiting.length)} contested races without results yet`}>
          <NameList rows={report.waiting} />
        </Section>
      ) : null}

      {report.uncontested.length ? (
        <Section title={`${fmt(report.uncontested.length)} uncontested races (not ranked)`}>
          <p className="mb-3 text-xs text-slate-500">
            {CONTEST_LEVELS.filter((l) => data.levelCounts[l]?.uncontested)
              .map((l) => `${LEVEL_LABELS[l]}: ${fmt(data.levelCounts[l]!.uncontested)}`)
              .join(" · ")}
          </p>
          <NameList rows={report.uncontested.slice(0, SHOWN_UNCONTESTED)} />
          {report.uncontested.length > SHOWN_UNCONTESTED ? (
            <p className="mt-2 text-xs text-slate-500">Showing {SHOWN_UNCONTESTED}; filter by county to see the rest.</p>
          ) : null}
        </Section>
      ) : null}

      <div id="coverage" className="scroll-mt-28">
        <Section title={`Coverage: ${coverage.complete} complete, ${coverage.partial} partial, ${coverage.missing} missing, ${coverage.unverified} unverified`} open={coverage.missing + coverage.partial > 0}>
          <p className="mb-3 text-xs text-slate-500">
            Expected contest counts come from qualified-candidate lists, sample ballots, and county notices. A jurisdiction is unverified until its count has been checked.
          </p>
          <CoverageTable rows={coverage.rows} />
        </Section>
      </div>

      {isOwner ? <OperatorPanel election={election} alerts={data.alerts ?? []} /> : null}
    </div>
  );
}

function resultSummary(counts: Partial<Record<ResultStatus, number>>) {
  const order: ResultStatus[] = ["reporting", "unofficial_complete", "county_certified", "state_certified", "no_results", "recount_pending", "contested"];
  const parts = order.filter((s) => counts[s]).map((s) => `${fmt(counts[s])} ${STATUS_LABELS[s].toLowerCase()}`);
  return parts.slice(0, 2).join(", ") || "—";
}

function Fact({ label, value, note, tone, href }: { label: string; value: string; note?: string; tone?: "warn"; href?: string }) {
  const body = (
    <>
      <dt className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">{label}</dt>
      <dd className={`mt-1 font-semibold tabular-nums ${tone === "warn" ? "text-amber-700 dark:text-amber-400" : "text-slate-950 dark:text-white"}`}>
        {tone === "warn" ? <AlertTriangle aria-hidden className="mr-1 inline h-3.5 w-3.5" /> : null}
        {value}
      </dd>
      {note ? <dd className="mt-0.5 text-xs text-slate-500">{note}</dd> : null}
    </>
  );
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
      {href ? (
        <a href={href} className="block hover:opacity-80">
          {body}
        </a>
      ) : (
        body
      )}
    </div>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: [string, string][] }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
      {label}
      <select name={name} defaultValue={value} className="min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Input({ name, label, value, inputMode }: { name: string; label: string; value: string | number | null | undefined; inputMode?: "numeric" | "decimal" }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
      {label}
      <input
        name={name}
        defaultValue={value ?? ""}
        inputMode={inputMode}
        className="min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      />
    </label>
  );
}

function Section({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-slate-900 dark:text-white">
        {title}
        <span aria-hidden className="text-slate-400 transition group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}

function Party({ party }: { party: string | null }) {
  if (!party) return null;
  const color = partyColorFor(PARTY_NAMES[party] ?? party);
  return (
    <span className="ml-1 rounded px-1 text-[10px] font-bold" style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}` }}>
      {party}
    </span>
  );
}

function Candidate({ name, party, incumbent, votes }: { name: string | null; party: string | null; incumbent: boolean; votes: number | null }) {
  if (!name) return <span className="text-slate-400">—</span>;
  return (
    <span className="block min-w-0">
      <span className="font-medium text-slate-900 dark:text-white">{name}</span>
      <Party party={party} />
      {incumbent ? <span className="ml-1 text-[10px] text-slate-500">inc.</span> : null}
      <span className="block text-xs text-slate-500 tabular-nums">{fmt(votes)}</span>
    </span>
  );
}

const FLAG_STYLE: Record<ContestFlag, string> = {
  tie: "bg-rose-600 text-white",
  recount_request_range: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  runoff_required: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  near_runoff: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  runoff_rule_unverified: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  merged: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  unlinked_counties: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
};

function flagLabel(flag: ContestFlag, row: ReportRow) {
  if (flag === "runoff_required") {
    const done = row.resultStatus !== "reporting" && row.resultStatus !== "no_results";
    return done ? "Runoff required" : "Under 50% so far";
  }
  return FLAG_LABELS[flag];
}

function Flags({ row }: { row: ReportRow }) {
  if (!row.flags.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {row.flags.map((f) => (
        <span key={f} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${FLAG_STYLE[f]}`}>
          {flagLabel(f, row)}
        </span>
      ))}
    </span>
  );
}

function RaceName({ row }: { row: ReportRow }) {
  const place =
    row.county ??
    (row.counties.length === 1 ? countyNameFromSlug(row.counties[0]) : row.counties.length > 1 ? `${row.counties.length} counties` : null);
  const title = row.electionId ? (
    <Link href={writDocketHref("race", row.electionId)} className="font-semibold text-slate-950 hover:text-rose-600 dark:text-white">
      {row.name}
    </Link>
  ) : (
    <span className="font-semibold text-slate-950 dark:text-white">{row.name}</span>
  );
  return (
    <span className="block min-w-0">
      {title}
      <span className="mt-0.5 block text-xs text-slate-500">
        {LEVEL_LABELS[row.level]}
        {place ? ` · ${place}` : ""}
        {row.municipality && row.level !== "municipal" ? ` · ${row.municipality}` : ""}
        {row.voteFor > 1 ? ` · ${row.voteFor} seats (last winner vs first loser)` : ""}
      </span>
    </span>
  );
}

function Margin({ row, sort }: { row: ReportRow; sort: CloseRaceFilters["sort"] }) {
  const votes = row.marginVotes === 0 ? "Tie" : `${fmt(row.marginVotes)} ${row.marginVotes === 1 ? "vote" : "votes"}`;
  const pts = row.marginPct == null ? "—" : `${row.marginPct.toFixed(2)} pts`;
  const [main, sub] = sort === "percent" ? [pts, votes] : [votes, pts];
  return (
    <span className="block tabular-nums">
      <span className="block font-bold text-slate-950 dark:text-white">{main}</span>
      <span className="block text-xs text-slate-500">{sub}</span>
      {row.marginChange ? (
        <span className={`block text-[11px] ${row.marginChange < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500"}`}>
          {row.marginChange > 0 ? "+" : ""}
          {fmt(row.marginChange)} since last update
        </span>
      ) : null}
    </span>
  );
}

function Share({ row }: { row: ReportRow }) {
  if (row.leaderShare == null) return <span className="text-slate-400">—</span>;
  const share = row.leaderShare * 100;
  const majority = row.decisionRule === "majority";
  return (
    <span className="block tabular-nums">
      <span className="block">{share.toFixed(1)}%</span>
      {majority ? <span className="block text-xs text-slate-500">{share - 50 >= 0 ? "+" : ""}{(share - 50).toFixed(1)} vs 50%</span> : null}
    </span>
  );
}

function Reporting({ row }: { row: ReportRow }) {
  return (
    <span className="block text-xs">
      <span className="block tabular-nums text-slate-700 dark:text-slate-300">
        {fmt(row.reportingUnits)}/{fmt(row.totalUnits)} units
      </span>
      <span className="block text-slate-500">{STATUS_LABELS[row.resultStatus]}</span>
    </span>
  );
}

function RankedTable({ rows, sort }: { rows: ReportRow[]; sort: CloseRaceFilters["sort"] }) {
  return (
    <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-950">
      <table className="w-full table-fixed text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-[10px] tracking-[0.1em] text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-900">
          <tr>
            <th className="w-12 px-3 py-2.5 font-bold">#</th>
            <th className="px-3 py-2.5 font-bold">Race</th>
            <th className="w-[15%] px-3 py-2.5 font-bold">Leader</th>
            <th className="w-[15%] px-3 py-2.5 font-bold">Runner-up</th>
            <th className="w-[11%] px-3 py-2.5 font-bold">Margin</th>
            <th className="w-[8%] px-3 py-2.5 font-bold">Share</th>
            <th className="w-[11%] px-3 py-2.5 font-bold">Reporting</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 align-top dark:border-slate-800">
              <td className="px-3 py-3 font-bold text-slate-400 tabular-nums">{row.rank}</td>
              <td className="px-3 py-3">
                <RaceName row={row} />
                <div className="mt-2 space-y-2">
                  <Flags row={row} />
                  <ContestDetailToggle contestId={row.id} />
                </div>
              </td>
              <td className="px-3 py-3">
                <Candidate name={row.leaderName} party={row.leaderParty} incumbent={row.leaderIncumbent} votes={row.leaderVotes} />
              </td>
              <td className="px-3 py-3">
                <Candidate name={row.runnerUpName} party={row.runnerUpParty} incumbent={row.runnerUpIncumbent} votes={row.runnerUpVotes} />
              </td>
              <td className="px-3 py-3">
                <Margin row={row} sort={sort} />
              </td>
              <td className="px-3 py-3">
                <Share row={row} />
              </td>
              <td className="px-3 py-3">
                <Reporting row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankedCards({ rows, sort }: { rows: ReportRow[]; sort: CloseRaceFilters["sort"] }) {
  return (
    <ol className="space-y-3 md:hidden">
      {rows.map((row) => (
        <li key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start gap-3">
            <span className="font-bold text-slate-400 tabular-nums">{row.rank}</span>
            <div className="min-w-0 flex-1">
              <RaceName row={row} />
            </div>
            <div className="shrink-0 text-right">
              <Margin row={row} sort={sort} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Candidate name={row.leaderName} party={row.leaderParty} incumbent={row.leaderIncumbent} votes={row.leaderVotes} />
            <Candidate name={row.runnerUpName} party={row.runnerUpParty} incumbent={row.runnerUpIncumbent} votes={row.runnerUpVotes} />
          </div>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
            <Reporting row={row} />
            <Share row={row} />
          </div>
          <div className="mt-2 space-y-2">
            <Flags row={row} />
            <ContestDetailToggle contestId={row.id} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function NameList({ rows }: { rows: ReportRow[] }) {
  return (
    <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <li key={r.id} className="min-w-0 truncate text-slate-700 dark:text-slate-300">
          {r.name}
          {r.county ? <span className="text-slate-400"> · {r.county}</span> : null}
          {r.leaderName ? <span className="text-slate-400"> · {r.leaderName}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function CoverageTable({ rows }: { rows: CloseRacesData["coverage"]["rows"] }) {
  const order = { missing: 0, partial: 1, unverified: 2, complete: 3 };
  const sorted = [...rows].sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full min-w-[32rem] text-left text-xs">
        <thead className="sticky top-0 bg-white text-[10px] tracking-wide text-slate-400 uppercase dark:bg-slate-950">
          <tr>
            <th className="py-1 pr-3 font-semibold">Jurisdiction</th>
            <th className="py-1 pr-3 font-semibold">Status</th>
            <th className="py-1 pr-3 text-right font-semibold">Observed</th>
            <th className="py-1 pr-3 text-right font-semibold">Expected</th>
            <th className="py-1 pr-3 font-semibold">Notes</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-1 pr-3">{r.name}</td>
              <td className="py-1 pr-3 capitalize">{r.status}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{fmt(r.observed)}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{fmt(r.expected)}</td>
              <td className="py-1 pr-3 text-slate-500">
                {r.notes}
                {r.resultsUrl ? (
                  <>
                    {r.notes ? " · " : ""}
                    <a href={r.resultsUrl} className="text-rose-600 hover:underline" rel="noreferrer" target="_blank">
                      local results
                    </a>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OperatorPanel({ election, alerts }: { election: TrackedElection; alerts: { id: string; severity: string; message: string; createdAt: string; sent: boolean }[] }) {
  return (
    <Section title={`Operator · ${alerts.length} open alerts · ${election.errorCount} fetch errors`}>
      <dl className="mb-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Fact label="Worker" value={election.workerId ?? "—"} note={election.mode} />
        <Fact label="Heartbeat" value={et(election.heartbeatAt)} />
        <Fact label="Last state fetch" value={et(election.lastStateFetchAt)} note={election.fetchSource ?? undefined} />
        <Fact label="Counties fetched" value={fmt(election.countiesFetched)} note={election.lastError ?? undefined} />
      </dl>
      <ul className="space-y-1 text-xs">
        {alerts.map((a) => (
          <li key={a.id} className="flex gap-2">
            <span className={`shrink-0 font-semibold ${a.severity === "critical" ? "text-rose-600" : a.severity === "warning" ? "text-amber-600" : "text-slate-500"}`}>{a.severity}</span>
            <span className="shrink-0 text-slate-400 tabular-nums">{et(a.createdAt)}</span>
            <span className="min-w-0 text-slate-700 dark:text-slate-300">{a.message}</span>
          </li>
        ))}
        {!alerts.length ? <li className="text-slate-500">No open alerts.</li> : null}
      </ul>
    </Section>
  );
}
