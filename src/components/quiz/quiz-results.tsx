// The results drill-down views (the full ranking, every axis, the map, the
// issues), plus the entry points the quiz page imports. The summary
// dashboard lives in result-hero.tsx and result-sections.tsx.

import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { AXIS_GROUPS, axisById } from "@/lib/quiz/axes";
import { poleLabel, type AxisResult, type IdeologyMatch, type QuizResult } from "@/lib/quiz/results";
import { FAMILIES, familyColor } from "@/lib/quiz/families";
import { LENS_NAMES, LENS_VALUE_LABELS } from "@/lib/quiz/lenses";
import { placeRespondent } from "@/lib/quiz/map";
import { ideologies } from "@/lib/quiz/ideologies";
import { refineAxisAction } from "@/lib/actions/quiz";
import { GROUP_ICON } from "@/lib/politics/icons";
import { pointsApart, positionLabel } from "@/lib/politics/axis-language";
import { AxisName, AxisPoles, AxisTrack, MarkerLegend } from "@/components/politics/axis";
import { ExpandableAnalysis } from "@/components/politics/expandable";
import { chartLabel, labelText, metaText } from "@/components/politics/type";
import { ResultsMap } from "./results-map";
import { ResultsIssues } from "./results-issues";
import { body, btnSecondary, ConfidenceMeter, meta, Section, SectionHeader, small, textLink } from "./results-ui";
import { marker, measuredAxes, viewHref, type ResultView } from "./result-shared";

export { ResultHero as QuizHero, QuizCheckpoint } from "./result-hero";
export { QuizResults } from "./result-sections";
export { resultViews, shareTitle, viewHref, type ResultView } from "./result-shared";

const LISTED = 10;

// One drill-down view, on its own page under the view header.
export function QuizResultView({
  slug,
  result,
  canEdit,
  view,
}: {
  slug: string;
  result: QuizResult;
  canEdit: boolean;
  view: ResultView;
}) {
  const accent = familyColor(result.ideologies[0].ideology.family);
  switch (view) {
    case "traditions":
      return <Matches slug={slug} result={result} canEdit={canEdit} />;
    case "map":
      return (
        <Section id="map">
          <ResultsMap
            ranked={result.ideologies.map((m) => ({ id: m.ideology.id, match: m.match }))}
            you={placeRespondent(result.ideologies)}
            youLabel={marker(canEdit)}
            accent={accent}
            kicker="Political map"
            title={`Where ${canEdit ? "you sit" : "this profile sits"} among ${ideologies.length} traditions`}
            description="Each dot is a tradition. Tap one to inspect it."
            matchBase={viewHref(slug, "traditions", "match-")}
          />
        </Section>
      );
    case "axes":
      return <Positions slug={slug} result={result} canEdit={canEdit} accent={accent} />;
    case "issues":
      return (
        <Section id="issues">
          <SectionHeader
            kicker="Detailed positions"
            title={canEdit ? "Where you stand on the issues" : "Positions on the issues"}
            description={
              result.profiles.length > 0
                ? `${result.profiles.length} issues answered. Open one to see every position behind it.`
                : undefined
            }
          />
          {result.profiles.length === 0 ? (
            <p className={`mt-3 ${meta}`}>No issues answered yet.</p>
          ) : (
            <ResultsIssues profiles={result.profiles} slug={slug} canEdit={canEdit} />
          )}
        </Section>
      );
  }
}

// ── Ranked matches ──

