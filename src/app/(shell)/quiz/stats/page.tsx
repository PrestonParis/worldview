import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { requireOwnerPage } from "@/lib/auth/guard";
import { loadQuizAnalyticsData } from "@/lib/db/quizAnalytics";
import { setQuizTestFlagAction } from "@/lib/actions/quiz";
import { analyzeQuiz, FAR_MATCH, MIN_ITEM_N, MIN_SUGGEST_N, type QuizAnalytics } from "@/lib/quiz/analytics";
import { axisById } from "@/lib/quiz/axes";
import { quizModeIds, QUIZ_MODES } from "@/lib/quiz/modes";
import { ChartCard } from "@/components/charts/chart-card";
import { StatTile } from "@/components/charts/stat-tile";
import { RankedBars } from "@/components/charts/ranked-bars";
import { rankedTable } from "@/components/charts/tables";
import { SortableTable, type SortCell } from "@/components/data/sortable-table";
import { CorrelationMatrix, DailyColumns, Histogram, MiniHistogram, RESPONSE_LABELS } from "@/components/quiz/stats/charts";
import { analyticsOptions, filterQuery, parseFilters, RANGES, STATS_TIME_ZONE, type StatsFilters } from "./filters";

export const metadata: Metadata = {
  title: "Quiz stats · Worldview",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
const num = (x: number | null, places = 2) => (x === null ? "—" : x.toFixed(places));
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: STATS_TIME_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function QuizStatsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireOwnerPage("/quiz/stats");
  const filters = parseFilters(await searchParams);
  const now = new Date();
  const { sessions, openers } = await loadQuizAnalyticsData();
  const a = analyzeQuiz(sessions, openers, analyticsOptions(filters, now));
  const banks = [...new Set(sessions.map((s) => s.bankVersion))].sort().reverse();

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-10">
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Quiz stats</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {a.overview.sessions} sessions · updated {when(a.generatedAt)} · times in Eastern
            </p>
          </div>
          <Downloads filters={filters} />
        </div>
        <FilterBar filters={filters} banks={banks} />
      </header>

      <Overview a={a} />

      <Section title="Activity" id="activity">
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard
            className="lg:col-span-2"
            title="Daily activity"
            subtitle="Landing-page visits, quizzes started, and quizzes that reached a checkpoint"
            table={{
              columns: ["Date", "Visits", "Opener answered", "Started", "Quick", "Standard", "Deep"],
              rows: [...a.daily].reverse().map((d) => [d.date, d.visits, d.openerAnswered, d.started, d.quick, d.standard, d.deep]),
            }}
          >
            <DailyColumns rows={a.daily} />
          </ChartCard>
          <ChartCard
            title="Landing page"
            subtitle={`${a.openers.visits} visits logged; median ${num(a.openers.medianSecondsToFirst, 1)} s to the first answer`}
            table={rankedTable(landingFunnel(a), "Step", "")}
          >
            <RankedBars items={landingFunnel(a)} slot={3} />
          </ChartCard>
        </div>
      </Section>

      <Section title="Funnel" id="funnel" note="Share of started quizzes still going at each answer count. Sessions idle an hour without reaching their target count as abandoned.">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Still going at each answer" subtitle={`Started: ${quizModeIds.map((m) => `${QUIZ_MODES[m].shortName} ${a.startedByMode[m]}`).join(" · ")}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs tabular-nums">
                <thead className="text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-1 pr-3 text-left font-medium">Answers</th>
                    {(["all", ...quizModeIds] as const).map((m) => (
                      <th key={m} className="px-2 py-1 text-right font-medium">
                        {m === "all" ? "All" : QUIZ_MODES[m].shortName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {a.survival.map((s) => (
                    <tr key={s.answers}>
                      <td className="py-1 pr-3 text-slate-600 dark:text-slate-300">≥ {s.answers}</td>
                      {(["all", ...quizModeIds] as const).map((m) => (
                        <td key={m} className="px-2 py-1 text-right">
                          <ShareCell value={s.byMode[m]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
          <ChartCard
            title="Last answer before leaving"
            subtitle="Abandoned sessions, by the item answered last"
            table={rankedTable(abandonItems(a), "Item", "")}
          >
            <RankedBars items={abandonItems(a)} slot={2} />
          </ChartCard>
        </div>
      </Section>

      <Section title="Sessions" id="sessions" note="Flagged sessions (test, speeder: median under 2 s per answer, straight-line: 10+ identical statement answers) are left out of the statistics unless included above.">
        <SessionsTable a={a} />
      </Section>

      <Section title="Retraining" id="retraining" note={`Re-estimated from the marginal likelihood of each answer over the respondent's leave-one-out position. Suggestions need n ≥ ${MIN_SUGGEST_N}, a 95% interval that excludes the current value, and a log-likelihood gain of 3 or more.`}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Panel title="Response model">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-1 text-left font-medium">Parameter</th>
                  <th className="py-1 text-right font-medium">Current</th>
                  <th className="py-1 text-right font-medium">Fitted (95%)</th>
                  <th className="py-1 text-right font-medium">n</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {a.parameters.map((p) => (
                  <tr key={p.name}>
                    <td className="py-1.5 font-mono text-xs">{p.name}</td>
                    <td className="py-1.5 text-right">{p.current}</td>
                    <td className="py-1.5 text-right">
                      {p.fitted ? `${p.edge ? "≥ " : ""}${p.fitted.estimate} (${p.fitted.lo}–${p.fitted.hi})` : "—"}
                    </td>
                    <td className="py-1.5 text-right">{p.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title={`Suggestions (${a.suggestions.length})`}>
            {a.suggestions.length ? (
              <ul className="max-h-72 divide-y divide-slate-100 overflow-auto text-sm dark:divide-slate-800">
                {a.suggestions.map((s, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{s.kind}</span>
                    <span className="font-mono text-xs">{s.target}</span>
                    <span className="text-slate-700 dark:text-slate-200">{s.detail}</span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      n {s.n}
                      {s.gain !== null && ` · ΔLL ${s.gain}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                None yet. The most-answered statement has {a.statements[0]?.answered ?? 0} answers; suggestions start at {MIN_SUGGEST_N}.
              </p>
            )}
          </Panel>
        </div>
      </Section>

      <Section title="Axes" id="axes" note="Reliability is the share of variance in respondents' positions that isn't measurement error. Dispersion is the axis's statement answers' spread relative to the response model (1 = as expected).">
        <AxesTable a={a} />
        <ChartCard
          className="mt-4"
          title="How axes move together"
          subtitle="Correlation of respondents' positions, among those with 2+ answers on both axes"
          table={{ columns: ["Axes", "r", "n"], rows: a.correlations.map((c) => [`${axisById[c.a].name} × ${axisById[c.b].name}`, c.r, c.n]) }}
        >
          <CorrelationMatrix axes={a.axes.map((x) => ({ axis: x.axis, name: x.name }))} correlations={a.correlations} />
        </ChartCard>
      </Section>

      <Section title="Statements" id="statements" note={`Fit statistics from n ≥ ${MIN_ITEM_N}. Item–rest r should carry the sign the item is keyed on; outfit near 1 means answers vary as the model expects.`}>
        <StatementsTable a={a} />
      </Section>

      <Section title="Policy questions" id="choices" note="Mean θ: the average leave-one-out position of the people who chose each option, next to the location the bank gives it.">
        <ChoicesList a={a} />
      </Section>

      <Section title="Results" id="results" note={`Sessions that reached at least one checkpoint (${a.ideologies.n}).`}>
        <IdeologyOutcomes a={a} />
      </Section>
    </div>
  );
}

// ── Layout pieces ──

function Section({ title, id, note, children }: { title: string; id: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{title}</h2>
      {note && <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
      <h3 className="mb-3 text-base font-semibold text-slate-950 dark:text-white">{title}</h3>
      {children}
    </div>
  );
}

function ShareCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-[var(--viz-empty)]">
        <span className="block h-full rounded-full bg-[var(--viz-series-1)]" style={{ width: `${value * 100}%` }} />
      </span>
      {pct(value)}
    </span>
  );
}

const control =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

function FilterBar({ filters, banks }: { filters: StatsFilters; banks: string[] }) {
  return (
    <form className="flex flex-wrap items-center gap-2" method="get">
      <select name="range" defaultValue={filters.range} className={control} aria-label="Date range">
        {Object.entries(RANGES).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <select name="mode" defaultValue={filters.mode ?? ""} className={control} aria-label="Mode">
        <option value="">All modes</option>
        {quizModeIds.map((m) => (
          <option key={m} value={m}>
            {QUIZ_MODES[m].shortName}
          </option>
        ))}
      </select>
      <select name="bank" defaultValue={filters.bank ?? ""} className={control} aria-label="Question bank">
        <option value="">All banks</option>
        {banks.map((b) => (
          <option key={b} value={b}>
            Bank {b}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
        <input type="checkbox" name="flagged" value="1" defaultChecked={filters.flagged} />
        Include flagged
      </label>
      <button type="submit" className={`${control} font-medium`}>
        Apply
      </button>
    </form>
  );
}

function Downloads({ filters }: { filters: StatsFilters }) {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {["responses.csv", "sessions.csv", "items.json"].map((file) => (
        <a key={file} href={`/quiz/stats/export${filterQuery(filters, { file })}`} className={`${control} inline-flex items-center gap-1.5`}>
          <Download className="size-3.5" aria-hidden />
          {file}
        </a>
      ))}
    </div>
  );
}

// ── Sections ──

function Overview({ a }: { a: QuizAnalytics }) {
  const o = a.overview;
  const reached = o.checkpoints.quick;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <StatTile label="New in 24 hours" value={o.last24h} note={`${o.last7d} in 7 days`} spark={a.daily.slice(-14).map((d) => d.started)} />
      <StatTile label="Sessions analyzed" value={o.analyzed} note={`${o.sessions - o.analyzed} flagged · ${o.archived} archived`} />
      <StatTile label="Reached a checkpoint" value={reached} extra={o.analyzed ? `· ${pct(reached / o.analyzed)}` : undefined} note={`Profile ${o.checkpoints.standard} · Deep ${o.checkpoints.deep}`} />
      <StatTile label="Median answers" value={o.medianAnswers} note={`${o.totalAnswers} answers in all · skip ${pct(o.skipRate)}`} />
      <StatTile label="Seconds per answer" value={o.medianSecondsPerAnswer === null ? null : Number(o.medianSecondsPerAnswer.toFixed(1))} note={`Median session ${num(o.medianMinutes, 1)} min`} />
      <StatTile label="Landing visits" value={o.visits} note={`${a.openers.started} started from the landing page`} />
    </div>
  );
}

function landingFunnel(a: QuizAnalytics) {
  return [
    { label: "Visited", value: a.openers.visits },
    { label: "Answered 1 opener", value: a.openers.answered[0] },
    { label: "Answered all 3", value: a.openers.answered[2] },
    { label: "Started a quiz", value: a.openers.started },
  ];
}

function abandonItems(a: QuizAnalytics) {
  return a.abandonment.map((x) => ({ label: x.text, value: x.count, note: x.id }));
}

function SessionsTable({ a }: { a: QuizAnalytics }) {
  const rows = a.sessions.slice(0, 100);
  const cell = (content: ReactNode, sort?: SortCell["sort"], className = "px-3 py-1.5"): SortCell => ({ content, sort, className });
  return (
    <div className="max-h-[32rem] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800">
      <SortableTable
        columns={[
          { label: "Started" },
          { label: "Answers", align: "right" },
          { label: "Minutes", align: "right" },
          { label: "Mode" },
          { label: "Reached" },
          { label: "Top match" },
          { label: "Sec/answer", align: "right" },
          { label: "Flags" },
          { label: "Test" },
        ]}
        rows={rows.map((s) => ({
          key: s.key,
          cells: [
            cell(
              <span className="whitespace-nowrap">
                {s.isNew && <span className="mr-1.5 inline-block size-1.5 rounded-full bg-[var(--viz-series-1)] align-middle" title="New in 24 hours" />}
                {s.slug ? (
                  <Link href={`/quiz/${s.slug}`} className="underline decoration-slate-300 underline-offset-2">
                    {when(s.createdAt)}
                  </Link>
                ) : (
                  when(s.createdAt)
                )}
              </span>,
              s.createdAt,
            ),
            cell(s.answers, s.answers, "px-3 py-1.5 text-right tabular-nums"),
            cell(s.minutes, s.minutes, "px-3 py-1.5 text-right tabular-nums"),
            cell(QUIZ_MODES[s.targetMode].shortName, s.targetMode),
            cell(s.highestCompletedMode ? QUIZ_MODES[s.highestCompletedMode].shortName : "—", s.highestCompletedMode ?? ""),
            cell(s.topMatch ? `${s.topMatch} ${s.topMatchPct}%${s.verdict ? ` · ${s.verdict}` : ""}` : "—", s.topMatchPct ?? -1),
            cell(s.medianSeconds ?? "—", s.medianSeconds ?? -1, "px-3 py-1.5 text-right tabular-nums"),
            cell(s.flags.filter((f) => f !== "test").join(", ") || "", s.flags.join(",")),
            cell(
              s.source === "live" ? (
                <form action={setQuizTestFlagAction.bind(null, s.key, !s.isTest)}>
                  <button type="submit" className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800 dark:hover:text-slate-200">
                    {s.isTest ? "Test · undo" : "Mark test"}
                  </button>
                </form>
              ) : s.isTest ? (
                "Test"
              ) : (
                ""
              ),
              s.isTest ? 1 : 0,
            ),
          ],
        }))}
        theadClassName="sticky top-0 z-10 bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400"
      />
      {a.sessions.length > rows.length && <p className="px-3 py-2 text-xs text-slate-500">Showing the latest {rows.length} of {a.sessions.length}; sessions.csv has all.</p>}
    </div>
  );
}

function AxesTable({ a }: { a: QuizAnalytics }) {
  const cell = (content: ReactNode, sort?: SortCell["sort"]): SortCell => ({ content, sort, className: "px-3 py-1.5 text-right tabular-nums" });
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
      <SortableTable
        columns={[
          { label: "Axis" },
          { label: "n", align: "right" },
          { label: "Positions (−1 … +1)", align: "right" },
          { label: "Mean", align: "right" },
          { label: "Spread", align: "right" },
          { label: "Posterior SD", align: "right" },
          { label: "Reliability", align: "right" },
          { label: "Settled", align: "right" },
          { label: "Conflict", align: "right" },
          { label: "Dispersion", align: "right" },
        ]}
        rows={a.axes.map((x) => ({
          key: x.axis,
          cells: [
            { content: x.name, className: "px-3 py-1.5 text-slate-700 dark:text-slate-300" },
            cell(x.n, x.n),
            {
              content: (
                <MiniHistogram
                  counts={x.histogram}
                  labels={x.histogram.map((_, i) => `${(-1 + i * 0.2).toFixed(1)} to ${(-0.8 + i * 0.2).toFixed(1)}`)}
                  width={100}
                />
              ),
              className: "px-3 py-1 text-right",
            },
            cell(num(x.mean), x.mean ?? -9),
            cell(num(x.spread), x.spread ?? -9),
            cell(num(x.meanPosteriorSd), x.meanPosteriorSd ?? -9),
            cell(num(x.reliability), x.reliability ?? -9),
            cell(pct(x.settledShare), x.settledShare ?? -9),
            cell(pct(x.conflictShare), x.conflictShare ?? -9),
            cell(num(x.dispersion), x.dispersion ?? -9),
          ],
        }))}
      />
    </div>
  );
}

function StatementsTable({ a }: { a: QuizAnalytics }) {
  const right = "px-3 py-1.5 text-right tabular-nums";
  const flagged = (s: QuizAnalytics["statements"][number]) =>
    (s.expectedSign !== null && s.itemRest !== null && Math.sign(s.itemRest) === -s.expectedSign) || (s.outfit !== null && (s.outfit > 1.5 || s.outfit < 0.5));
  return (
    <div className="max-h-[40rem] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800">
      <SortableTable
        columns={[
          { label: "Statement" },
          { label: "Axis" },
          { label: "n", align: "right" },
          { label: "Skip", align: "right" },
          { label: "Responses", align: "right" },
          { label: "Mean", align: "right" },
          { label: "Item–rest r", align: "right" },
          { label: "Residual", align: "right" },
          { label: "Outfit", align: "right" },
          { label: "Location", align: "right" },
          { label: "Fitted (95%)", align: "right" },
          { label: "Sec", align: "right" },
        ]}
        rows={a.statements.map((s) => ({
          key: s.id,
          cells: [
            {
              content: (
                <span className="block max-w-md">
                  <span className={`font-mono text-[11px] ${flagged(s) ? "text-[var(--viz-series-2)]" : "text-slate-400"}`}>{s.id}</span>{" "}
                  <span className="text-slate-700 dark:text-slate-300">{s.text}</span>
                </span>
              ),
              sort: s.id,
              className: "px-3 py-1.5",
            },
            { content: axisById[s.axis].name, className: "px-3 py-1.5 text-slate-500 whitespace-nowrap" },
            { content: s.answered, className: right },
            { content: pct(s.skipRate), sort: s.skipRate, className: right },
            { content: <MiniHistogram counts={s.histogram} labels={RESPONSE_LABELS} />, sort: s.mean ?? -9, className: "px-3 py-1 text-right" },
            { content: num(s.mean), sort: s.mean ?? -9, className: right },
            { content: num(s.itemRest), sort: s.itemRest ?? -9, className: right },
            { content: num(s.residual), sort: s.residual ?? -9, className: right },
            { content: num(s.outfit), sort: s.outfit ?? -9, className: right },
            { content: `${s.location}${s.model === "ideal" ? " ◆" : ""}`, sort: s.location, className: right },
            {
              content: s.fittedLocation ? `${s.fittedLocation.estimate} (${s.fittedLocation.lo}–${s.fittedLocation.hi})` : "—",
              sort: s.locationGain ?? -9,
              className: `${right} whitespace-nowrap`,
            },
            { content: s.medianSeconds ?? "—", sort: s.medianSeconds ?? -1, className: right },
          ],
        }))}
        theadClassName="sticky top-0 z-10 bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400"
      />
      <p className="px-3 py-2 text-xs text-slate-500">◆ ideal-point item (agreement peaks at its location). Orange id: reversed sign or misfit.</p>
    </div>
  );
}

function ChoicesList({ a }: { a: QuizAnalytics }) {
  if (!a.choices.length) return <p className="text-sm text-slate-500">No policy questions answered yet.</p>;
  return (
    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
      {a.choices.map((c) => (
        <details key={c.id} className="group px-4 py-2.5">
          <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 text-sm">
            <span className="font-mono text-[11px] text-slate-400">{c.id}</span>
            <span className="text-slate-800 dark:text-slate-200">{c.prompt}</span>
            <span className="text-xs text-slate-500 tabular-nums">
              n {c.shown} · skip {c.skips}
              {c.noneFit ? ` · none fit ${c.noneFit}` : ""}
              {c.reach !== null ? ` · reach ${pct(c.reach)}` : ""}
              {c.medianSeconds !== null ? ` · ${c.medianSeconds} s` : ""}
              {c.orderAgreement.some((o) => o.rho < 0) ? " · order reversed" : ""}
            </span>
          </summary>
          <table className="mt-2 mb-1 w-full text-xs tabular-nums">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 text-left font-medium">Option</th>
                <th className="py-1 text-right font-medium">Picked</th>
                <th className="py-1 pl-4 text-left font-medium">Axis: location → mean θ (n)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {c.options.map((o) => (
                <tr key={o.id}>
                  <td className="py-1 pr-3 text-slate-700 dark:text-slate-300">{o.text}</td>
                  <td className="py-1 text-right">
                    <ShareCell value={c.shown - c.skips ? o.share : null} />
                  </td>
                  <td className="py-1 pl-4 text-slate-500">
                    {o.axes.map((x) => `${axisById[x.axis].name}: ${x.location} → ${x.meanTheta ?? "—"} (${x.n})`).join(" · ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.importance.some(Boolean) && (
            <p className="text-xs text-slate-500">Importance: low {c.importance[0]} · medium {c.importance[1]} · high {c.importance[2]}</p>
          )}
        </details>
      ))}
    </div>
  );
}

function IdeologyOutcomes({ a }: { a: QuizAnalytics }) {
  const io = a.ideologies;
  const top = io.top.map((t) => ({ label: t.name, value: t.count, note: t.family }));
  const binLabels = io.topMatchHistogram.map((_, i) => `${i * 10}–${i * 10 + 10}%`);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Top matches" subtitle={`Verdicts: clear ${io.verdicts.clear} · lean ${io.verdicts.lean} · torn ${io.verdicts.torn}`} table={rankedTable(top, "Ideology", "")}>
        <RankedBars items={top} limit={15} />
      </ChartCard>
      <ChartCard
        title="Top match strength"
        subtitle={`${io.far.n} respondent${io.far.n === 1 ? "" : "s"} with no ideology above ${FAR_MATCH}%`}
        table={{ columns: ["Top match", "Respondents"], rows: binLabels.map((l, i) => [l, io.topMatchHistogram[i]]) }}
      >
        <Histogram counts={io.topMatchHistogram} labels={binLabels.map((l) => l.split("–")[0])} />
      </ChartCard>
      <Panel title="Coverage of the catalog">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {io.topThree.length} ideologies appear in someone&apos;s top 3; {io.never.length} never have.
        </p>
        {io.far.n > 0 && (
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            Average position of poorly matched respondents:{" "}
            <span className="text-slate-500">
              {Object.entries(io.far.centroid)
                .map(([axis, v]) => `${axisById[axis as keyof typeof axisById].name} ${v}`)
                .join(" · ")}
            </span>
          </p>
        )}
      </Panel>
      <Panel title="Lens answers">
        {io.lenses.length ? (
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {io.lenses.map((l) => (
              <li key={`${l.lens}:${l.value}`} className="flex justify-between gap-3">
                <span>
                  {l.lens}: {l.value}
                </span>
                <span className="tabular-nums">{l.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">None yet.</p>
        )}
      </Panel>
    </div>
  );
}
