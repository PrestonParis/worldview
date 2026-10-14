import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Sparkline } from "@/components/charts/stat-tile";
import { SectionNav } from "@/components/data/section-nav";
import { StateTileNav } from "@/components/states/state-tile-nav";
import { partyName, resultStyle } from "@/lib/elections/overview";
import { formatValue } from "@/lib/format";
import { loadState, type StateFact } from "@/lib/states/data";
import { stateBySlug } from "@/lib/states/slug";
import { ratingLabel } from "@/lib/validation/raceRating";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const state = stateBySlug((await params).slug);
  if (!state) return { title: "State not found | Worldview" };
  return {
    title: `${state.name} | Worldview`,
    description: `${state.name} by the numbers: population, jobs and incomes, housing, health care, crime and guns, immigration, schools, family, religion, abortion law, federal money, climate, and election results — each compared with the U.S. and the other states.`,
  };
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

function rankText(f: StateFact) {
  if (f.rank === null || f.of < 2) return null;
  if (f.rank === 1) return `Highest of ${f.of}`;
  if (f.rank === f.of) return `Lowest of ${f.of}`;
  return `${ordinal(f.rank)} highest of ${f.of}`;
}

function FactCard({ f }: { f: StateFact }) {
  const rank = rankText(f);
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{f.label}</p>
        <p className="shrink-0 text-xs text-slate-400">{f.period}</p>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">{formatValue(f.value, f.unit, { compact: true })}</p>
        {f.spark.length > 1 && (
          <div className="w-24 shrink-0">
            <Sparkline values={f.spark} />
          </div>
        )}
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {f.us !== null && (
          <div className="flex gap-1">
            <dt>U.S.</dt>
            <dd className="font-medium text-slate-700 tabular-nums dark:text-slate-200">{formatValue(f.us, f.unit, { compact: true })}</dd>
          </div>
        )}
        {rank && <dd>{rank}</dd>}
      </dl>
      {f.note && <p className="mt-2 text-xs leading-5 text-slate-400">{f.note}</p>}
    </div>
  );
}

export default async function StatePage({ params }: Props) {
  const state = stateBySlug((await params).slug);
  if (!state) notFound();
  const { sections, politics } = await loadState(state);
  const fact = (key: string) => sections.flatMap((s) => s.facts).find((f) => f.key === key) ?? null;
  const pop = fact("census-pep|population");
  const nav = [...sections.map((s) => [s.id, s.title] as const), ["elections", "Elections"] as const];

  return (
    <div className="mx-auto max-w-7xl space-y-12">
      <header className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold tracking-[0.14em] text-blue-700 uppercase dark:text-blue-400">
            <Link href="/states" className="hover:underline">
              States
            </Link>
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">{state.name}</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">
            {pop ? `${formatValue(pop.value, "people")} people (${pop.period}), ${pop.rank !== null ? `${ordinal(pop.rank)} of ${pop.of}` : ""} by population. ` : ""}
            Every figure is the latest published, beside the U.S. figure for the same period and {state.name}&apos;s rank among the 50 states and the
            District of Columbia.
          </p>
        </div>
        <div className="max-w-sm">
          <StateTileNav current={state.abbr} />
        </div>
      </header>

      <SectionNav sections={nav} />

      {sections.map((sec) => (
        <section key={sec.id} id={sec.id} className="scroll-mt-28 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-slate-200 pt-8 dark:border-slate-800">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{sec.title}</h2>
            <Link href={sec.href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">
              {sec.linkLabel} <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sec.facts.map((f) => (
              <FactCard key={f.key} f={f} />
            ))}
            {sec.text?.map((t) => (
              <div key={t.label} className="flex flex-col rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t.label}</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{t.value}</p>
                {t.note && <p className="mt-2 text-xs text-slate-400">{t.note}</p>}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section id="elections" className="scroll-mt-28 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-slate-200 pt-8 dark:border-slate-800">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Elections</h2>
          <div className="flex flex-wrap gap-4">
            <Link href={`/elections?electorate=${state.fips}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">
              Elections <ArrowRight size={14} aria-hidden />
            </Link>
            <Link href="/my-government" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">
              Your officials <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Presidential results</h3>
            {politics.presidential.length ? (
              <ul className="mt-3 space-y-2">
                {politics.presidential.map((r) => {
                  const style = resultStyle(r.winnerParty, r.marginPct);
                  return (
                    <li key={r.cycle} className="flex items-center gap-3 text-sm">
                      <span className="w-10 font-medium text-slate-500 tabular-nums">{r.cycle}</span>
                      <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ background: style.fill, color: style.text }}>
                        {r.winnerParty ?? "—"}
                        {r.marginPct !== null ? `+${r.marginPct.toFixed(1)}` : ""}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200">
                        {r.winnerName} <span className="text-slate-400">({partyName(r.winnerParty)})</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No results loaded.</p>
            )}
            <p className="mt-3 text-xs text-slate-400">Margin is the winner&apos;s lead in percentage points of the total vote.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">On the ballot{politics.cycle ? ` in ${politics.cycle}` : ""}</h3>
            {politics.upcoming.length ? (
              <ul className="mt-3 space-y-2">
                {politics.upcoming.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <Link href={`/elections/${r.id}`} className="font-medium text-slate-900 hover:underline dark:text-white">
                      {r.name}
                    </Link>
                    {r.rating && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{ratingLabel(r.rating)}</span>}
                    {r.incumbent && (
                      <span className="text-xs text-slate-500">
                        Held by {r.incumbent.name}
                        {r.incumbent.party ? ` (${r.incumbent.party})` : ""}
                        {r.openSeat ? " · open seat" : ""}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No Senate or governor&apos;s race scheduled.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