function Matches({ slug, result, canEdit }: { slug: string; result: QuizResult; canEdit: boolean }) {
  const compare = result.ideologies
    .slice(0, 3)
    .map((x) => x.ideology.id)
    .join(",");
  return (
    <Section id="matches">
      <SectionHeader
        kicker="Similarity ranking"
        title={canEdit ? "The traditions closest to you" : "The closest traditions"}
        description={`All ${result.ideologies.length} traditions, ranked by similarity (100 = an identical profile). Open one for the axis-by-axis comparison.`}
        actions={
          <Link href={`/atlas/compare?ids=${compare}&from=${slug}`} className={btnSecondary}>
            Compare top 3
          </Link>
        }
      />
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <div
          className={`hidden border-b border-slate-200 bg-slate-50 px-4 py-2 sm:grid ${rowGrid} ${small} dark:border-slate-800 dark:bg-slate-900/50`}
        >
          <span className="text-right">#</span>
          <span>Tradition</span>
          <span className="text-right">Similarity</span>
          <span />
        </div>
        <ol className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {result.ideologies.slice(0, LISTED).map((m, i) => (
            <MatchRow key={m.ideology.id} rank={i + 1} match={m} canEdit={canEdit} slug={slug} />
          ))}
        </ol>
        {result.ideologies.length > LISTED && (
          <details className="group/all border-t border-slate-200 dark:border-slate-800">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900/50 dark:hover:text-white">
              <span className="group-open/all:hidden">Show all {result.ideologies.length}</span>
              <span className="hidden group-open/all:inline">Show top {LISTED} only</span>
              <ChevronDown size={15} aria-hidden className="transition-transform group-open/all:rotate-180" />
            </summary>
            <ol className="divide-y divide-slate-100 border-t border-slate-200 dark:divide-slate-800/80 dark:border-slate-800">
              {result.ideologies.slice(LISTED).map((m, i) => (
                <MatchRow key={m.ideology.id} rank={LISTED + i + 1} match={m} canEdit={canEdit} slug={slug} />
              ))}
            </ol>
          </details>
        )}
      </div>
    </Section>
  );
}

const rowGrid =
  "grid-cols-[1.5rem_minmax(0,1fr)_2.75rem_1rem] items-center gap-x-3 sm:grid-cols-[1.75rem_minmax(0,1fr)_11rem_1rem] sm:gap-x-4";

