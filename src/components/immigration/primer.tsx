import type { ReactNode } from "react";
import { Term } from "@/components/ui/term";
import { formatValue } from "@/lib/format";

// "How the system works" and "How these numbers relate" — the orientation
// block at the top of /immigration. Server-rendered; numbers come from the
// page's data so every figure here matches the sections below.

const PATHWAYS: { title: string; body: ReactNode; measure: string; href: string }[] = [
  {
    title: "At the border",
    body: (
      <>
        People stopped by <Term id="cbp">CBP</Term> crossing between ports of entry, or found{" "}
        <Term id="inadmissible">inadmissible</Term> at one. What happens next depends on the legal authority used and the person&apos;s case.
      </>
    ),
    measure: "Border encounters",
    href: "#border",
  },
  {
    title: "Temporary admission",
    body: (
      <>
        Tourists, business travelers, students, and temporary workers admitted for a set purpose and period on a{" "}
        <Term id="nonimmigrant">nonimmigrant</Term> class such as B-2, F-1, or H-1B.
      </>
    ),
    measure: "Temporary admissions",
    href: "#temporary",
  },
  {
    title: "Permanent immigration",
    body: (
      <>
        People granted a <Term id="green-card">green card</Term> through family, employment, the diversity lottery, or humanitarian
        status — often years after they first arrived.
      </>
    ),
    measure: "Green cards",
    href: "#legal",
  },
  {
    title: "Humanitarian protection",
    body: (
      <>
        <Term id="refugee">Refugees</Term> approved abroad and resettled here, and people granted <Term id="asylum">asylum</Term> after
        asking for it inside the U.S. or at the border.
      </>
    ),
    measure: "Refugees & asylum",
    href: "#humanitarian",
  },
  {
    title: "Citizenship",
    body: (
      <>
        Green-card holders who later become U.S. citizens through <Term id="naturalization">naturalization</Term>.
      </>
    ),
    measure: "Naturalizations",
    href: "#citizenship",
  },
  {
    title: "Population",
    body: (
      <>
        Everyone moving in and out of the country together changes how many <Term id="foreign-born">foreign-born</Term> people live here.
        Some live here without legal status.
      </>
    ),
    measure: "Population & unauthorized",
    href: "#population",
  },
];

export function SystemPathways() {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {PATHWAYS.map((p, i) => (
        <li key={p.title} className="flex flex-col rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-400 tabular-nums">{String(i + 1).padStart(2, "0")}</p>
          <h3 className="mt-1 font-semibold text-slate-950 dark:text-white">{p.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{p.body}</p>
          <a href={p.href} className="mt-auto pt-3 text-sm font-medium text-blue-700 hover:underline dark:text-blue-400">
            {p.measure} ↓
          </a>
        </li>
      ))}
    </ol>
  );
}

interface Figure {
  value: number | null | undefined;
  unit?: string;
  period?: string;
}

const fig = (f: Figure) => (f.value === null || f.value === undefined ? "—" : formatValue(f.value, f.unit, { compact: true }));

function FlowBox({ label, figure, measure, kind, href }: { label: string; figure: Figure; measure: ReactNode; kind: string; href: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <a href={href} className="text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white">
        {label} ↓
      </a>
      <span className="mt-1 text-xl font-semibold text-slate-950 tabular-nums dark:text-white">{fig(figure)}</span>
      <span className="text-sm text-slate-700 dark:text-slate-200">{measure}</span>
      <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {kind}
        {figure.period && ` · ${figure.period}`}
      </span>
    </div>
  );
}

const ARROW = <span aria-hidden className="text-slate-400">→</span>;

