import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Fingerprint, Handshake, Ruler, Split, Tags } from "lucide-react";
import {
  philosophyById,
  philosophyProfiles,
  nearestPhilosophies,
  type PhilosophyProfile,
} from "@/lib/atlas/philosophies";
import { axisById, axes } from "@/lib/quiz/axes";
import { familyColor } from "@/lib/quiz/families";
import { getQuizSession } from "@/lib/db/quizSessions";
import { quizAccess, SLUG_PATTERN } from "@/lib/quiz/access";
import { computeState } from "@/lib/quiz/engine";
import { computeResult } from "@/lib/quiz/results";
import type { AxisId } from "@/lib/quiz/types";
import { compareTraditions } from "@/lib/politics/compare";
import { positionLabel } from "@/lib/politics/axis-language";
import { BackToResult } from "@/components/atlas/back-to-result";
import { ComparePicker } from "@/components/atlas/compare/compare-picker";
import { CompareWorkspace, type ComparedYou } from "@/components/atlas/compare/compare-workspace";
import { MAX_COMPARED, SHAPES } from "@/components/atlas/compare/shapes";
import { MarkerGlyph } from "@/components/politics/axis";
import { AnalysisSection } from "@/components/politics/section";
import { chip, focusRing, labelText, metaText, subhead } from "@/components/politics/type";

export const metadata: Metadata = { title: "Compare traditions · Worldview Atlas" };

const SUGGESTED: [string, string][] = [
  ["social-democracy", "democratic-socialism"],
  ["classical-liberalism", "libertarianism"],
  ["national-conservatism", "right-populism"],
  ["christian-democracy", "integralism"],
  ["marxism-leninism", "anarcho-communism"],
  ["groyper", "clerical-fascism"],
];

// A quiz result's axis positions, when "?from=" names one the viewer may see.
async function loadYou(from: string | undefined): Promise<ComparedYou | undefined> {
  if (!from || !SLUG_PATTERN.test(from)) return undefined;
  const session = await getQuizSession(from);
  if (!session) return undefined;
  const access = await quizAccess(session);
  if (!access.canView) return undefined;
  const result = computeResult(session.answers, session.refine, computeState(session.answers, session.refine));
  const positions: Partial<Record<AxisId, number>> = {};
  for (const a of result.axes) if (a.answered > 0) positions[a.axis] = a.mean;
  return { label: access.canEdit ? "You" : "Quiz profile", positions };
}

