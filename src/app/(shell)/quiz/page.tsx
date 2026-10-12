import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { startQuizAction } from "@/lib/actions/quiz";
import { currentUserId } from "@/lib/quiz/access";
import { listQuizSessions, UNCLAIMED_TTL_DAYS } from "@/lib/db/quizSessions";
import { statements, issues } from "@/lib/quiz/bank";
import { AXIS_GROUPS, axes, axisById } from "@/lib/quiz/axes";
import { ideologies } from "@/lib/quiz/ideologies";
import { FAMILIES, familyColor } from "@/lib/quiz/families";
import { ideologyMatches, type AxisResult, type Confidence } from "@/lib/quiz/results";
import { axisIds, type AxisId, type IdeologyFamily } from "@/lib/quiz/types";

export const metadata: Metadata = {
  title: "Political Quiz | Worldview",
  description: "An adaptive, in-depth quiz that maps your views on 17 political axes and 25 issues.",
};

export const dynamic = "force-dynamic";

// Typical length, from engine simulations (src/lib/quiz/sim.ts): respondents
// finish in 131–158 items whether they answer consistently or not.
const TYPICAL_QUESTIONS = "130–160";
const TYPICAL_MINUTES = "25–40";

// An illustrative respondent: economically interventionist, restrictive on
// immigration, socially traditional, skeptical of free trade. Their closest
// traditions below are computed by the real matcher, not typed in.
const EXAMPLE: Record<AxisId, { at: number; confidence: Confidence }> = {
  federalism: { at: -0.35, confidence: "high" },
  executive: { at: 0.2, confidence: "medium" },
  liberty: { at: 0.15, confidence: "medium" },
  voting: { at: 0.35, confidence: "high" },
  ownership: { at: 0.1, confidence: "medium" },
  regulation: { at: -0.3, confidence: "medium" },
  redistribution: { at: -0.2, confidence: "medium" },
  trade: { at: -0.6, confidence: "high" },
  engagement: { at: 0.5, confidence: "high" },
  force: { at: 0.4, confidence: "medium" },
  social: { at: 0.55, confidence: "high" },
  religion: { at: 0.35, confidence: "medium" },
  immigration: { at: 0.7, confidence: "high" },
  justice: { at: 0.45, confidence: "high" },
  identity: { at: 0.5, confidence: "high" },
  environment: { at: 0.2, confidence: "low" },
  technology: { at: -0.25, confidence: "medium" },
};
const EXAMPLE_SD: Record<Confidence, number> = { high: 0.1, medium: 0.2, low: 0.3 };
const EXAMPLE_SHOWN: AxisId[] = ["immigration", "trade", "social", "federalism", "redistribution", "environment"];

// One example issue profile, using the bank's own stance wording.
const EXAMPLE_ISSUE = "immigration";
const EXAMPLE_STANCES: Record<string, string> = {
  "immigration.undocumented": "case-by-case",
  "immigration.levels": "less",
  "immigration.selection": "skills",
  "immigration.wall": "partial",
  "immigration.dreamers": "stay",
  "immigration.interior": "workplace",
};

// Two traditions both commonly called "the right", compared on the axes
// where they sit furthest apart.
const CONTRAST: [string, string] = ["libertarianism", "national-conservatism"];
const CONTRAST_AXES = 6;

const FAMILY_ORDER: IdeologyFamily[] = ["left", "liberal", "center", "conservative", "right", "libertarian", "populist", "other"];

const CONFIDENCE_LABEL: Record<Confidence, string> = { high: "High confidence", medium: "Medium", low: "Low" };

const pos = (x: number) => `${((Math.max(-1, Math.min(1, x)) + 1) / 2) * 100}%`;

const eyebrow = "text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase";
const h2 = "mt-2 text-3xl font-semibold tracking-tight text-balance text-slate-950 dark:text-white";
const lede = "mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300";

