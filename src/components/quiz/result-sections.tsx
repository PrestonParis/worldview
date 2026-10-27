// The results dashboard below the hero: an overview of what shaped the
// result, then the map, positions, comparison and history, each a preview
// with a way into its full drill-down view.

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Compass,
  Gauge,
  Landmark,
  Map as MapIcon,
  ScrollText,
  UserRound,
} from "lucide-react";
import { axisById } from "@/lib/quiz/axes";
import { familyColor } from "@/lib/quiz/families";
import { ideologies } from "@/lib/quiz/ideologies";
import { placeRespondent } from "@/lib/quiz/map";
import { poleLabel, type AxisResult, type QuizResult } from "@/lib/quiz/results";
import type { QuizModeId } from "@/lib/quiz/modes";
import { everyChurchQuizUrl } from "@/lib/atlas/everychurch";
import { HISTORY } from "@/lib/atlas/history";
import { positionLabel, STRENGTH_LABEL, strengthOf } from "@/lib/politics/axis-language";
import type { SectionIconId } from "@/lib/politics/icons";
import { SectionNav } from "@/components/data/section-nav";
import {
  AxisComparisonRow,
  AxisPoles,
  AxisTrack,
  MarkerLegend,
  PoliticalAxis,
  type AxisMarker,
} from "@/components/politics/axis";
import { ExpandableAnalysis } from "@/components/politics/expandable";
import { AnalysisSection } from "@/components/politics/section";
import { HistoricalParallels, ReadingList } from "@/components/politics/history";
import { SimilarityBars, TraditionRow } from "@/components/politics/tradition";
import { chip, focusRing, labelText, metaText, subhead } from "@/components/politics/type";
import { ResultsMap } from "./results-map";
import { btnPrimary, btnSecondary, ConfidenceMeter, textLink } from "./results-ui";
import { BREAK_GAP, marker, measuredAxes, resultViews, viewHref, type ResultView } from "./result-shared";

const CONVICTIONS = 3;
const BREAKS_SHOWN = 4;
const POSITIONS_SHOWN = 6;
const BEYOND_MIN = 0.4;

const CERTAINTY_WORD = { high: "High", medium: "Medium", low: "Low" } as const;

export function QuizResults({
  slug,
  result,
  canEdit,
  mode,
  ownership,
}: {
  slug: string;
  result: QuizResult;
  canEdit: boolean;
  mode: QuizModeId;
  ownership?: ReactNode;
}) {
  const top = result.ideologies[0];
  const accent = familyColor(top.ideology.family);
  const history = HISTORY[top.ideology.id];
  const quick = mode === "quick";
  const sections: [string, string, SectionIconId][] = [
    ["overview", "Overview", "overview"],
    ...(mode === "deep" ? [["map", "Political map", "map"] as [string, string, SectionIconId]] : []),
    ["positions", canEdit ? "Your positions" : "Positions", "positions"],
    ...(!quick ? [["compare", "Compare", "compare"] as [string, string, SectionIconId]] : []),
    ...(!quick && history ? [["learn", "History & reading", "history"] as [string, string, SectionIconId]] : []),
    ["more", "More", "connections"],
  ];
  return (
    <div className="min-w-0 space-y-5">
      <SectionNav sections={sections} label="Result sections" inset />
      <Overview slug={slug} result={result} canEdit={canEdit} accent={accent} quick={quick} />
      {mode === "deep" && <MapPreview slug={slug} result={result} canEdit={canEdit} accent={accent} />}
      <PositionsPreview slug={slug} result={result} canEdit={canEdit} accent={accent} quick={quick} />
      {!quick && <CompareSection slug={slug} result={result} canEdit={canEdit} />}
      {!quick && history && <LearnSection slug={slug} result={result} />}
      <More slug={slug} result={result} canEdit={canEdit} mode={mode} ownership={ownership} />
    </div>
  );
}

// ── Overview ──