// The ontology: yearly flows in, the status changes that move people
// between them, and the population (stock) they add up to.
export function NumbersMap({
  encounters,
  temporary,
  humanitarian,
  greenCards,
  adjustmentShare,
  naturalizations,
  netMigration,
  naturalized,
  noncitizen,
  fbPeriod,
  unauthorized,
}: {
  encounters: Figure;
  temporary: Figure;
  humanitarian: Figure;
  greenCards: Figure;
  adjustmentShare: number | null | undefined;
  naturalizations: Figure;
  netMigration: Figure;
  naturalized: number | null | undefined;
  noncitizen: number | null | undefined;
  fbPeriod: string;
  unauthorized: Figure;
}) {
  const total = (naturalized ?? 0) + (noncitizen ?? 0);
  const natPct = total ? ((naturalized ?? 0) / total) * 100 : 0;
  return (
    <div className="space-y-4 rounded-2xl bg-slate-50 p-4 sm:p-6 dark:bg-slate-900/60">
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">1 · Yearly flows — events and decisions</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FlowBox label="Stopped at the border" figure={encounters} measure="border encounters" kind="Events, not people" href="#border" />
          <FlowBox label="Visiting, studying, working" figure={temporary} measure="temporary admissions" kind="Entries, not people" href="#temporary" />
          <FlowBox label="Humanitarian" figure={humanitarian} measure="refugee arrivals + asylum grants" kind="People" href="#humanitarian" />
          <FlowBox
            label="Permanent residence"
            figure={greenCards}
            measure="new green cards"
            kind={adjustmentShare ? `People · ${Math.round(adjustmentShare)}% already lived here` : "People"}
            href="#legal"
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">2 · People move between these over time</p>
        <ul className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 dark:text-slate-200">
          <li className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
            Encounter {ARROW} <Term id="removal">removal</Term>, <Term id="return">return</Term>, detention, or release with an immigration-court date
          </li>
          <li className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
            Temporary visitor or parolee {ARROW} green card through <Term id="adjustment-of-status">adjustment of status</Term>
          </li>
          <li className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
            Refugee or asylee {ARROW} green card after one year
          </li>
          <li className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
            Temporary visitor who stays past their admission {ARROW} <Term id="unauthorized">unauthorized</Term> (<Term id="overstay">overstay</Term>)
          </li>
          <li className="rounded-lg border border-slate-200 bg-white px-3 py-2 sm:col-span-2 dark:border-slate-800 dark:bg-slate-950">
            Green-card holder {ARROW} U.S. citizen — <span className="font-semibold tabular-nums">{fig(naturalizations)}</span> naturalized
            {naturalizations.period && ` in ${naturalizations.period}`}
          </li>
        </ul>
      </div>

      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">3 · Who lives here — the population (a stock)</p>
        <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              <Term id="foreign-born">Foreign-born</Term> residents · {fbPeriod} ·{" "}
              <a href="#population" className="hover:text-slate-900 hover:underline dark:hover:text-white">
                Population ↓
              </a>
            </span>
            <span className="mt-1 block text-xl font-semibold text-slate-950 tabular-nums dark:text-white">{total ? formatValue(total, "people", { compact: true }) : "—"}</span>
            {total > 0 && (
              <>
                <span className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded" aria-hidden>
                  <span className="rounded-l" style={{ width: `${natPct}%`, background: "var(--viz-series-1)" }} />
                  <span className="flex-1 rounded-r" style={{ background: "var(--viz-series-2)" }} />
                </span>
                <span className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm" style={{ background: "var(--viz-series-1)" }} />
                    Naturalized citizens {formatValue(naturalized, "people", { compact: true })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm" style={{ background: "var(--viz-series-2)" }} />
                    Not citizens {formatValue(noncitizen, "people", { compact: true })} — green-card holders, temporary residents, refugees,
                    asylees, and unauthorized
                  </span>
                </span>
              </>
            )}
            <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
              Of whom unauthorized: an estimated {fig(unauthorized)} ({unauthorized.period}, DHS) ·{" "}
              <a href="#unauthorized" className="hover:text-slate-900 hover:underline dark:hover:text-white">
                Unauthorized population ↓
              </a>
            </span>
          </div>
          <FlowBox
            label="Changes the population each year"
            figure={netMigration}
            measure={<Term id="nim">net international migration</Term>}
            kind="Everyone in minus everyone out, citizens included"
            href="#population"
          />
        </div>
      </div>
    </div>
  );
}
