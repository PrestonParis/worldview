"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SortTh, useTableSort } from "@/components/data/sortable-table";
import { SearchInput } from "@/components/search/search-input";
import { MyRaceTag, useIsMyRace } from "@/components/my-government/highlights";
import { useMyGovernment } from "@/components/my-government/use-my-government";
import { US_STATE_GRID, US_STATE_GRID_COLS, US_STATE_GRID_ROWS, US_STATE_NAMES } from "@/lib/money/us-states";
import {
  HANDICAPPERS,
  OFFICES,
  RATING_ORDER,
  RATING_STYLE,
  partyName,
  resultStyle,
  type CycleSummary,
  type OfficeKey,
  type PartyLetter,
  type RaceSummary,
  type SearchEntry,
} from "@/lib/elections/overview";
import { ratingLabel, type Rating } from "@/lib/validation/raceRating";
import type { ChamberProjection } from "@/lib/elections/control";

const SEARCH_LIMIT = 40;
// Safe columns list races as compact chips; past this many they collapse.
const CHIP_PREVIEW = 18;
const PARTY_DOT: Record<PartyLetter, string> = { D: "#2166AC", R: "#B2182B", I: "#64748B" };

function href(cycle: number, office: OfficeKey): string {
  return `/elections?cycle=${cycle}&office=${office}`;
}

function PartyDot({ party }: { party: PartyLetter | null }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: party ? PARTY_DOT[party] : "#94A3B8" }}
      aria-label={partyName(party)}
    />
  );
}

// ------------------------------------------------------------ navigation

