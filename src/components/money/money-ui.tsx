import type { ReactNode } from "react";
import Link from "next/link";
import { formatValue } from "@/lib/format";
import { FollowMoneyMenu } from "@/components/money/follow-money-menu";
import type { CampaignCandidate, Race } from "@/lib/db/moneyOverview";
import { FUNDING_SOURCES, MONEY_COLORS, partyColor, partyLetter } from "@/lib/money/semantic";
import { Term } from "./term";
import { FeatureList } from "@/components/ui/feature-list";
import { publicEntityPath } from "@/lib/people/public";

// Shared building blocks for the /money views. Each has one job and one
// visual form: headline numbers are unboxed, rankings are compact lists,
// investigations get a framed canvas, and raw records get their own page.

export const usd = (v: number) => formatValue(v, "usd", { compact: true });
export function pct(part: number, whole: number): string {
  if (!(whole > 0)) return "—";
  const p = (part / whole) * 100;
  return p > 0 && p < 0.5 ? "<1%" : `${Math.round(p)}%`;
}
export function shortDate(iso: string): string {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
}

export const MONEY_SOURCES = {
  fec: { label: "Federal Election Commission (OpenFEC)", href: "https://www.fec.gov/data/" },
  lda: { label: "U.S. Senate Lobbying Disclosure Act filings", href: "https://lda.senate.gov/" },
  ie: { label: "FEC Schedule E independent expenditures", href: "https://www.fec.gov/data/independent-expenditures/" },
};

export function withCycle(href: string, cycle: number | null, latest: number | null): string {
  if (cycle == null || cycle === latest) return href;
  const [path, hash] = href.split("#");
  return `${path}${path.includes("?") ? "&" : "?"}cycle=${cycle}${hash ? `#${hash}` : ""}`;
}