function influencesList(a: AxisResult, slug: string, canEdit: boolean, limit = 3) {
  if (a.influences.length === 0) return <p className={metaText}>No answers have moved this axis yet.</p>;
  return (
    <ul className="space-y-2">
      {a.influences.slice(0, limit).map((inf) => (
        <li key={inf.answerIndex} className="text-sm leading-6">
          <span className="font-medium text-slate-900 dark:text-slate-100">{inf.answerLabel}</span>
          {inf.kind === "statement" ? ": " : " — "}
          <span className="text-slate-700 dark:text-slate-300">“{inf.text}”</span>
          <span className="ml-1 whitespace-nowrap text-slate-600 dark:text-slate-400">
            → {poleLabel(a.axis, inf.toward)}
          </span>
          {canEdit && (
            <Link
              href={`/quiz/${slug}?edit=${inf.kind}:${inf.itemId}`}
              className={`ml-2 text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white ${focusRing}`}
            >
              change
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function Overview({
  slug,
  result,
  canEdit,
  accent,
  quick,
}: {
  slug: string;
  result: QuizResult;
  canEdit: boolean;
  accent: string;
  quick: boolean;
}) {
  const top = result.ideologies[0];
  const byAxis = new Map(result.axes.map((a) => [a.axis, a]));
  const convictions = [...result.axes]
    .filter((a) => a.answered > 0 && a.confidence !== "low")
    .sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean))
    .slice(0, CONVICTIONS);
  const breaks = [...top.comparisons].filter((c) => c.gap >= BREAK_GAP).sort((a, b) => b.gap - a.gap);
  const shownConvictions = new Set(convictions.map((a) => a.axis));
  const core = new Set(top.ideology.core ?? result.axes.map((a) => a.axis));
  const beyond = [...result.axes]
    .filter((a) => !core.has(a.axis) && !shownConvictions.has(a.axis))
    .filter((a) => a.answered > 0 && a.confidence !== "low" && Math.abs(a.mean) >= BEYOND_MIN)
    .sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean))
    .slice(0, 4);
  const you: Omit<AxisMarker, "value"> = { label: marker(canEdit), shape: "ring", color: accent };
  const them: Omit<AxisMarker, "value"> = { label: top.ideology.name, shape: "diamond" };

  const breakRow = (c: (typeof breaks)[number], i: number) => {
    const a = byAxis.get(c.axis);
    return (
      <li key={c.axis} className="wv-fade" style={{ ["--i" as string]: i }}>
        <AxisComparisonRow
          axis={c.axis}
          you={{ ...you, value: c.you }}
          them={{ ...them, value: c.them }}
          animate
          index={i}
          detail={
            <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <dl className="space-y-1.5">
                <div className="flex gap-2">
                  <dt className="text-slate-600 dark:text-slate-400">{marker(canEdit)}:</dt>
                  <dd className="font-semibold text-slate-950 dark:text-white">{positionLabel(c.axis, c.you)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-600 dark:text-slate-400">{top.ideology.name}:</dt>
                  <dd className="font-semibold text-slate-950 dark:text-white">{positionLabel(c.axis, c.them)}</dd>
                </div>
                {!core.has(c.axis) && (
                  <dd className={metaText}>Not one of {top.ideology.name}&apos;s defining axes.</dd>
                )}
              </dl>
              {a && (
                <div>
                  <p className={`mb-1.5 ${labelText}`}>{canEdit ? "Your answers behind it" : "Answers behind it"}</p>
                  {influencesList(a, slug, canEdit, 2)}
                </div>
              )}
            </div>
          }
        />
      </li>
    );
  };

  return (
    <AnalysisSection
      id="overview"
      icon={Gauge}
      kicker="Overview"
      title={canEdit ? "What shaped your result" : "What shaped this result"}
      description="The positions held most firmly, then where they part from the closest tradition."
    >
      <h3 className={subhead}>Strongest convictions</h3>
      <p className={metaText}>
        Strength is how far from balanced a position sits; certainty is how consistently the answers placed it.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {convictions.map((a, i) => {
          const def = axisById[a.axis];
          return (
            <article
              key={a.axis}
              className="wv-rise flex flex-col rounded-xl border border-slate-200 p-4 transition-colors hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
              style={{ ["--i" as string]: i }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`${metaText} font-medium`}>{def.name}</p>
                <Link
                  href={viewHref(slug, "axes", `axis-${a.axis}`)}
                  aria-label={`Full analysis of ${def.name}`}
                  className={`-m-1 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white ${focusRing}`}
                >
                  <ArrowUpRight size={16} aria-hidden />
                </Link>
              </div>
              <p className="mt-0.5 text-lg leading-snug font-semibold tracking-tight text-slate-950 dark:text-white">
                {positionLabel(a.axis, a.mean)}
              </p>
              <div className="mt-3">
                <AxisTrack
                  axis={a.axis}
                  markers={[{ ...you, value: a.mean }]}
                  band={[a.mean - a.sd, a.mean + a.sd]}
                  fill={accent}
                  size="sm"
                  animate
                  delay={i * 90}
                />
                <AxisPoles axis={a.axis} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[13px] dark:border-slate-800">
                <div>
                  <dt className="text-slate-600 dark:text-slate-400">Strength</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100">
                    {STRENGTH_LABEL[strengthOf(a.mean)]}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600 dark:text-slate-400">Certainty</dt>
                  <dd className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                    <ConfidenceMeter level={a.confidence} />
                    {CERTAINTY_WORD[a.confidence]}
                  </dd>
                </div>
              </dl>
              <ExpandableAnalysis
                className="mt-2"
                chevron="start"
                summaryClassName="py-1"
                summary={<span className={metaText}>Answers behind it · {a.answered}</span>}
              >
                <div className="mt-1 pl-1">{influencesList(a, slug, canEdit)}</div>
              </ExpandableAnalysis>
            </article>
          );
        })}
      </div>

      {!quick && (
        <div className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <h3 className={subhead}>
                Where {canEdit ? "you break" : "this profile breaks"} from {top.ideology.name}
              </h3>
              <p className={metaText}>
                Largest gaps first, in points apart on a 0–100 scale. Open a row for the answers behind it.
              </p>
            </div>
            {breaks.length > 0 && <MarkerLegend markers={[you, them]} />}
          </div>
          {breaks.length === 0 ? (
            <div className="mt-3">
              <p className="text-base leading-7 text-slate-700 dark:text-slate-300">
                Nowhere: {canEdit ? "you line" : "this profile lines"} up with {top.ideology.name} on every axis it
                defines.
                {beyond.length > 0 && ` Where ${canEdit ? "you go" : "it goes"} beyond it:`}
              </p>
              {beyond.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {beyond.map((a) => (
                    <Link
                      key={a.axis}
                      href={viewHref(slug, "axes", `axis-${a.axis}`)}
                      className={`${chip} hover:border-slate-400 ${focusRing}`}
                    >
                      <span className="text-slate-600 dark:text-slate-400">{axisById[a.axis].name}:</span>
                      <span className="font-semibold text-slate-950 dark:text-white">
                        {positionLabel(a.axis, a.mean)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <ul className="mt-3 divide-y divide-slate-100 border-y border-slate-100 dark:divide-slate-800/80 dark:border-slate-800/80">
                {breaks.slice(0, BREAKS_SHOWN).map(breakRow)}
              </ul>
              {breaks.length > BREAKS_SHOWN && (
                <ExpandableAnalysis
                  chevron="start"
                  summaryClassName="py-2 text-sm font-medium text-slate-700 dark:text-slate-300"
                  summary={<>{breaks.length - BREAKS_SHOWN} smaller gaps</>}
                >
                  <ul className="divide-y divide-slate-100 border-b border-slate-100 dark:divide-slate-800/80 dark:border-slate-800/80">
                    {breaks.slice(BREAKS_SHOWN).map((c, i) => breakRow(c, i))}
                  </ul>
                </ExpandableAnalysis>
              )}
              <Link
                href={viewHref(slug, "traditions", `match-${top.ideology.id}`)}
                className={`mt-3 inline-flex items-center gap-1 text-sm ${textLink}`}
              >
                Full axis-by-axis comparison <ArrowRight size={14} aria-hidden />
              </Link>
            </>
          )}
        </div>
      )}
    </AnalysisSection>
  );
}

// ── Map ──

function MapPreview({
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
  return (
    <section
      id="map"
      aria-label="Political map"
      className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 dark:border-slate-800 dark:bg-slate-950"
    >
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
    </section>
  );
}

// ── Positions ──

function PositionsPreview({
  slug,
  result,
  canEdit,
  accent,
  quick,
}: {
  slug: string;
  result: QuizResult;
  canEdit: boolean;
  accent: string;
  quick: boolean;
}) {
  const top = result.ideologies[0];
  const measured = measuredAxes(result);
  const byAxis = new Map(result.axes.map((a) => [a.axis, a]));
  const rows = measured
    .map((d) => byAxis.get(d.id)!)
    .filter((a) => a.confidence !== "low")
    .sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean))
    .slice(0, POSITIONS_SHOWN);
  const you = { label: marker(canEdit), shape: "ring" as const, color: accent };
  const them = { label: top.ideology.name, shape: "diamond" as const };
  return (
    <AnalysisSection
      id="positions"
      icon={Compass}
      kicker={canEdit ? "Your positions" : "Positions"}
      title={`The ${rows.length} most decided of ${measured.length} axes`}
      description="0 to 100, balanced at 50. The band is the likely range."
      actions={
        <Link href={viewHref(slug, "axes")} className={btnSecondary}>
          All {measured.length} axes <ArrowRight size={15} aria-hidden />
        </Link>
      }
    >
      <MarkerLegend markers={quick ? [you] : [you, them]} className="mb-5" />
      <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
        {rows.map((a, i) => (
          <PoliticalAxis
            key={a.axis}
            axis={a.axis}
            markers={
              quick
                ? [{ ...you, value: a.mean }]
                : [
                    { ...you, value: a.mean },
                    { ...them, value: top.ideology.position[a.axis] },
                  ]
            }
            band={[a.mean - a.sd, a.mean + a.sd]}
            fill={accent}
            animate
            delay={i * 60}
            extra={<ConfidenceMeter level={a.confidence} />}
            detailLabel={canEdit ? "Why you landed here" : "Why this placement"}
            detail={influencesList(a, slug, canEdit)}
          />
        ))}
      </div>
    </AnalysisSection>
  );
}

// ── Compare ──

function CompareSection({ slug, result, canEdit }: { slug: string; result: QuizResult; canEdit: boolean }) {
  const ids = (n: number) =>
    result.ideologies
      .slice(0, n)
      .map((m) => m.ideology.id)
      .join(",");
  const [first, second, third] = result.ideologies;
  return (
    <AnalysisSection
      id="compare"
      icon={MapIcon}
      kicker="Compare"
      title="How the nearest traditions stack up"
      description={`All ${result.ideologies.length} traditions are scored the same way; these are the closest eight.`}
      actions={
        <Link href={`/atlas/compare?ids=${ids(3)}&from=${slug}`} className={btnPrimary}>
          Compare top 3 side by side <ArrowRight size={15} aria-hidden />
        </Link>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <SimilarityBars
          animate
          items={result.ideologies.slice(0, 8).map((m) => ({
            id: m.ideology.id,
            name: m.ideology.name,
            family: m.ideology.family,
            value: m.match,
            href: viewHref(slug, "traditions", `match-${m.ideology.id}`),
          }))}
        />
        <div className="space-y-2.5">
          <p className={labelText}>Open a comparison</p>
          {second && (
            <TraditionRow
              href={`/atlas/compare?ids=${first.ideology.id},${second.ideology.id}&from=${slug}`}
              name={`${first.ideology.name} vs. ${second.ideology.name}`}
              family={second.ideology.family}
              meta={`#1 and #2 · ${first.match - second.match} points apart`}
            />
          )}
          {third && (
            <TraditionRow
              href={`/atlas/compare?ids=${first.ideology.id},${third.ideology.id}&from=${slug}`}
              name={`${first.ideology.name} vs. ${third.ideology.name}`}
              family={third.ideology.family}
              meta="#1 and #3"
            />
          )}
          <Link
            href={viewHref(slug, "traditions")}
            className={`inline-flex items-center gap-1 pt-1 text-sm ${textLink}`}
          >
            Full ranking with axis-by-axis detail <ArrowRight size={14} aria-hidden />
          </Link>
          {canEdit && <p className={`pt-2 ${metaText}`}>Your markers come along to the comparison.</p>}
        </div>
      </div>
    </AnalysisSection>
  );
}

// ── History and reading ──

function LearnSection({ slug, result }: { slug: string; result: QuizResult }) {
  const top = result.ideologies[0].ideology;
  const history = HISTORY[top.id];
  const color = familyColor(top.family);
  return (
    <AnalysisSection
      id="learn"
      icon={Landmark}
      kicker="History & reading"
      title={`${top.name} in history`}
      description="Origins, historical parallels, and reading."
      actions={
        <Link href={`/atlas/philosophies/${top.id}?from=${slug}`} className={btnSecondary}>
          Full Atlas entry <ArrowRight size={15} aria-hidden />
        </Link>
      }
    >
      <dl className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-900/60">
          <dt className={metaText}>Began</dt>
          <dd className="font-semibold text-slate-950 dark:text-white">{history.origins.when}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-900/60">
          <dt className={metaText}>Where</dt>
          <dd className="font-semibold text-slate-950 dark:text-white">{history.origins.where}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-900/60">
          <dt className={`inline-flex items-center gap-1 ${metaText}`}>
            <UserRound size={13} aria-hidden /> Key figures
          </dt>
          <dd className="font-semibold text-slate-950 dark:text-white">{history.figures.join(", ")}</dd>
        </div>
      </dl>
      <div className="grid gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h3 className={`mb-3 ${subhead}`}>Historical comparisons</h3>
          <HistoricalParallels
            comparisons={history.comparisons}
            color={color}
            traditionName={top.name}
            originText={history.origins.when}
          />
        </div>
        <div className="min-w-0">
          <h3 className={`flex items-center gap-2 ${subhead}`}>
            <ScrollText size={18} aria-hidden className="text-slate-500" /> Where to start reading
          </h3>
          <ReadingList
            texts={history.texts.slice(0, 1)}
            books={history.books.slice(0, 3)}
            color={color}
            grouped={false}
          />
          <Link
            href={`/atlas/philosophies/${top.id}?from=${slug}#reading`}
            className={`mt-2 inline-flex items-center gap-1 text-sm ${textLink}`}
          >
            Full reading list <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </AnalysisSection>
  );
}

// ── More ──

const VIEW_TITLE: Record<ResultView, string> = {
  traditions: "Closest traditions",
  map: "Political map",
  axes: "Every axis",
  issues: "Issue by issue",
};

function More({
  slug,
  result,
  canEdit,
  mode,
  ownership,
}: {
  slug: string;
  result: QuizResult;
  canEdit: boolean;
  mode: QuizModeId;
  ownership?: ReactNode;
}) {
  const high = result.profiles.filter((p) => p.importance === 3).length;
  const stat: Record<ResultView, string> = {
    traditions: `All ${result.ideologies.length} ranked, with axis-by-axis detail`,
    map: `${ideologies.length} traditions on the two directions that separate them most`,
    axes: `${measuredAxes(result).length} axes and the answers behind each`,
    issues:
      result.profiles.length === 0
        ? "No issues answered yet"
        : `${result.profiles.length} issues${high > 0 ? ` · ${high} marked high importance` : ""}`,
  };
  const tools = canEdit
    ? [
        { href: `/atlas/economy?from=${slug}`, label: "Economic Foundations" },
        { href: `/atlas/authority?from=${slug}`, label: "Government & Authority" },
        { href: `/atlas/foreign-policy?from=${slug}`, label: "Foreign Policy" },
        { href: "/atlas/me", label: "Your Atlas" },
      ]
    : [];
  return (
    <section
      id="more"
      aria-labelledby="more-title"
      className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 dark:border-slate-800 dark:bg-slate-950"
    >
      <h2 id="more-title" className={subhead}>
        {canEdit ? "Go deeper into your profile" : "The full profile"}
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {resultViews(result, mode).map((v) => (
          <li key={v.id}>
            <Link
              href={viewHref(slug, v.id)}
              className={`group flex h-full items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-slate-400 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-900/40 ${focusRing}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-950 dark:text-white">{VIEW_TITLE[v.id]}</span>
                <span className={`mt-0.5 block ${metaText}`}>{stat[v.id]}</span>
              </span>
              <ArrowRight
                size={16}
                aria-hidden
                className="mt-1 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className={metaText}>Specialist assessments:</span>
          {tools.map((l) => (
            <Link key={l.href} href={l.href} className={textLink}>
              {l.label}
            </Link>
          ))}
          <a href={everyChurchQuizUrl} rel="noreferrer" className={textLink}>
            Christian beliefs on EveryChurch ↗
          </a>
        </div>
      )}
      {ownership && <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">{ownership}</div>}
    </section>
  );
}