function CycleBar({ cycles, cycle, office }: { cycles: CycleSummary[]; cycle: number; office: OfficeKey }) {
  return (
    <nav aria-label="Election year" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {cycles.map((item) => {
        const active = item.cycle === cycle;
        // Keep the office when the other year has it, else that year's first.
        const target = item.offices[office] ? office : (OFFICES.find((o) => item.offices[o.key])?.key ?? "senate");
        return (
          <Link
            key={item.cycle}
            href={href(item.cycle, target)}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 font-mono text-sm tabular-nums transition-colors ${
              active
                ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
            }`}
          >
            {item.cycle}
            {item.upcoming ? <span className="ml-1.5 text-[10px] font-sans font-semibold uppercase tracking-wide opacity-70">Upcoming</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function OfficeTabs({ summary, office }: { summary: CycleSummary; office: OfficeKey }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
      {OFFICES.filter((item) => summary.offices[item.key]).map((item) => {
        const active = item.key === office;
        return (
          <Link
            key={item.key}
            href={href(summary.cycle, item.key)}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-slate-950 text-slate-950 dark:border-white dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {item.label}
            <span className="ml-1.5 font-mono text-xs tabular-nums text-slate-400">{summary.offices[item.key]}</span>
          </Link>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------ upcoming

const CHAMBER_LABEL: Record<string, string> = { senate: "Senate", house: "House", governor: "Governorships" };
const CHAMBER_TOTAL: Record<string, number> = { senate: 100, house: 435, governor: 50 };

function ControlBar({ projection }: { projection: ChamberProjection }) {
  const { projected, majority, current } = projection;
  const total = projected.D + projected.I + projected.tossup + projected.R;
  const unfilledCurrent = Math.max(0, (CHAMBER_TOTAL[projection.chamber] ?? 0) - current.D - current.R - current.I);
  const segments: Array<{ key: string; seats: number; fill: string; label: string }> = [
    { key: "D", seats: projected.D, fill: PARTY_DOT.D, label: "Democrats" },
    { key: "I", seats: projected.I, fill: PARTY_DOT.I, label: "Independents" },
    { key: "T", seats: projected.tossup, fill: RATING_STYLE.tossup.fill, label: "Toss-up" },
    { key: "R", seats: projected.R, fill: PARTY_DOT.R, label: "Republicans" },
  ];
  const leader = projection.projectedControl;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">Balance of power: {CHAMBER_LABEL[projection.chamber]}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Current {projection.chamber === "governor" ? "governorships" : "chamber"}: {current.D} D, {current.R} R
            {current.I ? `, ${current.I} I` : ""}
            {unfilledCurrent ? `, ${unfilledCurrent} vacant or not identified` : ""}
            {` · ${projection.seatsUp} seats on the ballot`}
          </p>
        </div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {leader ? `Ratings imply ${partyName(leader)} control` : "Control remains undecided"}
        </p>
      </div>

      <div className="relative mt-4">
        <div className="flex h-7 overflow-hidden rounded-md" role="img" aria-label={segments.map((s) => `${s.label} ${s.seats}`).join(", ")}>
          {segments.filter((s) => s.seats > 0).map((s, index) => (
            <div
              key={s.key}
              className={index > 0 ? "border-l-2 border-white dark:border-slate-950" : ""}
              style={{ width: `${(s.seats / total) * 100}%`, background: s.fill }}
            />
          ))}
        </div>
        <div
          className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-slate-900 dark:bg-white"
          style={{ left: `${(majority / total) * 100}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        {segments.filter((s) => s.seats > 0).map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.fill }} />
            {s.label} <span className="font-mono font-semibold tabular-nums">{s.seats}</span>
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
        The bar combines seats not on the ballot with the consensus rating for each contested seat. The marker shows {majority} seats, the control threshold. Independents are shown separately.
      </p>
    </section>
  );
}

const SHORT_PARTY: Record<PartyLetter, string> = { D: "D", R: "R", I: "I" };
const SOURCE_SHORT: Record<string, string> = { cook: "Cook", "inside-elections": "IE", sabato: "Sabato" };

// "Cook, Inside Elections and Sabato as of Oct 6" — newest call shown.
function ratingsCredit(races: RaceSummary[]): string | null {
  const dates = races.flatMap((race) => race.ratings.map((item) => item.asOf)).sort();
  if (!dates.length) return null;
  const latest = new Date(`${dates.at(-1)}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `Median of Cook, Inside Elections and Sabato · latest update ${latest}`;
}

function raceTitle(race: RaceSummary): string {
  const state = race.stateAbbr ? US_STATE_NAMES[race.stateAbbr] : null;
  if (race.code.includes("-")) return race.code; // House district
  return `${state ?? race.code}${race.special ? " (special)" : ""}`;
}

// "Jon Ossoff (D) vs. Mike Collins (R)" — the major-party matchup.
function matchup(race: RaceSummary): string {
  const major = race.nominees.filter((n) => n.party);
  if (!major.length) return race.incumbent ? `${race.incumbent.name} (incumbent)` : "";
  return major.map((n) => `${n.name} (${n.party})`).join(" vs. ");
}

function RaceCard({ race }: { race: RaceSummary }) {
  const major = race.nominees.filter((n) => n.party);
  const others = race.nominees.length - major.length;
  const mine = useIsMyRace(race.code);
  return (
    <Link
      href={`/elections/${race.id}`}
      className={`block rounded-lg border bg-white px-3 py-2.5 transition-colors hover:border-slate-400 dark:bg-slate-950 dark:hover:border-slate-600 ${
        mine ? "border-blue-500 ring-1 ring-blue-500 dark:border-blue-400 dark:ring-blue-400" : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-sm font-semibold text-slate-950 dark:text-white">{raceTitle(race)}</span>
          <MyRaceTag code={race.code} />
        </span>
        {race.openSeat ? (
          <span className="shrink-0 rounded bg-amber-100 px-1.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Open seat
          </span>
        ) : null}
      </div>

      {major.length ? (
        <ul className="mt-1.5 space-y-0.5">
          {major.map((nominee, index) => (
            <li key={`${index}-${nominee.name}`} className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
              <PartyDot party={nominee.party} />
              <span className="truncate">{nominee.name}</span>
              <span className="text-slate-400">({SHORT_PARTY[nominee.party!]})</span>
              {nominee.incumbent ? <span className="text-[10px] uppercase tracking-wide text-slate-400">inc.</span> : null}
            </li>
          ))}
        </ul>
      ) : race.incumbent ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <PartyDot party={race.incumbent.party} />
          <span className="truncate">{race.incumbent.name}</span>
          <span className="text-[10px] uppercase tracking-wide text-slate-400">inc.</span>
        </p>
      ) : null}

      <div className="mt-1.5 flex flex-wrap gap-x-2 text-[10px] text-slate-400">
        {race.openSeat && race.incumbent ? <span>Incumbent {race.incumbent.name} not on the ballot</span> : null}
        {others > 0 ? <span>+{others} other{others > 1 ? "s" : ""} on ballot</span> : null}
      </div>
      {race.ratings.length > 1 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {race.ratings.map((item) => (
            <span
              key={item.source}
              className="rounded px-1 text-[10px] font-medium"
              style={{ background: RATING_STYLE[item.rating].fill, color: RATING_STYLE[item.rating].text }}
              title={`${HANDICAPPERS.find((h) => h.id === item.source)?.label ?? item.source}, ${item.asOf}`}
            >
              {SOURCE_SHORT[item.source] ?? item.source} {ratingLabel(item.rating)}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

function RaceChip({ race }: { race: RaceSummary }) {
  const mine = useIsMyRace(race.code);
  return (
    <Link
      href={`/elections/${race.id}`}
      title={[raceTitle(race), matchup(race), race.openSeat ? "open seat" : "", mine ? "on your ballot" : ""].filter(Boolean).join(" · ")}
      className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${
        mine
          ? "border-blue-600 bg-blue-600 font-semibold text-white hover:bg-blue-700 dark:border-blue-400 dark:bg-blue-500"
          : "border-slate-200 text-slate-700 hover:border-slate-400 hover:text-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
      }`}
    >
      {race.code}
      {race.special ? "*" : ""}
    </Link>
  );
}

// Safe seats as compact, expandable rows of race codes — the competitive
// races above carry the detail.
function SafeSeats({ races }: { races: RaceSummary[] }) {
  const [expanded, setExpanded] = useState<Rating | null>(null);
  const groups = RATING_ORDER.filter((rating) => rating.startsWith("safe"))
    .map((rating) => [rating, races.filter((race) => race.rating === rating)] as const)
    .filter(([, list]) => list.length > 0);
  const unrated = races.filter((race) => !race.rating);
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-slate-950 dark:text-white">Safe seats</h2>
      {groups.map(([rating, list]) => {
        const open = expanded === rating;
        const shown = open ? list : list.slice(0, CHIP_PREVIEW);
        return (
          <div key={rating} className="flex flex-wrap items-center gap-1">
            <span
              className="mr-1 rounded px-1.5 py-0.5 text-xs font-semibold"
              style={{ background: RATING_STYLE[rating].fill, color: RATING_STYLE[rating].text }}
            >
              {ratingLabel(rating)} {list.length}
            </span>
            {shown.map((race) => <RaceChip key={race.id} race={race} />)}
            {list.length > CHIP_PREVIEW ? (
              <button
                type="button"
                onClick={() => setExpanded(open ? null : rating)}
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                {open ? <>Fewer <ChevronUp size={11} /></> : <>+{list.length - CHIP_PREVIEW} more <ChevronDown size={11} /></>}
              </button>
            ) : null}
          </div>
        );
      })}
      {unrated.length ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-slate-500">Not yet rated</span>
          {unrated.map((race) => <RaceChip key={race.id} race={race} />)}
        </div>
      ) : null}
    </section>
  );
}

function CompetitiveList({ races, officeLabel, wide = false }: { races: RaceSummary[]; officeLabel: string; wide?: boolean }) {
  const competitive = RATING_ORDER.filter((rating) => !rating.startsWith("safe"))
    .map((rating) => [rating, races.filter((race) => race.rating === rating)] as const)
    .filter(([, list]) => list.length > 0);
  const safe = races.filter((race) => race.rating?.startsWith("safe")).length;
  const competitiveCount = races.length - safe;
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-950 dark:text-white">{officeLabel} battlegrounds</h2>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        {competitiveCount} {competitiveCount === 1 ? "race is" : "races are"} competitive; {safe} rated safe{wide ? "" : ". Select any state on the map"}
        {ratingsCredit(races) ? <><br />{ratingsCredit(races)}</> : null}
      </p>
      {competitive.length === 0 ? (
        <p className="text-sm text-slate-500">Every race is rated safe.</p>
      ) : (
        <div className="space-y-4">
          {competitive.map(([rating, list]) => (
            <div key={rating}>
              <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span className="h-3 w-3 rounded-sm" style={{ background: RATING_STYLE[rating].fill }} />
                {ratingLabel(rating)}
                <span className="font-mono font-normal text-slate-400">{list.length}</span>
              </p>
              <div className={`grid gap-1.5 sm:grid-cols-2 ${wide ? "lg:grid-cols-3 xl:grid-cols-4" : ""}`}>
                {list.map((race) => <RaceCard key={race.id} race={race} />)}
              </div>
            </div>
          ))}
        </div>
      )}
      {races.some((race) => race.rating && !race.ratingPublished) ? (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Races without a published rating are placed as Safe for the party that holds the seat.
        </p>
      ) : null}
      <details className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">How race ratings work</summary>
        <p className="mt-2 leading-5">Ratings describe which party is more likely to win, not a predicted vote margin. Safe means the outcome is not considered seriously competitive. Likely indicates a clear favorite. Lean indicates a competitive race with a discernible favorite. Toss-up means no clear favorite. Worldview uses the median of the latest available Cook, Inside Elections, and Sabato ratings.</p>
      </details>
    </section>
  );
}

// ------------------------------------------------------------ state map

function StateTiles({
  races,
  styleFor,
  describe,
}: {
  races: RaceSummary[];
  styleFor: (race: RaceSummary) => { fill: string; text: string } | null;
  describe: (race: RaceSummary) => string;
}) {
  const myState = useMyGovernment()?.stateCode;
  const byState = new Map<string, RaceSummary[]>();
  for (const race of races) {
    if (race.stateAbbr) byState.set(race.stateAbbr, [...(byState.get(race.stateAbbr) ?? []), race]);
  }
  return (
    <div
      className="grid gap-1"
      style={{
        gridTemplateColumns: `repeat(${US_STATE_GRID_COLS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${US_STATE_GRID_ROWS}, auto)`,
      }}
      role="list"
      aria-label="Races by state"
    >
      {US_STATE_GRID.map((cell) => {
        const list = byState.get(cell.abbr) ?? [];
        const main = list.find((race) => !race.special) ?? list[0];
        const style = main ? styleFor(main) : null;
        const common = "flex aspect-square flex-col items-center justify-center rounded-md text-[11px] font-semibold sm:text-xs";
        const position = { gridRow: cell.row + 1, gridColumn: cell.col + 1 };
        if (!main || !style) {
          return (
            <div
              key={cell.abbr}
              role="listitem"
              style={position}
              className={`${common} border border-dashed border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-700`}
              title={`${cell.name}: no race`}
            >
              {cell.abbr}
            </div>
          );
        }
        return (
          <Link
            key={cell.abbr}
            role="listitem"
            href={`/elections/${main.id}`}
            title={[...list.map(describe), cell.abbr === myState ? "Your state" : ""].filter(Boolean).join("\n")}
            style={{ ...position, background: style.fill, color: style.text }}
            className={`${common} relative transition-transform hover:z-10 hover:scale-110 hover:shadow-md ${
              cell.abbr === myState ? "z-10 ring-2 ring-slate-950 ring-offset-2 ring-offset-[var(--background)] dark:ring-white" : ""
            }`}
          >
            {cell.abbr}
            {list.length > 1 ? (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-label="Also a special election" />
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

function ResultsLegend() {
  const rows: Array<[string, PartyLetter]> = [["Democrat", "D"], ["Republican", "R"]];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
      {rows.map(([label, party]) => (
        <span key={party} className="inline-flex items-center gap-1.5">
          {label} by
          {[2, 10, 20].map((margin) => (
            <span key={margin} className="h-3 w-4 rounded-sm" style={{ background: resultStyle(party, margin).fill }} />
          ))}
          <span className="text-slate-400">&lt;5 · 5–15 · 15+ pts</span>
        </span>
      ))}
    </div>
  );
}

function RatingLegend({ races }: { races: RaceSummary[] }) {
  const present = new Set(races.map((race) => race.rating));
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
      {RATING_ORDER.filter((rating) => present.has(rating)).map((rating) => (
        <span key={rating} className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: RATING_STYLE[rating].fill }} />
          {ratingLabel(rating)}
        </span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ results

function ResultsTable({ races }: { races: RaceSummary[] }) {
  // Closest races first.
  const { sorted, sort, toggle } = useTableSort(
    races,
    (race, col) => [race.code.toLowerCase(), race.result?.winnerName.toLowerCase() ?? null, race.result?.marginPct ?? null][col],
    { col: 2, dir: 1 },
  );
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <tr>
          <SortTh col={0} sort={sort} onSort={toggle} className="py-2 pr-3 font-medium">Race</SortTh>
          <SortTh col={1} sort={sort} onSort={toggle} className="py-2 pr-3 font-medium">Winner</SortTh>
          <SortTh col={2} sort={sort} onSort={toggle} align="right" className="py-2 font-medium">Margin</SortTh>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
        {sorted.map((race) => (
          <tr key={race.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
            <td className="py-2 pr-3">
              <Link href={`/elections/${race.id}`} className="hover:underline">
                <span className="font-mono text-xs font-semibold">{race.code}</span>
                {race.special ? <span className="ml-1.5 text-xs text-slate-500">special</span> : null}
              </Link>
              <span className="ml-1.5"><MyRaceTag code={race.code} /></span>
            </td>
            <td className="py-2 pr-3">
              {race.result ? (
                <span className="flex items-center gap-1.5">
                  <PartyDot party={race.result.winnerParty} />
                  <span className="truncate text-slate-800 dark:text-slate-200">{race.result.winnerName}</span>
                </span>
              ) : (
                <span className="text-xs text-slate-400">No results recorded</span>
              )}
            </td>
            <td className="py-2 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
              {race.result?.marginPct != null ? `+${race.result.marginPct.toFixed(1)}` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ResultsSummary({ races, office }: { races: RaceSummary[]; office: OfficeKey }) {
  const national = races.find((race) => race.code === "US");
  const states = races.filter((race) => race.code !== "US");
  const wins: Record<string, number> = {};
  for (const race of states) {
    const party = race.result?.winnerParty ?? "?";
    wins[party] = (wins[party] ?? 0) + 1;
  }
  const unit = office === "president" ? "states" : "seats";
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {national?.result ? (
        <Link href={`/elections/${national.id}`} className="flex items-center gap-2 hover:underline">
          <PartyDot party={national.result.winnerParty} />
          <span className="font-semibold text-slate-950 dark:text-white">{national.result.winnerName}</span>
          {national.result.marginPct != null ? (
            <span className="font-mono text-sm tabular-nums text-slate-500">
              +{national.result.marginPct.toFixed(1)} pts nationally
            </span>
          ) : null}
        </Link>
      ) : null}
      {(["D", "R", "I"] as const).filter((party) => wins[party]).map((party) => (
        <span key={party} className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          <PartyDot party={party} />
          {partyName(party)}s won <span className="font-mono font-semibold tabular-nums">{wins[party]}</span> {unit}
        </span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ search

function SearchResults({ entries, query }: { entries: SearchEntry[]; query: string }) {
  const q = query.trim().toLowerCase();
  const matches = entries.filter(
    (entry) =>
      entry.name.toLowerCase().includes(q) ||
      entry.jurisdiction.toLowerCase().includes(q) ||
      String(entry.cycle) === q,
  );
  if (matches.length === 0) {
    return <p className="text-sm text-slate-500">No races match “{query}”.</p>;
  }
  return (
    <div>
      <p className="mb-2 text-xs text-slate-500">
        {matches.length > SEARCH_LIMIT ? `First ${SEARCH_LIMIT} of ${matches.length} races — add a year or state to narrow` : `${matches.length} races`}
      </p>
      <ul className="grid gap-x-6 sm:grid-cols-2">
        {matches.slice(0, SEARCH_LIMIT).map((entry) => (
          <li key={entry.id} className="border-b border-slate-100 dark:border-slate-900">
            <Link href={`/elections/${entry.id}`} className="flex items-baseline justify-between gap-3 py-2 hover:underline">
              <span className="truncate text-sm text-slate-800 dark:text-slate-200">{entry.name}</span>
              <span className="shrink-0 text-xs text-slate-400">{entry.office}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------ page

export function ElectionsExplorer({
  cycles,
  cycle,
  office,
  races,
  projection,
  searchEntries,
}: {
  cycles: CycleSummary[];
  cycle: number;
  office: OfficeKey;
  races: RaceSummary[];
  projection: ChamberProjection | null;
  searchEntries: SearchEntry[];
}) {
  const [query, setQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [seatFilter, setSeatFilter] = useState("all");
  const summary = cycles.find((item) => item.cycle === cycle) ?? cycles[0];
  const upcoming = races.some((race) => race.status === "scheduled");
  const officeLabel = OFFICES.find((item) => item.key === office)?.label ?? "";
  const mapped = office !== "house";
  const visibleRaces = races.filter((race) => {
    if (ratingFilter === "competitive" && (!race.rating || race.rating.startsWith("safe"))) return false;
    if (ratingFilter === "tossup" && race.rating !== "tossup") return false;
    if (seatFilter === "open" && !race.openSeat) return false;
    if (seatFilter === "incumbent" && race.openSeat) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <SearchInput value={query} onChange={setQuery} placeholder="Search any race, state or year…" />

      {query.trim() ? (
        <SearchResults entries={searchEntries} query={query} />
      ) : (
        <>
          <div className="space-y-3">
            <CycleBar cycles={cycles} cycle={cycle} office={office} />
            <OfficeTabs summary={summary} office={office} />
          </div>

          {upcoming ? (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
                <label className="text-sm text-slate-600 dark:text-slate-300">Rating <select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)} className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="all">All races</option><option value="competitive">Competitive</option><option value="tossup">Toss-ups</option></select></label>
                <label className="text-sm text-slate-600 dark:text-slate-300">Seat <select value={seatFilter} onChange={(event) => setSeatFilter(event.target.value)} className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="all">All seats</option><option value="open">Open seats</option><option value="incumbent">Incumbent running</option></select></label>
                <span className="text-xs text-slate-500 dark:text-slate-400">Showing {visibleRaces.length} of {races.length}</span>
              </div>
              {projection ? <ControlBar projection={projection} /> : null}
              {mapped ? (
                <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <StateTiles
                      races={visibleRaces}
                      styleFor={(race) => (race.rating ? RATING_STYLE[race.rating] : null)}
                      describe={(race) =>
                        [raceTitle(race), race.rating ? ratingLabel(race.rating) : "", matchup(race), race.openSeat ? "open seat" : ""]
                          .filter(Boolean)
                          .join(" · ")
                      }
                    />
                    <RatingLegend races={visibleRaces} />
                  </div>
                  <CompetitiveList races={visibleRaces} officeLabel={officeLabel} />
                </section>
              ) : (
                <>
                  <CompetitiveList races={visibleRaces} officeLabel={officeLabel} wide />
                  <SafeSeats races={visibleRaces} />
                </>
              )}
            </>
          ) : (
            <>
              <ResultsSummary races={races} office={office} />
              <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {mapped ? (
                  <div className="mx-auto w-full max-w-3xl space-y-3 lg:col-span-2">
                    <StateTiles
                      races={races}
                      styleFor={(race) => (race.result ? resultStyle(race.result.winnerParty, race.result.marginPct) : null)}
                      describe={(race) =>
                        race.result
                          ? `${race.name} · ${race.result.winnerName} +${race.result.marginPct?.toFixed(1) ?? "?"} pts`
                          : `${race.name} · no results recorded`
                      }
                    />
                    <ResultsLegend />
                  </div>
                ) : null}
                {mapped ? null : (
                  <div className="lg:col-span-2">
                    <h2 className="mb-1 text-base font-semibold text-slate-950 dark:text-white">
                      {cycle} {officeLabel} results
                    </h2>
                    <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Closest races first · margin in percentage points</p>
                    <ResultsTable races={races.filter((race) => race.code !== "US")} />
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
