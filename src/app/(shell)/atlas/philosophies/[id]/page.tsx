import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  Compass,
  GitCompareArrows,
  MapPin,
  Network,
  UserRound,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { SavePhilosophy } from "@/components/atlas/save-philosophy";
import { BackToResult } from "@/components/atlas/back-to-result";
import { SectionNav } from "@/components/data/section-nav";
import { PoliticalAxis } from "@/components/politics/axis";
import { ExpandableAnalysis } from "@/components/politics/expandable";
import { HistoricalParallels, HistoricalTimeline, ReadingList } from "@/components/politics/history";
import { AnalysisSection } from "@/components/politics/section";
import { FamilyBadge, TraditionRow } from "@/components/politics/tradition";
import { chip, focusRing, labelText, metaText, pageTitle, subhead } from "@/components/politics/type";
import { getCurrentUser } from "@/lib/auth/session";
import { getAtlasProfile } from "@/lib/db/atlasProfiles";
import {
  philosophyById,
  philosophyProfiles,
  nearestPhilosophies,
  type PhilosophyKind,
  type PhilosophyProfile,
} from "@/lib/atlas/philosophies";
import { AXIS_GROUPS, axes } from "@/lib/quiz/axes";
import { familyColor } from "@/lib/quiz/families";
import { umbrellaOf } from "@/lib/quiz/ideologies";
import type { AxisId, Ideology } from "@/lib/quiz/types";
import type { SectionIconId } from "@/lib/politics/icons";
import { pointsApart, positionLabel, poleOf } from "@/lib/politics/axis-language";