export default async function QuizPage() {
  const userId = await currentUserId();
  const mine = userId ? await listQuizSessions(userId) : [];
  const inProgress = mine.find((q) => q.status !== "complete");
  const issueQuestions = issues.reduce((n, m) => n + 1 + m.followUps.length, 0);

  const exampleAxes: AxisResult[] = axisIds.map((axis) => ({
    axis,
    mean: EXAMPLE[axis].at,
    sd: EXAMPLE_SD[EXAMPLE[axis].confidence],
    answered: 8,
    confidence: EXAMPLE[axis].confidence,
    lowReason: null,
    influences: [],
  }));
  const exampleMatches = ideologyMatches(exampleAxes).slice(0, 5);

  const exampleIssue = issues.find((m) => m.id === EXAMPLE_ISSUE)!;
  const exampleProfile = [exampleIssue.screener, ...exampleIssue.followUps].flatMap((q) => {
    const option = q.options.find((o) => o.id === EXAMPLE_STANCES[q.id]);
    return option ? [{ attribute: q.attribute, stance: option.stance }] : [];
  });

  const [a, b] = CONTRAST.map((id) => ideologies.find((i) => i.id === id)!);
  const contrastAxes = [...axisIds]
    .sort((x, y) => Math.abs(b.position[y] - a.position[y]) - Math.abs(b.position[x] - a.position[x]))
    .slice(0, CONTRAST_AXES);

  return (
    <div className="mx-auto max-w-5xl pb-8">
      {/* ── Hero ── */}
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:pt-10">
        <div>
          <p className={eyebrow}>Political quiz</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance text-slate-950 sm:text-5xl dark:text-white">
            Where do you actually stand?
          </h1>
          <p className="mt-4 max-w-md text-lg leading-8 text-slate-600 dark:text-slate-300">
            Most quizzes put you on a chart. This one builds a model of what you believe, dimension by dimension and
            issue by issue, then compares it with {ideologies.length} political traditions.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <StartButton label={inProgress ? "Start a new quiz" : "Start the quiz"} primary />
            {inProgress && (
              <Link
                href={`/quiz/${inProgress.slug}`}
                className="rounded-xl border border-slate-300 px-5 py-3.5 text-base font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Continue where you left off
              </Link>
            )}
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-500 dark:text-slate-400">
            <li>About {TYPICAL_QUESTIONS} questions</li>
            <li>{TYPICAL_MINUTES} minutes</li>
            <li>Stop and resume anytime</li>
            <li>No account needed</li>
          </ul>
        </div>

        <ExampleResult axesShown={EXAMPLE_SHOWN} matches={exampleMatches} />
      </section>

      {/* ── Three layers ── */}
      <section className="mt-24">
        <p className={eyebrow}>What you get</p>
        <h2 className={h2}>Three layers, built from the same answers</h2>
        <p className={lede}>
          Your answers feed a set of underlying dimensions. Concrete policy questions add an issue-by-issue profile.
          Together, they&rsquo;re compared with each tradition&rsquo;s reference positions.
        </p>

        <div className="mt-10 grid gap-x-10 gap-y-12 md:grid-cols-3">
          <Layer
            n="01"
            title={`${axes.length} dimensions`}
            body="Your underlying tendencies, like states vs. federal power, free trade vs. protection, or secular vs. religious public life. Each one gets a position and a confidence level."
          >
            <div className="space-y-3">
              {(["federalism", "trade", "religion"] as AxisId[]).map((id) => (
                <MiniAxis key={id} id={id} at={EXAMPLE[id].at} />
              ))}
            </div>
          </Layer>
          <Layer
            n="02"
            title={`${issues.length} issue profiles`}
            body="What you'd actually write into law. Instead of a single pro or con score, each issue is broken into its working parts."
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{exampleIssue.name}</p>
            <dl className="mt-2 space-y-1.5 text-[13px]">
              {exampleProfile.slice(0, 4).map((p) => (
                <div key={p.attribute} className="grid grid-cols-[7.5rem_1fr] gap-2">
                  <dt className="text-slate-400">{p.attribute}</dt>
                  <dd className="text-slate-700 first-letter:uppercase dark:text-slate-200">{p.stance}</dd>
                </div>
              ))}
            </dl>
          </Layer>
          <Layer
            n="03"
            title={`${ideologies.length} traditions compared`}
            body="Schools of political thought, from social democracy to national conservatism. Each has reference positions on every dimension, and you see how close you sit to each one and where you differ."
          >
            <div className="flex flex-wrap gap-1.5">
              {FAMILY_ORDER.map((f) => (
                <FamilyChip key={f} family={f} />
              ))}
            </div>
          </Layer>
        </div>
      </section>

      {/* ── Why not left vs right ── */}
      <section className="mt-24 grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <p className={eyebrow}>Why not left vs. right?</p>
          <h2 className={h2}>One label can hide opposite views</h2>
          <p className={lede}>
            {a.name} and {b.name} are both usually called &ldquo;the right.&rdquo; On these {CONTRAST_AXES} dimensions
            they sit far apart. A single left–right score would put them in the same place.
          </p>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
            The same is true of real people. You can favor economic intervention, strict immigration limits,
            decentralized government, and strong environmental rules all at once. The map keeps those apart.
          </p>
        </div>
        <div className="rounded-3xl bg-slate-100/70 p-6 sm:p-8 dark:bg-slate-900/50">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            <Legend color={familyColor(a.family)} label={a.name} />
            <Legend color={familyColor(b.family)} label={b.name} hollow />
          </div>
          <div className="mt-6 space-y-5">
            {contrastAxes.map((id) => {
              const axis = axisById[id];
              return (
                <div key={id}>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{axis.name}</p>
                  <div className="relative mt-2.5 h-1.5 rounded-full bg-slate-300/70 dark:bg-slate-700">
                    <Dot at={a.position[id]} color={familyColor(a.family)} />
                    <Dot at={b.position[id]} color={familyColor(b.family)} hollow />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{axis.negative.label}</span>
                    <span>{axis.positive.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mt-24">
        <p className={eyebrow}>How it works</p>
        <h2 className={h2}>Answer, refine, explore</h2>
        <ol className="mt-10 grid gap-x-10 gap-y-10 md:grid-cols-3">
          <Step n="01" title="Answer">
            React to short statements on a seven-point scale, from strongly agree to strongly disagree. Strength counts:
            a strong answer moves a dimension further than a mild one. Issue questions ask what the law should actually
            say.
          </Step>
          <Step n="02" title="The quiz adapts">
            It starts broad. Where your answers point consistently one way, it stops asking near-duplicates. Where
            they&rsquo;re mixed or sparse, it asks more. Nothing is inferred for questions you never saw. Fewer
            questions just means the evidence was already clear.
          </Step>
          <Step n="03" title="Explore and adjust">
            See your position on every dimension with its confidence and the answers that moved it most. Change any
            answer and the results update. If a dimension&rsquo;s confidence is low, ask for more questions on it.
          </Step>
        </ol>

        <div className="mt-12 grid gap-8 border-t border-slate-200 pt-10 md:grid-cols-[1.2fr_1fr] dark:border-slate-800">
          <div>
            <p className="text-sm font-semibold text-slate-950 dark:text-white">The answer scale</p>
            <div className="mt-4 flex items-center justify-between gap-1" aria-hidden="true">
              {SCALE_PREVIEW.map((c, i) => (
                <span key={i} className={`shrink-0 rounded-full border-2 ${c.size} ${c.tone}`} />
              ))}
            </div>
            <div className="mt-2.5 grid grid-cols-3 text-xs font-medium">
              <span className="text-agree-600 dark:text-agree-400">Strongly agree</span>
              <span className="text-center text-slate-500">Neutral</span>
              <span className="text-right text-disagree-600 dark:text-disagree-400">Strongly disagree</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Seven points: strongly agree, agree, somewhat agree, neutral, and the same three on the disagree side.
              Neutral means you hold a middle view, and it counts. <strong className="font-semibold text-slate-800 dark:text-slate-200">Not sure</strong>{" "}
              is a separate button. It skips the question and doesn&rsquo;t move your results, so not knowing is never
              scored as moderation.
            </p>
          </div>
          <dl className="space-y-4 text-sm">
            <Fact q="Can I stop halfway?">Yes. Every answer is saved, and the link picks up where you left off.</Fact>
            <Fact q="Can I change answers?">Yes. Step back during the quiz, or change any answer from the results page.</Fact>
            <Fact q="How long is it?">
              The number of questions adapts to you. Most people answer about {TYPICAL_QUESTIONS}, which takes{" "}
              {TYPICAL_MINUTES} minutes. You can preview your profile after 15 answers.
            </Fact>
          </dl>
        </div>
      </section>

      {/* ── What we measure ── */}
      <section className="mt-24">
        <p className={eyebrow}>What we measure</p>
        <h2 className={h2}>Inspect the model before you start</h2>
        <p className={lede}>
          Every dimension, issue, and tradition the quiz uses. Open any one to see how it&rsquo;s defined.
        </p>

        <div className="mt-10 grid gap-x-10 gap-y-12 lg:grid-cols-3">
          <div>
            <ColumnHead count={axes.length} label="Dimensions" />
            {AXIS_GROUPS.map((g) => (
              <div key={g.id} className="mt-5">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">{g.label}</p>
                <ul className="mt-1 divide-y divide-slate-200/70 dark:divide-slate-800">
                  {axes
                    .filter((x) => x.group === g.id)
                    .map((x) => (
                      <Expander key={x.id} title={x.name} meta={`${x.negative.label} ↔ ${x.positive.label}`}>
                        <p>
                          <span className="font-medium text-slate-800 dark:text-slate-200">{x.negative.label}:</span>{" "}
                          {x.negative.description}
                        </p>
                        <p className="mt-1.5">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{x.positive.label}:</span>{" "}
                          {x.positive.description}
                        </p>
                      </Expander>
                    ))}
                </ul>
              </div>
            ))}
          </div>

          <div>
            <ColumnHead count={issues.length} label="Issue profiles" />
            <ul className="mt-5 divide-y divide-slate-200/70 dark:divide-slate-800">
              {issues.map((m) => {
                const parts = [m.screener, ...m.followUps].map((q) => q.attribute);
                return (
                  <Expander key={m.id} title={m.name} meta={`${parts.length} parts`}>
                    <ul className="flex flex-wrap gap-1.5">
                      {parts.map((p) => (
                        <li key={p} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                          {p}
                        </li>
                      ))}
                    </ul>
                  </Expander>
                );
              })}
            </ul>
          </div>

          <div>
            <ColumnHead count={ideologies.length} label="Traditions" />
            <div className="mt-3" />
            {FAMILY_ORDER.map((f) => {
              const members = ideologies.filter((i) => i.family === f);
              if (members.length === 0) return null;
              return (
                <details key={f} className="group/family border-b border-slate-200/70 dark:border-slate-800">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm">
                    <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                      <span className="size-2 rounded-full" style={{ backgroundColor: familyColor(f) }} />
                      {FAMILIES[f].label}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="max-w-44 truncate">{members.map((i) => i.name).slice(0, 2).join(", ")}…</span>
                      <span className="tabular-nums">{members.length}</span>
                      <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open/family:rotate-180" />
                    </span>
                  </summary>
                  <ul className="divide-y divide-slate-200/70 pb-2 pl-4 dark:divide-slate-800">
                    {members.map((i) => (
                      <Expander key={i.id} title={i.name}>
                        <p>{i.description}</p>
                        <p className="mt-1.5 text-xs text-slate-500">
                          Defined mainly by{" "}
                          {(i.core ?? axisIds).length === axisIds.length
                            ? "all dimensions"
                            : (i.core ?? axisIds).map((id) => axisById[id].name.toLowerCase()).join(", ")}
                          .
                        </p>
                      </Expander>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Scoring + privacy ── */}
      <section className="mt-24 grid gap-x-12 gap-y-14 lg:grid-cols-2">
        <div>
          <p className={eyebrow}>How results are calculated</p>
          <h2 className={h2}>No single left–right score</h2>
          <ul className="mt-6 space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
            <Point title="Dimensions are estimated separately.">
              Each statement is written for one dimension and may count a little toward related ones. Your position
              on each dimension is estimated from the direction and strength of every answer that bears on it.
            </Point>
            <Point title="Confidence comes from the evidence.">
              Few answers, or answers that pull in opposite directions, mean lower confidence. Results show confidence
              for every dimension, and a dimension with mixed answers shows as mixed.
            </Point>
            <Point title="Issue answers are your own words.">
              Issue profiles report the options you chose. They also inform the dimensions, weighted by how important
              you said the issue is.
            </Point>
            <Point title="Traditions are reference points.">
              Each tradition has a hand-placed position on all {axes.length} dimensions, with the dimensions that
              define it counting fully and the rest at half weight. Matching measures the distance from your profile,
              and your best-measured dimensions count most.
            </Point>
            <Point title="Skips carry no weight.">
              A skipped or &ldquo;not sure&rdquo; question is left out entirely. It doesn&rsquo;t pull you toward the
              middle.
            </Point>
          </ul>
        </div>

        <div>
          <p className={eyebrow}>Your answers</p>
          <h2 className={h2}>Private until you decide otherwise</h2>
          <ul className="mt-6 space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
            <Point title="No name or email to start.">
              Your quiz lives at a random link. Only the browser that started it can answer or change it.
            </Point>
            <Point title={`Deleted after ${UNCLAIMED_TTL_DAYS} days unless you keep it.`}>
              Answers are stored on our server so you can resume. If you don&rsquo;t sign in to keep the quiz within{" "}
              {UNCLAIMED_TTL_DAYS} days, it&rsquo;s deleted.
            </Point>
            <Point title="Sharing is your call.">
              Before you sign in, anyone you give the link to can view the results. Once you keep a quiz on your account,
              you choose public or private, and you can delete it at any time.
            </Point>
          </ul>
        </div>
      </section>

      {mine.length > 0 && (
        <section className="mt-24">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Your quizzes</h2>
          <ul className="mt-3 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {mine.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/quiz/${q.slug}`}
                  className="flex items-center justify-between px-1 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <span className="text-slate-900 dark:text-slate-100">
                    {q.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    <span className="ml-2 text-slate-400">{q.answers.length} answers</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {q.status === "complete" ? "Complete" : "In progress"} · {q.visibility === "private" ? "Private" : "Public"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Final CTA ── */}
      <section className="mt-24 flex flex-col items-center gap-4 rounded-3xl bg-slate-950 px-6 py-14 text-center text-white dark:bg-slate-900/60">
        <h2 className="text-3xl font-semibold tracking-tight text-balance">Find out where you stand</h2>
        <p className="max-w-md text-sm leading-6 text-slate-400">
          {statements.length} statements and {issueQuestions} issue questions in the bank. The quiz picks the ones
          that tell it the most about you.
        </p>
        <div className="mt-2">
          <StartButton label="Start the quiz" inverted />
        </div>
      </section>
    </div>
  );
}

const SCALE_PREVIEW = [
  { size: "size-10", tone: "border-agree-500/70" },
  { size: "size-8", tone: "border-agree-500/70" },
  { size: "size-6", tone: "border-agree-500/70" },
  { size: "size-5", tone: "border-slate-400 dark:border-slate-600" },
  { size: "size-6", tone: "border-disagree-500/70" },
  { size: "size-8", tone: "border-disagree-500/70" },
  { size: "size-10", tone: "border-disagree-500/70" },
];

function StartButton({ label, primary, inverted }: { label: string; primary?: boolean; inverted?: boolean }) {
  const tone = inverted
    ? "bg-white text-slate-950 hover:bg-slate-200"
    : "bg-slate-950 text-white shadow-lg shadow-slate-950/10 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200";
  return (
    <form action={startQuizAction}>
      <button
        type="submit"
        className={`group inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold transition-colors ${tone}`}
      >
        {label}
        <ArrowRight
          size={18}
          aria-hidden="true"
          className={primary ? "transition-transform group-hover:translate-x-0.5" : undefined}
        />
      </button>
    </form>
  );
}

function ExampleResult({
  axesShown,
  matches,
}: {
  axesShown: AxisId[];
  matches: ReturnType<typeof ideologyMatches>;
}) {
  return (
    <div aria-label="Example result" className="relative">
      <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-linear-to-br from-agree-500/15 via-transparent to-disagree-500/15 blur-2xl" />
      <div className="rounded-3xl bg-slate-950 px-6 py-7 text-slate-100 shadow-2xl shadow-black/20 ring-1 ring-white/5 sm:px-8">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Example result</p>

        <p className="mt-5 text-xs font-medium text-slate-400">Closest traditions</p>
        <ol className="mt-2.5 space-y-2">
          {matches.map((m, i) => (
            <li key={m.ideology.id} className="grid grid-cols-[1.25rem_1fr_2.75rem] items-center gap-2 text-sm">
              <span className="text-xs text-slate-500 tabular-nums">{i + 1}</span>
              <span className="relative">
                <span
                  className="absolute inset-y-0 left-0 rounded-md opacity-25"
                  style={{ width: `${m.match}%`, backgroundColor: familyColor(m.ideology.family) }}
                />
                <span className={`relative block px-2 py-1 ${i === 0 ? "font-semibold text-white" : "text-slate-200"}`}>
                  {m.ideology.name}
                </span>
              </span>
              <span className="text-right font-medium text-slate-300 tabular-nums">{m.match}%</span>
            </li>
          ))}
        </ol>

        <p className="mt-7 text-xs font-medium text-slate-400">Dimensions · {axesShown.length} of {axes.length}</p>
        <div className="mt-3 space-y-3.5">
          {axesShown.map((id) => {
            const axis = axisById[id];
            const { at, confidence } = EXAMPLE[id];
            return (
              <div key={id}>
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-medium text-slate-100">{axis.name}</span>
                  <span className={confidence === "high" ? "text-emerald-400" : confidence === "low" ? "text-amber-400" : "text-slate-500"}>
                    {CONFIDENCE_LABEL[confidence]}
                  </span>
                </div>
                <div className="relative mt-1.5 h-1.5 rounded-full bg-linear-to-r from-agree-500/50 via-slate-700 to-disagree-500/50">
                  <span
                    className={`absolute top-1/2 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15 ${confidence === "low" ? "w-14" : confidence === "medium" ? "w-9" : "w-5"}`}
                    style={{ left: pos(at) }}
                  />
                  <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 bg-white" style={{ left: pos(at) }} />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                  <span>{axis.negative.label}</span>
                  <span>{axis.positive.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Layer({ n, title, body, children }: { n: string; title: string; body: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <p className="text-xs font-semibold text-slate-400 tabular-nums">{n}</p>
      <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{body}</p>
      <div className="mt-5 rounded-2xl bg-slate-100/70 p-4 dark:bg-slate-900/50">{children}</div>
    </div>
  );
}

function MiniAxis({ id, at }: { id: AxisId; at: number }) {
  const axis = axisById[id];
  return (
    <div>
      <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{axis.name}</p>
      <div className="relative mt-1.5 h-1 rounded-full bg-linear-to-r from-agree-500/40 via-slate-300 to-disagree-500/40 dark:via-slate-700">
        <span
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900 ring-2 ring-slate-100 dark:bg-white dark:ring-slate-900"
          style={{ left: pos(at) }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>{axis.negative.label}</span>
        <span>{axis.positive.label}</span>
      </div>
    </div>
  );
}

function FamilyChip({ family }: { family: IdeologyFamily }) {
  const color = familyColor(family);
  const count = ideologies.filter((i) => i.family === family).length;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {FAMILIES[family].label}
      <span className="opacity-60 tabular-nums">{count}</span>
    </span>
  );
}

function Legend({ color, label, hollow }: { color: string; label: string; hollow?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-slate-800 dark:text-slate-200">
      <span
        className="size-3 rounded-full border-2"
        style={{ borderColor: color, backgroundColor: hollow ? "transparent" : color }}
      />
      {label}
    </span>
  );
}

function Dot({ at, color, hollow }: { at: number; color: string; hollow?: boolean }) {
  return (
    <span
      className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-white dark:bg-slate-950"
      style={{ left: pos(at), borderColor: color, backgroundColor: hollow ? undefined : color }}
    />
  );
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <li>
      <p className="text-xs font-semibold text-slate-400 tabular-nums">{n}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{children}</p>
    </li>
  );
}

function Fact({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-slate-950 dark:text-white">{q}</dt>
      <dd className="mt-1 leading-6 text-slate-600 dark:text-slate-400">{children}</dd>
    </div>
  );
}

function Point({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li>
      <span className="font-semibold text-slate-950 dark:text-white">{title}</span> {children}
    </li>
  );
}

function ColumnHead({ count, label }: { count: number; label: string }) {
  return (
    <p className="flex items-baseline gap-2 border-b border-slate-300 pb-2 dark:border-slate-700">
      <span className="text-2xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">{count}</span>
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
    </p>
  );
}

function Expander({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2.5 text-sm">
          <span className="font-medium text-slate-900 group-hover:text-slate-600 dark:text-slate-100 dark:group-hover:text-slate-300">
            {title}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
            {meta && <span className="hidden sm:inline">{meta}</span>}
            <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="pb-3 text-[13px] leading-5 text-slate-600 dark:text-slate-400">{children}</div>
      </details>
    </li>
  );
}