// Page header shared by every /money view: title, a few feature points, and the
// cycle every number below is scoped to.
export function MoneyHeader({
  title,
  features,
  cycle,
  cycles,
  basePath,
  extra,
}: {
  title: string;
  features?: ReactNode[];
  cycle?: number | null;
  cycles?: number[];
  basePath?: string;
  extra?: ReactNode;
}) {
  return (
    <header className={`flex flex-wrap justify-between gap-4 ${features?.length ? "items-end" : "items-center"}`}>
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">{title}</h1>
        {features?.length ? <FeatureList className="mt-3" items={features} /> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {extra}
        {cycle != null && cycles && basePath ? <CycleControl cycle={cycle} cycles={cycles} basePath={basePath} /> : null}
      </div>
    </header>
  );
}

function CycleControl({ cycle, cycles, basePath }: { cycle: number; cycles: number[]; basePath: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500 dark:text-slate-400">
        <Term k="cycle" />
      </span>
      <div role="group" aria-label="Election cycle" className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-800">
        {cycles.map((c) => {
          const on = c === cycle;
          return (
            <Link
              key={c}
              href={withCycle(basePath, c, cycles[0])}
              aria-current={on ? "page" : undefined}
              className={`rounded-md px-3 py-1 font-medium tabular-nums ${
                on ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {c}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// A small chip stating exactly what a view covers.
export function Coverage({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="inline-flex flex-wrap items-baseline gap-x-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
      <span className="font-semibold text-slate-800 dark:text-slate-100">{label}:</span>
      {children}
    </p>
  );
}

export function MoneySection({
  id,
  title,
  intro,
  action,
  aside,
  children,
}: {
  id?: string;
  title: string;
  intro?: ReactNode;
  action?: { href: string; label: string };
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
          {intro ? <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">{intro}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {aside}
          {action ? (
            <Link href={action.href} className="shrink-0 text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
              {action.label} →
            </Link>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

// Headline numbers: unboxed, divided, one statistical universe each.
export function Snapshot({ items }: { items: { label: ReactNode; value: string; detail: ReactNode; color?: string; href?: string }[] }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-2xl bg-slate-200 sm:grid-cols-2 lg:grid-cols-4 dark:bg-slate-800">
      {items.map((it, i) => (
        <div key={i} className="flex flex-col bg-white p-5 dark:bg-slate-950">
          <dt className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            {it.color ? <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: it.color }} /> : null}
            {it.label}
          </dt>
          <dd className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">{it.value}</dd>
          <dd className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{it.detail}</dd>
          {it.href ? (
            <dd className="mt-auto pt-3">
              <Link href={it.href} className="text-xs font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
                Explore →
              </Link>
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

export interface RankRow {
  key: string;
  label: ReactNode;
  sub?: ReactNode;
  value: number;
  display?: string; // overrides the formatted value
  color: string;
  href?: string;
}

// A compact ranking: label, thin proportional bar, value. Used where a full
// chart card would be too much.
export function RankList({ rows, limit = 5, unit = "usd", empty = "None recorded." }: { rows: RankRow[]; limit?: number; unit?: string; empty?: string }) {
  const shown = rows.slice(0, limit);
  if (!shown.length) return <p className="py-4 text-sm text-slate-500 dark:text-slate-400">{empty}</p>;
  const max = Math.max(...shown.map((r) => r.value), 1);
  return (
    <ol className="divide-y divide-slate-100 dark:divide-slate-900">
      {shown.map((r, i) => (
        <li key={r.key} className="py-2.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="w-4 shrink-0 text-right text-xs text-slate-400 tabular-nums">{i + 1}</span>
              {r.href ? (
                <Link href={r.href} className="min-w-0 truncate font-medium text-slate-800 hover:underline dark:text-slate-100">
                  {r.label}
                </Link>
              ) : (
                <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">{r.label}</span>
              )}
              {r.sub ? <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{r.sub}</span> : null}
            </span>
            <span className="shrink-0 font-medium text-slate-900 tabular-nums dark:text-white">{r.display ?? formatValue(r.value, unit, { compact: true })}</span>
          </div>
          <div className="mt-1.5 ml-6 h-1.5 rounded-full bg-slate-100 dark:bg-slate-900">
            <div className="h-1.5 rounded-full" style={{ width: `${Math.max(1, (r.value / max) * 100)}%`, background: r.color }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function candidateTag(c: { party: string; state: string; office: string; district: string }): string {
  const seat = c.office === "H" && c.district && c.district !== "00" ? `${c.state}-${Number(c.district)}` : c.state;
  return [partyLetter(c.party), seat].filter(Boolean).join("-");
}

export function fundingParts(c: { receipts: number; individual: number; pac: number; party_: number }) {
  const other = Math.max(0, c.receipts - c.individual - c.pac - c.party_);
  return FUNDING_SOURCES.map((s) => ({ ...s, value: s.key === "individual" ? c.individual : s.key === "pac" ? c.pac : s.key === "party" ? c.party_ : other }));
}

// Part-to-whole for campaign receipts: one stacked bar, 2px gaps, legend
// with shares.
export function MixBar({ c, legend = true, height = "h-3" }: { c: { receipts: number; individual: number; pac: number; party_: number }; legend?: boolean; height?: string }) {
  const parts = fundingParts(c);
  return (
    <div>
      <div className={`flex ${height} gap-0.5 overflow-hidden rounded`}>
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <span key={p.key} title={`${p.label}: ${formatValue(p.value, "usd")} (${pct(p.value, c.receipts)})`} style={{ width: `${(p.value / (c.receipts || 1)) * 100}%`, background: p.color }} />
          ))}
      </div>
      {legend ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
              {p.short}
              <span className="text-slate-500 tabular-nums dark:text-slate-400">{pct(p.value, c.receipts)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// Outside spending per target: opposition grows left, support right, from a
// shared zero line, so the two never stack into one misleading total.
export function SupportOpposeBars({
  rows,
  limit = 10,
}: {
  rows: { key: string; label: ReactNode; sub?: ReactNode; support: number; oppose: number; href?: string }[];
  limit?: number;
}) {
  const shown = rows.slice(0, limit);
  if (!shown.length) return <p className="py-4 text-sm text-slate-500 dark:text-slate-400">No independent expenditures recorded.</p>;
  const max = Math.max(1, ...shown.flatMap((r) => [r.support, r.oppose]));
  return (
    <div>
      <div className="mb-2 grid grid-cols-[minmax(0,10rem)_1fr_1fr] gap-x-2 text-[11px] font-medium tracking-wide text-slate-400 uppercase sm:grid-cols-[minmax(0,14rem)_1fr_1fr]">
        <span />
        <span className="flex items-center justify-end gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: MONEY_COLORS.oppose }} />
          Opposing
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: MONEY_COLORS.support }} />
          Supporting
        </span>
      </div>
      <ol className="space-y-2">
        {shown.map((r) => (
          <li
            key={r.key}
            className="grid grid-cols-[minmax(0,10rem)_1fr_1fr] items-center gap-x-2 text-sm sm:grid-cols-[minmax(0,14rem)_1fr_1fr]"
            title={`Supporting ${formatValue(r.support, "usd")} · Opposing ${formatValue(r.oppose, "usd")}`}
          >
            <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">
              {r.href ? (
                <Link href={r.href} className="hover:underline">
                  {r.label}
                </Link>
              ) : (
                r.label
              )}
              {r.sub ? <span className="ml-1.5 text-xs text-slate-400">{r.sub}</span> : null}
            </span>
            <span className="flex items-center justify-end gap-1.5 border-r border-slate-300 pr-0.5 dark:border-slate-700">
              {r.oppose > 0 ? <span className="text-xs text-slate-600 tabular-nums dark:text-slate-300">{usd(r.oppose)}</span> : null}
              <span className="h-3.5 rounded-l" style={{ width: `${(r.oppose / max) * 80}%`, background: MONEY_COLORS.oppose }} />
            </span>
            <span className="flex items-center gap-1.5 pl-0.5">
              <span className="h-3.5 rounded-r" style={{ width: `${(r.support / max) * 80}%`, background: MONEY_COLORS.support }} />
              {r.support > 0 ? <span className="text-xs text-slate-600 tabular-nums dark:text-slate-300">{usd(r.support)}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// The two campaigns a race is decided between: the leading Democrat and
// Republican by money raised, or the top two when a side has no candidate.
export function raceLeaders(race: Race): CampaignCandidate[] {
  const d = race.candidates.find((c) => partyLetter(c.party) === "D");
  const r = race.candidates.find((c) => partyLetter(c.party) === "R");
  if (d && r) return [d, r];
  return race.candidates.slice(0, 2);
}

// One race, compared: who has raised and banked more, and what outside
// groups are spending.
export function RaceCard({ race, cycle, latest }: { race: Race; cycle: number | null; latest: number | null }) {
  const leaders = raceLeaders(race);
  const others = race.candidates.length - leaders.length;
  const max = Math.max(1, ...leaders.map((c) => c.receipts));
  const [a, b] = leaders;
  const gap = a && b ? a.receipts - b.receipts : 0;
  const ahead = gap >= 0 ? a : b;
  const outside = race.support + race.oppose;
  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">{race.label}</h3>
          <p className="mt-0.5 text-xs text-slate-500 tabular-nums dark:text-slate-400">
            {usd(race.raised)} raised{outside > 0 ? ` · ${usd(outside)} outside spending` : ""}
          </p>
        </div>
        {ahead && b ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 tabular-nums dark:bg-slate-900 dark:text-slate-200">
            <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: partyColor(ahead.party) }} />
            {partyLetter(ahead.party) || ahead.name} +{usd(Math.abs(gap))}
          </span>
        ) : null}
      </header>
      <ul className="mt-4 space-y-3">
        {leaders.map((c) => (
          <li key={c.entityId}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <Link href={publicEntityPath({ id: c.entityId, name: c.name })} className="min-w-0 truncate font-medium text-slate-800 hover:underline dark:text-slate-100">
                {c.name}
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  {partyLetter(c.party)}
                  {c.incumbentChallenge === "I" ? " · incumbent" : ""}
                </span>
              </Link>
              <span className="shrink-0 font-medium text-slate-900 tabular-nums dark:text-white">{usd(c.receipts)}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-slate-900">
              <div className="h-2 rounded-full" style={{ width: `${Math.max(1, (c.receipts / max) * 100)}%`, background: partyColor(c.party) }} />
            </div>
            <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
              {usd(c.cashOnHand)} cash on hand · {pct(c.individual, c.receipts)} from individuals
            </p>
          </li>
        ))}
      </ul>
      <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs">
        {others > 0 ? <span className="text-slate-400">+{others} other candidate{others === 1 ? "" : "s"}</span> : null}
        <span className="ml-auto flex gap-4">
          <FollowMoneyMenu
            label="Follow the money →"
            className="font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
            options={race.candidates
              .filter((c) => ["D", "R"].includes(partyLetter(c.party)))
              .map((c) => ({
                href: withCycle(`/money?candidate=${c.entityId}#follow`, cycle, latest),
                name: c.name,
                party: partyLetter(c.party),
                color: partyColor(c.party),
                raised: usd(c.receipts),
              }))}
          />
          {race.electionId ? (
            <Link href={`/elections/${race.electionId}`} className="font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
              View race →
            </Link>
          ) : null}
        </span>
      </footer>
    </article>
  );
}