function MatchRow({
  rank,
  match,
  canEdit,
  slug,
}: {
  rank: number;
  match: IdeologyMatch;
  canEdit: boolean;
  slug: string;
}) {
  const color = familyColor(match.ideology.family);
  const first = rank === 1;
  const you = { label: marker(canEdit), shape: "ring" as const, color };
  const them = { label: match.ideology.name, shape: "diamond" as const };
  return (
    <li>
      <details id={`match-${match.ideology.id}`} className="wv-expand group/match scroll-mt-32 lg:scroll-mt-20">
        <summary
          className={`grid min-h-14 cursor-pointer list-none px-4 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50 ${rowGrid}`}
          style={first ? { backgroundColor: `${color}0d`, boxShadow: `inset 3px 0 0 ${color}` } : undefined}
        >
          <span
            className={`text-right tabular-nums ${first ? "font-bold text-slate-950 dark:text-white" : "text-sm text-slate-500 dark:text-slate-400"}`}
          >
            {rank}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
              <span className="font-semibold text-slate-950 dark:text-white">{match.ideology.name}</span>
              {first && (
                <span className="rounded-full bg-slate-950 px-2 py-px text-[11px] font-semibold whitespace-nowrap text-white dark:bg-white dark:text-slate-950">
                  Top match
                </span>
              )}
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {FAMILIES[match.ideology.family].label}
              </span>
            </span>
            <span className="mt-0.5 hidden truncate text-sm text-slate-600 group-open/match:hidden sm:block dark:text-slate-400">
              {match.ideology.description}
            </span>
          </span>
          <span className="flex items-center gap-2.5">
            <span className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 sm:block dark:bg-slate-800">
              <span
                className="block h-full rounded-full"
                style={{ width: `${match.match}%`, backgroundColor: color }}
              />
            </span>
            <span className="ml-auto w-10 text-right text-sm font-semibold text-slate-950 tabular-nums dark:text-white">
              {match.match}%
            </span>
          </span>
          <ChevronDown
            size={16}
            aria-hidden
            className="text-slate-500 transition-transform group-open/match:rotate-180"
          />
        </summary>
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:pl-15 dark:border-slate-800 dark:bg-slate-900/30">
          <p className={`max-w-3xl ${body}`}>{match.ideology.description}</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
            <p className={labelText}>Axis by axis, closest first</p>
            <MarkerLegend markers={[you, them]} />
          </div>
          <ul className="mt-2 grid gap-x-8 gap-y-3 md:grid-cols-2">
            {match.comparisons.map((c) => (
              <li key={c.axis} className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-x-3 gap-y-1">
                <AxisName axis={c.axis} className="text-[13px]" />
                <span className={`text-right tabular-nums ${chartLabel}`}>{pointsApart(c.gap)} pts apart</span>
                <span className="col-span-2">
                  <AxisTrack
                    axis={c.axis}
                    markers={[
                      { ...you, value: c.you },
                      { ...them, value: c.them },
                    ]}
                    connect
                    size="sm"
                  />
                </span>
              </li>
            ))}
          </ul>
          {match.lenses.length > 0 && (
            <ul className="mt-4 grid gap-x-8 gap-y-2 border-t border-slate-200 pt-3 md:grid-cols-2 dark:border-slate-800">
              {match.lenses.map((l) => {
                const labels = LENS_VALUE_LABELS[l.lens];
                return (
                  <li key={l.lens} className="grid grid-cols-[8.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{LENS_NAMES[l.lens]}</span>
                    <span className="truncate text-slate-600 dark:text-slate-400">
                      {l.match
                        ? labels[l.you]
                        : `${labels[l.you]} vs. ${l.accepted.map((v) => labels[v]).join(" or ")}`}
                    </span>
                    <span
                      className={`text-right font-medium ${l.match ? "text-slate-600 dark:text-slate-400" : "text-rose-700 dark:text-rose-400"}`}
                    >
                      {l.match ? "Same" : "Differs"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href={`/atlas/philosophies/${match.ideology.id}?from=${slug}`}
            className={`mt-4 inline-flex items-center gap-1 text-sm ${textLink}`}
          >
            Explore {match.ideology.name} <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </details>
    </li>
  );
}

// ── Axes ──

function Positions({
  slug,
  result,
  canEdit,
  accent,
}: {
  slug: string;
  result: QuizResult;
  canEdit: boolean;
  accent: string;
}) {
  const byAxis = new Map(result.axes.map((a) => [a.axis, a]));
  const measured = measuredAxes(result);
  const top = result.ideologies[0];
  const unsure = measured.filter((a) => byAxis.get(a.id)!.confidence !== "high").length;
  return (
    <Section id="positions">
      <SectionHeader
        kicker="Detailed positions"
        title={`${canEdit ? "Your position" : "Position"} on ${measured.length} axes`}
        description={`Each axis runs from one pole (0) to the other (100). Open any axis to see the answers that placed ${canEdit ? "you" : "this profile"} there${canEdit && unsure > 0 ? ", or to refine an uncertain one" : ""}.`}
      />
      <div
        className={`mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-slate-50 px-4 py-2.5 dark:bg-slate-900/50`}
      >
        <MarkerLegend
          markers={[
            { label: marker(canEdit), shape: "ring", color: accent },
            { label: top.ideology.name, shape: "diamond" },
          ]}
        />
        <span className={`inline-flex items-center gap-1.5 ${chartLabel}`}>
          <span className="inline-block h-3 w-6 rounded-full" style={{ backgroundColor: `${accent}2e` }} /> Likely range
        </span>
        <span className={`inline-flex items-center gap-1.5 ${chartLabel}`}>
          <ConfidenceMeter level="high" /> Certainty
        </span>
      </div>
      <div className="mt-5 space-y-7">
        {AXIS_GROUPS.map((g) => {
          const rows = measured.filter((a) => a.group === g.id);
          if (rows.length === 0) return null;
          const Icon = GROUP_ICON[g.id];
          return (
            <div key={g.id}>
              <h3 className="flex items-center gap-2 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
                <Icon size={17} aria-hidden className="text-slate-500" />
                {g.label}
                <span className="font-normal text-slate-500 tabular-nums dark:text-slate-400">{rows.length}</span>
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {rows.map((a) => (
                  <AxisRow
                    key={a.id}
                    slug={slug}
                    result={byAxis.get(a.id)!}
                    canEdit={canEdit}
                    accent={accent}
                    reference={top.ideology.position[a.id]}
                    refName={top.ideology.name}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function AxisRow({
  slug,
  result,
  canEdit,
  accent,
  reference,
  refName,
}: {
  slug: string;
  result: AxisResult;
  canEdit: boolean;
  accent: string;
  reference?: number;
  refName: string;
}) {
  const def = axisById[result.axis];
  const refine = refineAxisAction.bind(null, slug, result.axis);
  const markers = [
    { label: marker(canEdit), shape: "ring" as const, color: accent, value: result.mean },
    ...(reference !== undefined ? [{ label: refName, shape: "diamond" as const, value: reference }] : []),
  ];
  return (
    <ExpandableAnalysis
      id={`axis-${result.axis}`}
      summaryClassName="py-3.5 px-2 -mx-2 hover:bg-slate-50/70 dark:hover:bg-slate-900/40"
      summary={
        <span className="grid items-center gap-x-6 gap-y-2 md:grid-cols-[14rem_minmax(0,1fr)]">
          <span className="min-w-0">
            <AxisName axis={result.axis} />
            <span className="mt-0.5 flex items-center gap-2 pl-6">
              <span className="font-semibold text-slate-950 dark:text-white">
                {positionLabel(result.axis, result.mean)}
              </span>
              <ConfidenceMeter level={result.confidence} />
            </span>
          </span>
          <span className="block">
            <AxisTrack
              axis={result.axis}
              markers={markers}
              band={[result.mean - result.sd, result.mean + result.sd]}
              fill={accent}
            />
            <AxisPoles axis={result.axis} />
          </span>
        </span>
      }
    >
      <div className="mb-3 grid gap-4 rounded-xl bg-slate-50 p-4 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] dark:bg-slate-900/60">
        <div className="space-y-2">
          <p>
            <span className="font-semibold text-slate-950 dark:text-white">{def.negative.label}:</span>{" "}
            <span className="text-slate-700 dark:text-slate-300">{def.negative.description}</span>
          </p>
          <p>
            <span className="font-semibold text-slate-950 dark:text-white">{def.positive.label}:</span>{" "}
            <span className="text-slate-700 dark:text-slate-300">{def.positive.description}</span>
          </p>
          {reference !== undefined && (
            <p className="text-slate-700 dark:text-slate-300">
              {refName}:{" "}
              <span className="font-medium text-slate-950 dark:text-white">
                {positionLabel(result.axis, reference)}
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                {" "}
                · {pointsApart(reference - result.mean)} pts apart
              </span>
            </p>
          )}
          <p className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <ConfidenceMeter level={result.confidence} withLabel />
            <span className={small}>
              · {result.answered} {result.answered === 1 ? "answer" : "answers"}
            </span>
          </p>
          {result.confidence === "low" && (
            <p className="text-slate-700 dark:text-slate-300">
              {result.lowReason === "mixed"
                ? `${canEdit ? "Your answers" : "Answers"} on this axis pointed in both directions.`
                : "Too few answers to place this precisely."}
            </p>
          )}
        </div>
        <div>
          <p className={metaText}>{canEdit ? "Why you landed here" : "Why this placement"}</p>
          {result.influences.length === 0 ? (
            <p className="mt-1 text-slate-600 dark:text-slate-400">No answers have moved this axis yet.</p>
          ) : (
            <ul className="mt-1.5 space-y-2">
              {result.influences.map((inf) => (
                <li key={inf.answerIndex} className="leading-snug">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{inf.answerLabel}</span>
                  {inf.kind === "statement" ? ": " : " — "}
                  <span className="text-slate-700 dark:text-slate-300">“{inf.text}”</span>
                  <span className="ml-1 whitespace-nowrap text-slate-600 dark:text-slate-400">
                    → toward {poleLabel(result.axis, inf.toward)}
                  </span>
                  {canEdit && (
                    <Link
                      href={`/quiz/${slug}?edit=${inf.kind}:${inf.itemId}`}
                      className="ml-2 text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                    >
                      change
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && result.confidence !== "high" && (
            <form action={refine} className="mt-3">
              <button type="submit" className={btnSecondary}>
                Answer 4 more to refine this
              </button>
            </form>
          )}
        </div>
      </div>
    </ExpandableAnalysis>
  );
}