function Tag({ index, profile }: { index: number; profile: PhilosophyProfile }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-950 dark:text-white">
      <MarkerGlyph shape={SHAPES[index]} color={familyColor(profile.ideology.family)} size={12} />
      {profile.ideology.name}
    </span>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[]; from?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.ids === "string" ? sp.ids : "";
  const ids = [...new Set(raw.split(",").filter(Boolean))].slice(0, MAX_COMPARED);
  const profiles = ids.flatMap((id) => {
    const p = philosophyById.get(id);
    return p ? [p] : [];
  });
  const selected = profiles.map((p) => p.ideology.id);
  const options = philosophyProfiles.map((p) => ({
    id: p.ideology.id,
    name: p.ideology.name,
    family: p.ideology.family,
  }));
  const you = await loadYou(typeof sp.from === "string" ? sp.from : undefined);
  const fromQuery = you && typeof sp.from === "string" ? `&from=${sp.from}` : "";

  const header = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/atlas/philosophies"
          className={`inline-flex items-center gap-1 rounded-md text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white ${focusRing}`}
        >
          <ArrowLeft size={14} aria-hidden /> Philosophies
        </Link>
        <Suspense>
          <BackToResult />
        </Suspense>
      </div>
      <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
        Compare traditions
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-300">
        Up to three traditions on the same 20 axes.
        {you && " The ring is you."}
      </p>
      <div className="mt-5">
        <Suspense>
          <ComparePicker options={options} selected={selected} />
        </Suspense>
      </div>
    </>
  );

  if (profiles.length < 2) {
    const only = profiles[0];
    return (
      <div className="mx-auto max-w-6xl pb-16">
        {header}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 dark:border-slate-800 dark:bg-slate-950">
          {only ? (
            <>
              <h2 className={subhead}>Compare {only.ideology.name} with its nearest neighbors</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {nearestPhilosophies(only.ideology).map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/atlas/compare?ids=${only.ideology.id},${n.id}${fromQuery}`}
                      className={`${chip} hover:border-slate-400 ${focusRing}`}
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: familyColor(n.family) }}
                        aria-hidden
                      />
                      + {n.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2 className={subhead}>Choose two or three traditions, or start from a pairing</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {SUGGESTED.flatMap(([a, b]) => {
                  const pa = philosophyById.get(a);
                  const pb = philosophyById.get(b);
                  if (!pa || !pb) return [];
                  return [
                    <li key={`${a}-${b}`}>
                      <Link
                        href={`/atlas/compare?ids=${a},${b}${fromQuery}`}
                        className={`flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-medium text-slate-950 transition-colors hover:border-slate-400 dark:border-slate-800 dark:text-white dark:hover:border-slate-600 ${focusRing}`}
                      >
                        <MarkerGlyph shape="diamond" color={familyColor(pa.ideology.family)} size={12} />
                        {pa.ideology.name}
                        <span className="text-slate-500">vs.</span>
                        <MarkerGlyph shape="square" color={familyColor(pb.ideology.family)} size={12} />
                        {pb.ideology.name}
                      </Link>
                    </li>,
                  ];
                })}
              </ul>
            </>
          )}
        </section>
      </div>
    );
  }

  const ideos = profiles.map((p) => p.ideology);
  const analysis = compareTraditions(ideos);
  const nameOf = new Map(profiles.map((p, i) => [p.ideology.id, { profile: p, index: i }]));
  const lensRows = profiles[0].lenses.map((l, i) => {
    const sets = profiles.map((p) =>
      p.lenses[i].answer === "No set position" ? null : p.lenses[i].answer.split(", "),
    );
    const known = sets.filter((s): s is string[] => !!s);
    const shared = known.length === sets.length && known.reduce((acc, s) => acc.filter((v) => s.includes(v)), known[0]);
    return { label: l.label, sets, shared: shared && shared.length > 0 ? shared : null };
  });

  return (
    <div className="mx-auto max-w-6xl pb-16">
      {header}

      {/* Summary */}
      <section aria-label="Summary" className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="wv-rise rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className={`flex items-center gap-1.5 ${labelText}`}>
            <Ruler size={15} aria-hidden className="text-slate-500" /> Overall distance
          </p>
          <ul className="mt-3 space-y-3">
            {analysis.pairs.map((p) => (
              <li key={`${p.a}-${p.b}`} className="text-sm">
                <span className="flex flex-wrap items-center gap-x-1.5">
                  <Tag {...nameOf.get(p.a)!} />
                  <span className="text-slate-500">↔</span>
                  <Tag {...nameOf.get(p.b)!} />
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <span
                      className="wv-grow block h-full rounded-full bg-slate-700 dark:bg-slate-300"
                      style={{ width: `${p.points}%` }}
                    />
                  </span>
                  <span className="w-14 text-right font-semibold text-slate-950 tabular-nums dark:text-white">
                    {p.points} pts
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className={`mt-3 ${metaText}`}>Average distance across all 20 axes, 0–100.</p>
        </div>

        <div
          className="wv-rise rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
          style={{ ["--i" as string]: 1 }}
        >
          <p className={`flex items-center gap-1.5 ${labelText}`}>
            <Handshake size={15} aria-hidden className="text-slate-500" /> Shared ground
          </p>
          {analysis.shared.length === 0 ? (
            <p className={`mt-3 ${metaText}`}>No axis where all {profiles.length} take the same firm position.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {analysis.shared.map((r) => (
                <li key={r.axis}>
                  <a
                    href={`#row-${r.axis}`}
                    className={`rounded font-semibold text-slate-950 hover:underline dark:text-white ${focusRing}`}
                  >
                    {axisById[r.axis].name}
                  </a>
                  <span className="block text-slate-700 dark:text-slate-300">
                    All {positionLabel(r.axis, r.mean).toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="wv-rise rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
          style={{ ["--i" as string]: 2 }}
        >
          <p className={`flex items-center gap-1.5 ${labelText}`}>
            <Split size={15} aria-hidden className="text-slate-500" /> Biggest splits
          </p>
          {analysis.splits.length === 0 ? (
            <p className={`mt-3 ${metaText}`}>No axis where they sit far apart.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {analysis.splits.map((r) => (
                <li key={r.axis} className="flex items-baseline justify-between gap-3">
                  <a
                    href={`#row-${r.axis}`}
                    className={`rounded font-semibold text-slate-950 hover:underline dark:text-white ${focusRing}`}
                  >
                    {axisById[r.axis].name}
                  </a>
                  <span className="shrink-0 text-slate-700 tabular-nums dark:text-slate-300">
                    {Math.round(r.spread * 50)} pts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="wv-rise rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
          style={{ ["--i" as string]: 3 }}
        >
          <p className={`flex items-center gap-1.5 ${labelText}`}>
            <Fingerprint size={15} aria-hidden className="text-slate-500" />{" "}
            {analysis.distinctive.length ? "What sets each apart" : "Defining axes"}
          </p>
          <ul className="mt-3 space-y-2.5 text-sm">
            {analysis.distinctive.length
              ? analysis.distinctive.map((d) => (
                  <li key={d.id}>
                    <Tag {...nameOf.get(d.id)!} />
                    <span className="block text-slate-700 dark:text-slate-300">
                      {axisById[d.axis].name}: {positionLabel(d.axis, d.value).toLowerCase()}
                    </span>
                  </li>
                ))
              : profiles.map((p, i) => (
                  <li key={p.ideology.id}>
                    <Tag index={i} profile={p} />
                    <span className="block text-slate-700 dark:text-slate-300">
                      {(p.ideology.core ?? axes.map((a) => a.id))
                        .slice(0, 4)
                        .map((a) => axisById[a].name)
                        .join(", ")}
                    </span>
                  </li>
                ))}
          </ul>
        </div>
      </section>

      <AnalysisSection
        id="axes"
        icon={Ruler}
        kicker="Axis by axis"
        title="Positions on every axis"
        description="0 to 100 per axis; the right-hand figure is the widest gap."
        className="mt-5"
      >
        <CompareWorkspace
          traditions={profiles.map((p) => ({
            id: p.ideology.id,
            name: p.ideology.name,
            family: p.ideology.family,
            position: p.ideology.position,
            core: p.ideology.core ?? axes.map((a) => a.id),
          }))}
          you={you}
        />
      </AnalysisSection>

      <AnalysisSection
        id="lenses"
        icon={Tags}
        kicker="Categorical positions"
        title="Beyond the axes"
        description="Questions with categorical answers rather than a scale."
        className="mt-5"
      >
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          <div
            className="hidden gap-x-6 pb-2 md:grid md:grid-cols-[12rem_repeat(var(--n),minmax(0,1fr))]"
            style={{ ["--n" as string]: profiles.length }}
          >
            <span />
            {profiles.map((p, i) => (
              <Link
                key={p.ideology.id}
                href={`/atlas/philosophies/${p.ideology.id}`}
                className={`w-fit rounded text-sm hover:underline ${focusRing}`}
              >
                <Tag index={i} profile={p} />
              </Link>
            ))}
          </div>
          {lensRows.map((l) => (
            <div
              key={l.label}
              className="grid gap-x-6 gap-y-2 py-3.5 md:grid-cols-[12rem_repeat(var(--n),minmax(0,1fr))]"
              style={{ ["--n" as string]: profiles.length }}
            >
              <p className="font-medium text-slate-950 dark:text-white">
                {l.label}
                {l.shared && (
                  <span className="mt-1 block w-fit rounded-full bg-agree-500/15 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                    Shared: {l.shared.join(", ")}
                  </span>
                )}
              </p>
              {profiles.map((p, i) => (
                <div key={p.ideology.id} className="min-w-0">
                  <p className="mb-1 md:hidden">
                    <Tag index={i} profile={p} />
                  </p>
                  {l.sets[i] ? (
                    <div className="flex flex-wrap gap-1.5">
                      {l.sets[i]!.map((v) => (
                        <span key={v} className={`${chip} ${l.shared?.includes(v) ? "border-agree-500/60" : ""}`}>
                          {v}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-600 italic dark:text-slate-400">No set position</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </AnalysisSection>
    </div>
  );
}