export function generateStaticParams() {
  return philosophyProfiles.map((p) => ({ id: p.ideology.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const profile = philosophyById.get((await params).id);
  return profile
    ? { title: `${profile.ideology.name} · Worldview Atlas`, description: profile.ideology.description }
    : {};
}

const KIND_LABEL: Record<PhilosophyKind, string> = {
  philosophy: "Philosophy",
  "political tradition": "Political tradition",
  movement: "Movement",
  "regime tradition": "Regime tradition",
  "religious-political tradition": "Religious-political tradition",
};

// What a tradition's record of activity is called depends on what it is: a
// movement campaigns and organizes; a doctrine is carried by parties and
// governments.
const ACTIVITY_TITLE: Record<PhilosophyKind, string> = {
  movement: "Activity and influence",
  philosophy: "Parties, movements and governments",
  "political tradition": "Parties, movements and governments",
  "regime tradition": "Regimes and governments",
  "religious-political tradition": "Parties, movements and governments",
};

const rms = (a: Ideology, b: Ideology, axisIds: AxisId[]) =>
  Math.sqrt(axisIds.reduce((s, x) => s + (a.position[x] - b.position[x]) ** 2, 0) / axisIds.length);

function Fact({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={`flex items-center gap-1.5 ${metaText}`}>
        <Icon size={14} aria-hidden />
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-slate-950 dark:text-white">{children}</dd>
    </div>
  );
}

function Related({ profile, nearest }: { profile: PhilosophyProfile; nearest: Ideology[] }) {
  const { ideology } = profile;
  const core = ideology.core?.length ? ideology.core : axes.map((a) => a.id);
  return (
    <div className="space-y-2">
      {nearest.map((n) => (
        <TraditionRow
          key={n.id}
          href={`/atlas/philosophies/${n.id}`}
          name={n.name}
          family={n.family}
          meta={`${pointsApart(rms(ideology, n, core))} pts apart`}
        />
      ))}
    </div>
  );
}

function Lenses({ profile }: { profile: PhilosophyProfile }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-1">
      {profile.lenses.map((l) => (
        <div key={l.label}>
          <dt className={metaText}>{l.label}</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {l.answer === "No set position" ? (
              <span className="text-sm text-slate-600 italic dark:text-slate-400">No set position</span>
            ) : (
              l.answer.split(", ").map((v) => (
                <span key={v} className={chip}>
                  {v}
                </span>
              ))
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function PhilosophyPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = philosophyById.get((await params).id);
  if (!profile) notFound();
  const user = await getCurrentUser();
  const saved = user ? (await getAtlasProfile(user.id)).savedPhilosophies.includes(profile.ideology.id) : false;
  const { ideology, history } = profile;
  const color = familyColor(ideology.family);
  const nearest = nearestPhilosophies(ideology);
  const umbrella = umbrellaOf(ideology.id);
  const members = (ideology.covers ?? []).flatMap((id) => philosophyById.get(id)?.ideology ?? []);
  const coreSet = new Set<AxisId>(ideology.core?.length ? ideology.core : axes.map((a) => a.id));
  const allCore = coreSet.size === axes.length;
  const defining = axes.filter((a) => coreSet.has(a.id));
  const modeled = axes.filter((a) => !coreSet.has(a.id));
  const headline = [...defining]
    .sort((a, b) => Math.abs(ideology.position[b.id]) - Math.abs(ideology.position[a.id]))
    .slice(0, 5);
  const people = [
    ...new Set([...history.origins.founders.map((f) => f.replace(/\s*\(.*\)$/, "")), ...history.figures]),
  ];
  const compareIds = [ideology.id, ...nearest.slice(0, 2).map((x) => x.id)].join(",");

  const sections: [string, string, SectionIconId][] = [
    ["positions", "Positions", "positions"],
    ["history", "History", "history"],
    ["people", "People", "people"],
    ["connections", "Connections", "connections"],
    ["activity", "Activity", "activity"],
    ["reading", "Reading", "reading"],
  ];

  // One grid in domain order: each axis carries its own icon, so domain
  // headings over one or two axes would only add height.
  const axisList = (list: typeof axes, isDefining: boolean) => (
    <div className="grid gap-x-10 gap-y-7 md:grid-cols-2">
      {AXIS_GROUPS.flatMap((g) => list.filter((a) => a.group === g.id)).map((a, i) => {
        const value = ideology.position[a.id];
        const pole = poleOf(a.id, value);
        return (
          <PoliticalAxis
            key={a.id}
            id={`axis-${a.id}`}
            axis={a.id}
            markers={[{ label: ideology.name, shape: "diamond", color, value }]}
            fill={color}
            defining={isDefining}
            animate={isDefining}
            delay={i * 50}
            detailLabel="What this position means"
            detail={
              <>
                <p>
                  <span className="font-semibold text-slate-950 dark:text-white">{positionLabel(a.id, value)}.</span>{" "}
                  {Math.abs(value) < 0.2
                    ? `Neither ${a.negative.label.toLowerCase()} nor ${a.positive.label.toLowerCase()}: the tradition balances both.`
                    : pole.description}
                </p>
                <p className={`mt-2 ${metaText}`}>
                  {isDefining
                    ? "One of the axes that define this tradition in the Atlas model."
                    : "Not a defining axis: the position is modeled from the tradition's related commitments."}
                </p>
              </>
            }
          />
        );
      })}
    </div>
  );

  return (
    <article className="mx-auto max-w-6xl pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/atlas/philosophies"
          className={`inline-flex items-center gap-1 rounded-md text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white ${focusRing}`}
        >
          <ArrowLeft size={14} aria-hidden /> All philosophies
        </Link>
        <Suspense>
          <BackToResult />
        </Suspense>
      </div>

      {/* Overview */}
      <header
        id="overview"
        className="relative mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 dark:border-slate-800 dark:bg-slate-950"
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: `radial-gradient(40rem 16rem at 100% 0%, ${color}14, transparent 70%)` }}
        />
        <div className="relative">
          <div className="wv-rise flex flex-wrap items-center gap-2">
            <FamilyBadge family={ideology.family} />
            <span className={chip}>{KIND_LABEL[profile.kind]}</span>
            {profile.scopes.map((s) => (
              <span
                key={s}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[13px] font-medium text-slate-700 capitalize dark:bg-slate-800 dark:text-slate-300"
              >
                {s}
              </span>
            ))}
          </div>
          <h1 className={`mt-4 ${pageTitle} wv-rise`} style={{ ["--i" as string]: 1 }}>
            {ideology.name}
          </h1>
          <p
            className="wv-rise mt-4 max-w-3xl text-lg leading-8 text-slate-700 dark:text-slate-300"
            style={{ ["--i" as string]: 2 }}
          >
            {ideology.description}
          </p>

          <dl
            className="wv-rise mt-6 grid gap-5 border-t border-slate-200 pt-5 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800"
            style={{ ["--i" as string]: 3 }}
          >
            <Fact icon={Clock} label="Began">
              {history.origins.when}
            </Fact>
            <Fact icon={MapPin} label="Where">
              {history.origins.where}
            </Fact>
            <Fact icon={UserRound} label="Founded by">
              {history.origins.founders.join(", ")}
            </Fact>
            <Fact icon={Network} label={members.length > 0 ? "Includes" : "Part of"}>
              {members.length > 0 ? (
                <span className="flex flex-wrap gap-x-2">
                  {members.map((m, i) => (
                    <Link
                      key={m.id}
                      href={`/atlas/philosophies/${m.id}`}
                      className="underline decoration-slate-300 underline-offset-4 hover:decoration-current dark:decoration-slate-600"
                    >
                      {m.name}
                      {i < members.length - 1 ? "," : ""}
                    </Link>
                  ))}
                </span>
              ) : umbrella ? (
                <Link
                  href={`/atlas/philosophies/${umbrella.id}`}
                  className="underline decoration-slate-300 underline-offset-4 hover:decoration-current dark:decoration-slate-600"
                >
                  {umbrella.name}
                </Link>
              ) : (
                <span className="font-normal text-slate-600 dark:text-slate-400">A tradition of its own</span>
              )}
            </Fact>
          </dl>

          <div className="wv-rise mt-6" style={{ ["--i" as string]: 4 }}>
            <p className={labelText}>Defining positions</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {headline.map((a) => (
                <li key={a.id}>
                  <a href={`#axis-${a.id}`} className={`${chip} hover:border-slate-400 ${focusRing}`}>
                    <span className="text-slate-600 dark:text-slate-400">{a.name}:</span>
                    <span className="font-semibold text-slate-950 dark:text-white">
                      {positionLabel(a.id, ideology.position[a.id])}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <SavePhilosophy id={ideology.id} initial={saved} />
            <Link
              href={`/atlas/compare?ids=${compareIds}`}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 ${focusRing}`}
            >
              <GitCompareArrows size={15} aria-hidden /> Compare with nearest
            </Link>
            <Link
              href={`/atlas/compare?ids=${ideology.id}`}
              className={`inline-flex min-h-10 items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-950/5 dark:text-slate-300 dark:hover:bg-white/10 ${focusRing}`}
            >
              Compare with another…
            </Link>
          </div>
        </div>
      </header>

      <div className="mt-4">
        <SectionNav sections={sections} label="Entry sections" inset />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-5">
          <AnalysisSection
            id="positions"
            icon={Compass}
            kicker="Positions and principles"
            title={
              allCore ? "Where it stands on all 20 axes" : `Where it stands on its ${defining.length} defining axes`
            }
            description="0 to 100 per axis, balanced at 50."
          >
            {axisList(defining, true)}
            {modeled.length > 0 && (
              <ExpandableAnalysis
                className="mt-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700"
                summaryClassName="px-4 py-3"
                summary={
                  <span className="block">
                    <span className="font-semibold text-slate-950 dark:text-white">
                      {modeled.length} more axes, modeled
                    </span>
                    <span className={`block ${metaText}`}>
                      Positions the Atlas model fills in from related commitments; less defining for this tradition.
                    </span>
                  </span>
                }
              >
                <div className="px-4 pt-3 pb-5">{axisList(modeled, false)}</div>
              </ExpandableAnalysis>
            )}
          </AnalysisSection>

          <AnalysisSection
            id="history"
            icon={Clock}
            kicker="History"
            title="How it developed"
            description={`From ${history.origins.when} in ${history.origins.where}.`}
          >
            <HistoricalTimeline entries={history.timeline} color={color} />
          </AnalysisSection>

          <AnalysisSection id="people" icon={UserRound} kicker="People" title="Founders and key figures">
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {people.map((p) => {
                const founder = history.origins.founders.some((f) => f.startsWith(p));
                return (
                  <li
                    key={p}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800"
                  >
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {p
                        .split(/\s+/)
                        .filter((w) => /^[A-Z]/.test(w))
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-950 dark:text-white">{p}</span>
                      <span className={`block ${metaText}`}>{founder ? "Founder" : "Key figure"}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </AnalysisSection>

          <AnalysisSection
            id="connections"
            icon={Network}
            kicker="Historical connections"
            title="Parallels in history"
            description="Past states compared with this tradition."
          >
            <HistoricalParallels
              comparisons={history.comparisons}
              color={color}
              traditionName={ideology.name}
              originText={history.origins.when}
            />
            <div className="mt-8 grid gap-8 xl:hidden">
              <div>
                <h3 className={`mb-3 ${subhead}`}>Nearest in the Atlas</h3>
                <Related profile={profile} nearest={nearest} />
              </div>
              <div>
                <h3 className={`mb-3 ${subhead}`}>Categorical positions</h3>
                <Lenses profile={profile} />
              </div>
            </div>
          </AnalysisSection>

          <AnalysisSection id="activity" icon={Waypoints} kicker="Activity" title={ACTIVITY_TITLE[profile.kind]}>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {history.practice.map((p) => (
                <li key={p.name} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-6">
                  <p className="font-semibold text-slate-950 dark:text-white">{p.name}</p>
                  <p className="text-slate-700 dark:text-slate-300">{p.detail}</p>
                </li>
              ))}
            </ul>
          </AnalysisSection>

          <AnalysisSection id="reading" icon={BookOpen} kicker="Further reading" title="Primary texts and books">
            <ReadingList texts={history.texts} books={history.books} color={color} />
          </AnalysisSection>
        </div>

        <aside className="hidden space-y-5 xl:block">
          <div className="sticky top-32 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <h2 className={subhead}>Nearest in the Atlas</h2>
              <div className="mt-3">
                <Related profile={profile} nearest={nearest} />
              </div>
              <Link
                href={`/atlas/compare?ids=${compareIds}`}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-950 underline decoration-slate-300 underline-offset-4 hover:decoration-current dark:text-white dark:decoration-slate-600"
              >
                Compare all three <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <h2 className={subhead}>Categorical positions</h2>
              <div className="mt-3">
                <Lenses profile={profile} />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}
