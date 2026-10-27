"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CircleDollarSign,
  Download,
  ExternalLink,
  FileText,
  Gavel,
  Landmark,
  ListOrdered,
  Scale,
  ScrollText,
  Users,
  Vote,
} from "lucide-react";
import type {
  BillDocket,
  MemberDocket,
  PartyKey,
  RaceCandidate,
  RaceDocket,
  WritDiscovery,
  WritDocket,
  WritResult,
  WritSearchResults,
} from "@/lib/db/writ";
import type { VoteTally } from "@/lib/validation/vote";
import { Surface } from "@/components/ui/surface";
import { buttonVariants } from "@/components/ui/button";
import { StatusPill } from "@/components/legislation/bill-status";
import { ElectionStatusPill } from "@/components/elections/election-status";
import { formatAmount } from "@/lib/money";
import { partyColorFor } from "@/lib/party-colors";
import { HANDICAPPERS, RATING_STYLE, partyLetter } from "@/lib/elections/overview";
import { normalizePartyName } from "@/lib/elections/display";
import { ratingLabel } from "@/lib/validation/raceRating";
import { entityPartyAndPlace, publicEntityPath, typeLabels } from "@/lib/people/public";
import { writDocketHref, writDocketTitle } from "@/lib/tools/writ";

interface Props {
  docket: WritDocket | null;
  results: WritSearchResults | null;
  discovery: WritDiscovery | null;
  initialQuery: string;
}

type Section = { id: string; label: string; count?: number };

const PARTY_BAR: Record<PartyKey, string> = {
  D: "bg-blue-600",
  R: "bg-red-600",
  I: "bg-slate-500",
  Other: "bg-slate-300 dark:bg-slate-600",
};

function writHref(kind: WritResult["kind"], id: string, section?: string): string {
  return `${writDocketHref(kind, id)}${section ? `#${section}` : ""}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function pct(value: number | null): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const docketTitle = writDocketTitle;

// ---------------------------------------------------------------- workspace

export function WritWorkspace({ docket, results, discovery, initialQuery }: Props) {
  function handleExport() {
    if (!docket) return;
    const blob = new Blob([JSON.stringify(docket, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `writ-${docket.kind}-${slug(docketTitle(docket))}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const resultGroups = results
    ? ([
        ["Bills", results.bills],
        ["Members", results.members],
        ["Races", results.races],
      ] as const)
    : [];
  const resultCount = resultGroups.reduce((total, [, rows]) => total + rows.length, 0);

  return (
    <div className="space-y-6">
      {/* Search lives in the Writ tool bar (a GET form to /writ?q=). */}
      {results ? (
        <Surface className="p-4 sm:p-5">
          <div className="space-y-3">
            {resultGroups.map(([label, rows]) =>
              rows.length > 0 ? (
                <div key={label} className="flex items-center gap-2 overflow-x-auto">
                  <span className="w-16 shrink-0 text-[11px] font-bold tracking-[0.12em] text-slate-400 uppercase">
                    {label}
                  </span>
                  {rows.map((row) => (
                    <ResultPill key={row.id} result={row} active={isActive(docket, row)} />
                  ))}
                </div>
              ) : null,
            )}
            {resultCount === 0 ? (
              <p className="text-sm text-slate-500">No bills, members, or races matched “{initialQuery}”.</p>
            ) : null}
          </div>
        </Surface>
      ) : null}

      {docket?.kind === "bill" ? <BillDocketView docket={docket} onExport={handleExport} /> : null}
      {docket?.kind === "member" ? <MemberDocketView docket={docket} onExport={handleExport} /> : null}
      {docket?.kind === "race" ? <RaceDocketView docket={docket} onExport={handleExport} /> : null}
      {!docket && !results && discovery ? <WritDiscoveryView discovery={discovery} /> : null}
    </div>
  );
}

function isActive(docket: WritDocket | null, result: WritResult): boolean {
  if (!docket || docket.kind !== result.kind) return false;
  if (docket.kind === "bill") return docket.bill.id === result.id;
  if (docket.kind === "member") return docket.entity.id === result.id;
  return docket.election.id === result.id;
}

function ResultPill({ result, active }: { result: WritResult; active: boolean }) {
  return (
    <Link
      href={writHref(result.kind, result.id)}
      aria-current={active ? "page" : undefined}
      title={result.detail}
      className={`max-w-xs shrink-0 truncate rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
          : "border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
      }`}
    >
      {result.label}
      <span className="ml-1.5 font-normal opacity-60">{result.detail}</span>
    </Link>
  );
}

// ---------------------------------------------------------------- discovery

function WritDiscoveryView({ discovery }: { discovery: WritDiscovery }) {
  return (
    <div className="space-y-8">
      <Surface className="overflow-hidden bg-slate-950 text-white dark:bg-black">
        <div className="grid gap-8 px-6 py-8 sm:px-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end xl:px-10 xl:py-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-rose-300 uppercase">
              <Scale className="h-4 w-4" />
              Open a docket
            </div>
            <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
              Every bill, vote, and race on one record.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Writ keeps a docket for each bill, each member of Congress, and each race: the full history, the votes, the
              people involved, and the money, side by side.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="min-w-28 rounded-2xl border border-white/10 bg-white/5 p-4">
              <dt className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">Bills</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums">{discovery.counts.bills.toLocaleString()}</dd>
            </div>
            <div className="min-w-28 rounded-2xl border border-white/10 bg-white/5 p-4">
              <dt className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">Roll calls</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums">{discovery.counts.rollCalls.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </Surface>

      {discovery.races.length > 0 ? (
        <DiscoverySection
          id="races"
          eyebrow={`Elections · ${discovery.cycle ?? ""}`}
          title="The closest races on the ballot"
          description="Scheduled Senate, governor, and House races, nearest to a toss-up first."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {discovery.races.map((race) => {
              const style = race.rating ? RATING_STYLE[race.rating] : null;
              return (
                <DiscoveryCard key={race.id} href={writHref("race", race.id)} cta="Open race docket">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">{race.code}</span>
                    {style && race.rating ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ background: style.fill, color: style.text }}
                      >
                        {ratingLabel(race.rating)}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-lg font-bold tracking-tight text-slate-950 group-hover:text-rose-700 dark:text-white dark:group-hover:text-rose-300">
                    {race.office}
                    {race.special ? " (special)" : ""}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {race.nominees.length
                      ? race.nominees.map((n) => `${n.name}${n.party ? ` (${n.party})` : ""}`).join(" vs. ")
                      : race.incumbent
                        ? `Incumbent: ${race.incumbent.name}`
                        : race.openSeat
                          ? "Open seat"
                          : "Candidates not yet set"}
                  </p>
                </DiscoveryCard>
              );
            })}
          </div>
        </DiscoverySection>
      ) : null}

      {discovery.recentBills.length > 0 ? (
        <DiscoverySection
          id="bills"
          eyebrow="Legislation"
          title="Latest bill activity"
          description="Bills with the most recent recorded action in Congress."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {discovery.recentBills.map((bill) => (
              <DiscoveryCard key={bill.id} href={writHref("bill", bill.id)} cta="Open bill docket">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-bold tracking-wide text-slate-500 tabular-nums">{bill.billNumber}</span>
                  <StatusPill status={bill.status} />
                </div>
                <h3 className="mt-3 line-clamp-3 text-base font-bold tracking-tight text-slate-950 group-hover:text-rose-700 dark:text-white dark:group-hover:text-rose-300">
                  {bill.title}
                </h3>
                {bill.latestActionDate ? (
                  <p className="mt-2 text-xs text-slate-500">Latest action {formatDate(bill.latestActionDate)}</p>
                ) : null}
              </DiscoveryCard>
            ))}
          </div>
        </DiscoverySection>
      ) : null}

      {discovery.members.length > 0 ? (
        <DiscoverySection
          id="members"
          eyebrow="Congress"
          title="Members with recorded votes"
          description="Party-line rate, splits, bills, and races."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {discovery.members.map(({ entity, votes }) => {
              const { party, place } = entityPartyAndPlace(entity);
              return (
                <DiscoveryCard key={entity.id} href={writHref("member", entity.id)} cta="Open member docket">
                  <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                    {[party, place].filter(Boolean).join(" · ") || (typeLabels[entity.type] ?? entity.type)}
                  </span>
                  <h3 className="mt-3 text-lg font-bold tracking-tight text-slate-950 group-hover:text-rose-700 dark:text-white dark:group-hover:text-rose-300">
                    {entity.name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 tabular-nums dark:text-slate-400">
                    {votes.toLocaleString()} roll-call votes
                  </p>
                </DiscoveryCard>
              );
            })}
          </div>
        </DiscoverySection>
      ) : null}
    </div>
  );
}

function DiscoverySection({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`writ-${id}`}>
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-rose-600 uppercase dark:text-rose-400">{eyebrow}</p>
          <h2 id={`writ-${id}`} className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            {title}
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-slate-500 sm:text-right">{description}</p>
      </div>
      {children}
    </section>
  );
}

function DiscoveryCard({ href, cta, children }: { href: string; cta: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex min-h-44 flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-lg hover:shadow-rose-950/5 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-rose-700"
    >
      {children}
      <span className="mt-auto flex items-center gap-1.5 pt-5 text-xs font-bold text-rose-600 dark:text-rose-400">
        {cta}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------- docket frame

function DocketFrame({
  kindLabel,
  meta,
  title,
  subtitle,
  sections,
  glance,
  links,
  onExport,
  children,
}: {
  kindLabel: string;
  meta: ReactNode;
  title: string;
  subtitle: ReactNode;
  sections: Section[];
  glance: [string, string][];
  links: { href: string; label: string; external?: boolean }[];
  onExport: () => void;
  children: ReactNode;
}) {
  return (
    <Surface className="overflow-hidden">
      <header className="border-b border-slate-200 bg-slate-50/70 px-5 py-7 sm:px-8 sm:py-9 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-950">
                {kindLabel}
              </span>
              {meta}
            </div>
            <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
              {title}
            </h2>
            <div className="mt-3 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">{subtitle}</div>
          </div>
          <button onClick={onExport} className={buttonVariants({ variant: "outline", size: "sm" }) + " shrink-0 gap-2"}>
            <Download className="h-4 w-4" /> Export docket
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[170px_minmax(0,1fr)_290px]">
        <nav aria-label={`${title} docket sections`} className="hidden border-r border-slate-200 px-5 py-8 lg:block dark:border-slate-800">
          <div className="sticky top-24">
            <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">In this docket</p>
            <ol className="mt-4 space-y-3 border-l border-slate-200 pl-4 text-sm dark:border-slate-800">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <main className="min-w-0 px-5 py-8 sm:px-8 sm:py-10">{children}</main>

        <aside className="border-t border-slate-200 bg-slate-50/60 px-5 py-8 lg:border-t-0 lg:border-l dark:border-slate-800 dark:bg-slate-900/30">
          <div className="space-y-7 lg:sticky lg:top-24">
            <section>
              <h3 className="text-xs font-bold tracking-[0.12em] text-slate-400 uppercase">At a glance</h3>
              <dl className="mt-4 space-y-3">
                {glance.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[100px_1fr] gap-3 text-sm">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="text-right font-semibold text-slate-800 dark:text-slate-200">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            {sections.some((section) => section.count != null) ? (
              <section className="border-t border-slate-200 pt-6 dark:border-slate-800">
                <h3 className="text-xs font-bold tracking-[0.12em] text-slate-400 uppercase">Explore the record</h3>
                <div className="mt-3 space-y-2 text-sm">
                  {sections
                    .filter((section) => section.count != null)
                    .map((section) => (
                      <a
                        key={section.id}
                        href={`#${section.id}`}
                        className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 font-medium hover:text-rose-700 dark:bg-slate-950 dark:hover:text-rose-400"
                      >
                        <span>{section.label}</span>
                        <span className="tabular-nums text-slate-400">{section.count}</span>
                      </a>
                    ))}
                </div>
              </section>
            ) : null}
            <section className="border-t border-slate-200 pt-6 dark:border-slate-800">
              <h3 className="text-xs font-bold tracking-[0.12em] text-slate-400 uppercase">Elsewhere</h3>
              <div className="mt-3 space-y-3 text-sm">
                {links.map((link) =>
                  link.external ? (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                    >
                      <span>{link.label}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center justify-between text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                    >
                      <span>{link.label}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ),
                )}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </Surface>
  );
}

function DocketSection({
  id,
  icon,
  eyebrow,
  title,
  tone,
  first,
  children,
}: {
  id: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  tone: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 ${first ? "" : "mt-12 border-t border-slate-200 pt-10 dark:border-slate-800"}`}
    >
      <div className={`flex items-center gap-2 ${tone}`}>
        {icon}
        <p className="text-xs font-bold tracking-[0.14em] uppercase">{eyebrow}</p>
      </div>
      <h3 className="mt-3 font-serif text-2xl font-bold text-slate-950 dark:text-white">{title}</h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5 text-sm leading-6 text-slate-500 dark:border-slate-700">
      {children}
    </div>
  );
}

function TallyBar({ tally }: { tally: VoteTally }) {
  const total = tally.yea + tally.nay;
  if (total === 0) return null;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
      <div className="bg-emerald-600" style={{ width: `${(tally.yea / total) * 100}%` }} />
      <div className="bg-rose-600" style={{ width: `${(tally.nay / total) * 100}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- bill docket

function BillDocketView({ docket, onExport }: { docket: BillDocket; onExport: () => void }) {
  const { bill, actions, cosponsors, committees, relations, textVersions, rollCalls, entities } = docket;
  const sponsor = bill.sponsorEntityId ? entities[bill.sponsorEntityId] : undefined;
  const subjects = bill.subjects
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const sections: Section[] = [
    { id: "summary", label: "Summary" },
    { id: "timeline", label: "Timeline", count: actions.length },
    { id: "votes", label: "Roll calls", count: rollCalls.length },
    ...(cosponsors.length ? [{ id: "cosponsors", label: "Cosponsors", count: cosponsors.length }] : []),
    ...(committees.length ? [{ id: "committees", label: "Committees", count: committees.length }] : []),
    ...(relations.length ? [{ id: "related", label: "Related bills", count: relations.length }] : []),
    ...(textVersions.length ? [{ id: "text", label: "Text", count: textVersions.length }] : []),
  ];

  return (
    <DocketFrame
      kindLabel="Bill"
      meta={
        <>
          <span className="tabular-nums">{bill.billNumber}</span>
          <StatusPill status={bill.status} />
          {bill.congress ? <span>{bill.congress}th Congress</span> : null}
        </>
      }
      title={bill.title}
      subtitle={
        <>
          Sponsored by{" "}
          {sponsor ? (
            <Link href={writHref("member", sponsor.id)} className="font-semibold text-slate-900 hover:text-rose-600 dark:text-white">
              {sponsor.name}
            </Link>
          ) : (
            "an unrecorded sponsor"
          )}
          {bill.chamber ? ` · ${bill.chamber}` : ""} · Introduced {formatDate(bill.introducedDate)}
        </>
      }
      sections={sections}
      glance={[
        ["Status", bill.status.replace(/_/g, " ")],
        ["Chamber", bill.chamber],
        ["Policy area", bill.policyArea],
        ["Introduced", formatDate(bill.introducedDate)],
        ["Latest action", formatDate(bill.latestActionDate)],
        ["Cosponsors", String(cosponsors.length)],
      ].filter((fact): fact is [string, string] => Boolean(fact[1]))}
      links={[
        { href: `/legislation/${bill.id}`, label: "Public bill page" },
        ...(sponsor ? [{ href: publicEntityPath(sponsor), label: "Sponsor in Subpoena" }] : []),
        ...(textVersions[0]?.url ? [{ href: textVersions[0].url, label: "Latest text", external: true }] : []),
      ]}
      onExport={onExport}
    >
      <DocketSection id="summary" first icon={<FileText className="h-4 w-4" />} eyebrow="Summary" title="What the bill does" tone="text-rose-600 dark:text-rose-400">
        {bill.summary ? (
          <p className="mt-5 text-base leading-8 whitespace-pre-line text-slate-700 dark:text-slate-300">{bill.summary}</p>
        ) : (
          <Empty>No summary has been published for this bill yet. The timeline and votes below are still available.</Empty>
        )}
        {bill.policyArea || subjects.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {bill.policyArea ? (
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                {bill.policyArea}
              </span>
            ) : null}
            {subjects.map((subject) => (
              <span
                key={subject}
                className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"
              >
                {subject}
              </span>
            ))}
          </div>
        ) : null}
      </DocketSection>

      <DocketSection id="timeline" icon={<ListOrdered className="h-4 w-4" />} eyebrow="Timeline" title="How it has moved" tone="text-slate-600 dark:text-slate-400">
        {actions.length ? (
          <ol className="mt-5 border-l border-slate-200 dark:border-slate-800">
            {actions.map((action) => (
              <li key={action.id} className="relative pb-4 pl-5 last:pb-0">
                <span className="absolute top-1.5 -left-0.75 h-1.5 w-1.5 rounded-full bg-rose-400" />
                <p className="text-xs text-slate-400 tabular-nums">
                  {formatDate(action.date)}
                  {action.chamber ? ` · ${action.chamber}` : ""}
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{action.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>{bill.latestActionText || "No actions recorded yet."}</Empty>
        )}
      </DocketSection>

      <DocketSection id="votes" icon={<Vote className="h-4 w-4" />} eyebrow="Roll calls" title="How members voted" tone="text-emerald-700 dark:text-emerald-400">
        {rollCalls.length ? (
          <div className="mt-5 space-y-4">
            {rollCalls.map((rollCall) => (
              <article key={rollCall.id} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {rollCall.chamber} roll call {rollCall.rollNumber}
                    {rollCall.question ? `: ${rollCall.question}` : ""}
                  </h4>
                  <span className="text-xs text-slate-500">
                    {formatDate(rollCall.date)}
                    {rollCall.result ? ` · ${rollCall.result}` : ""}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600 tabular-nums dark:text-slate-400">
                  {rollCall.tally.yea} yea · {rollCall.tally.nay} nay · {rollCall.tally.present} present ·{" "}
                  {rollCall.tally.absent} not voting
                </p>
                <div className="mt-3">
                  <TallyBar tally={rollCall.tally} />
                </div>
                <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                  {(Object.entries(rollCall.byParty) as [PartyKey, VoteTally][]).map(([party, tally]) => (
                    <div key={party} className="flex items-center gap-3 text-xs">
                      <dt className="flex w-24 items-center gap-1.5 text-slate-500">
                        <span className={`h-2 w-2 rounded-full ${PARTY_BAR[party]}`} />
                        {party === "Other" ? "Other" : normalizePartyName(party)}
                      </dt>
                      <dd className="text-slate-700 tabular-nums dark:text-slate-300">
                        {tally.yea}–{tally.nay}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
            <Link
              href={`/legislation/${bill.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-950 dark:hover:text-white"
            >
              See every member&apos;s vote on the public bill page <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <Empty>No roll-call votes have been recorded on this bill.</Empty>
        )}
      </DocketSection>

      {cosponsors.length ? (
        <DocketSection id="cosponsors" icon={<Users className="h-4 w-4" />} eyebrow="Cosponsors" title="Who signed on" tone="text-violet-700 dark:text-violet-400">
          <ul className="mt-5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {cosponsors.map((cosponsor) => {
              const entity = entities[cosponsor.entityId];
              return (
                <li key={cosponsor.id} className="flex items-baseline justify-between gap-3 text-sm">
                  {entity ? (
                    <Link href={writHref("member", entity.id)} className="font-medium text-slate-800 hover:text-rose-600 dark:text-slate-200">
                      {entity.name}
                    </Link>
                  ) : (
                    <span className="text-slate-500">Unresolved member</span>
                  )}
                  <span className="text-xs text-slate-400">
                    {cosponsor.isOriginal ? "Original · " : ""}
                    {formatDate(cosponsor.date)}
                  </span>
                </li>
              );
            })}
          </ul>
        </DocketSection>
      ) : null}

      {committees.length ? (
        <DocketSection id="committees" icon={<Landmark className="h-4 w-4" />} eyebrow="Committees" title="Where it was referred" tone="text-amber-700 dark:text-amber-400">
          <ul className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {committees.map((committee) => (
              <li key={committee.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-200">{committee.name}</span>
                <span className="text-xs text-slate-500">{[committee.chamber, committee.activity].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </DocketSection>
      ) : null}

      {relations.length ? (
        <DocketSection id="related" icon={<ScrollText className="h-4 w-4" />} eyebrow="Related bills" title="Companion and related measures" tone="text-slate-600 dark:text-slate-400">
          <ul className="mt-5 space-y-2 text-sm">
            {relations.map((relation) => (
              <li key={relation.id}>
                {relation.relatedBillId ? (
                  <Link href={writHref("bill", relation.relatedBillId)} className="font-semibold text-slate-900 hover:text-rose-600 dark:text-white">
                    {relation.relatedBillNumber || relation.relatedExternalId}
                  </Link>
                ) : (
                  <span className="font-semibold">{relation.relatedBillNumber || relation.relatedExternalId}</span>
                )}
                {relation.relatedTitle ? <span className="text-slate-600 dark:text-slate-400">: {relation.relatedTitle}</span> : null}
                {relation.relationshipType ? <span className="text-slate-400"> ({relation.relationshipType})</span> : null}
              </li>
            ))}
          </ul>
        </DocketSection>
      ) : null}

      {textVersions.length ? (
        <DocketSection id="text" icon={<FileText className="h-4 w-4" />} eyebrow="Text" title="Published versions" tone="text-slate-600 dark:text-slate-400">
          <ul className="mt-5 divide-y divide-slate-100 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {textVersions.map((version) => (
              <li key={version.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {version.versionType || "Full text"}
                  {version.format ? <span className="ml-2 text-xs text-slate-400">{version.format}</span> : null}
                  {version.date ? <span className="ml-2 text-xs text-slate-400">{formatDate(version.date)}</span> : null}
                </span>
                <a href={version.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-950 dark:hover:text-white">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        </DocketSection>
      ) : null}
    </DocketFrame>
  );
}

// ---------------------------------------------------------------- member docket

function MemberDocketView({ docket, onExport }: { docket: MemberDocket; onExport: () => void }) {
  const { entity, party, record, policyAreas, votes, sponsored, sponsoredTotal, candidacies } = docket;
  const { party: metaParty, place } = entityPartyAndPlace(entity);
  const partyLabel = normalizePartyName(party || metaParty || "");
  const splits = votes.filter((vote) => vote.broke);
  const sections: Section[] = [
    { id: "record", label: "Voting record" },
    { id: "votes", label: "Recent votes", count: record.total },
    { id: "sponsored", label: "Bills sponsored", count: sponsoredTotal },
    { id: "races", label: "Races run", count: candidacies.length },
  ];

  return (
    <DocketFrame
      kindLabel={typeLabels[entity.type] ?? "Member"}
      meta={
        <>
          {partyLabel !== "Unaffiliated" ? <span>{partyLabel}</span> : null}
          {place ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{place}</span>
            </>
          ) : null}
        </>
      }
      title={entity.name}
      subtitle={entity.description || "Roll-call record, sponsored legislation, and electoral history."}
      sections={sections}
      glance={[
        ["Party", partyLabel === "Unaffiliated" ? "" : partyLabel],
        ["Place", place],
        ["Votes cast", record.total.toLocaleString()],
        ["Party line", pct(record.partyLineRate)],
        ["Splits", record.broke.toLocaleString()],
        ["Not voting", record.missed.toLocaleString()],
      ].filter((fact): fact is [string, string] => Boolean(fact[1]))}
      links={[
        { href: publicEntityPath(entity), label: "Case file in Subpoena" },
        { href: `/legislation/members/${entity.id}`, label: "Full voting record" },
      ]}
      onExport={onExport}
    >
      <DocketSection id="record" first icon={<Gavel className="h-4 w-4" />} eyebrow="Voting record" title={`How ${entity.name} votes`} tone="text-rose-600 dark:text-rose-400">
        {record.total ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Stat label="With party" value={pct(record.partyLineRate)} note={`${record.decisive.toLocaleString()} yea/nay votes`} />
              <Stat label="Split from party" value={record.broke.toLocaleString()} note="votes against the party majority" />
              <Stat label="Not voting" value={record.missed.toLocaleString()} note={`of ${record.total.toLocaleString()} roll calls`} />
            </div>
            {policyAreas.length ? (
              <div className="mt-6">
                <h4 className="text-xs font-bold tracking-[0.12em] text-slate-500 uppercase">Votes by policy area</h4>
                <ul className="mt-3 space-y-1.5">
                  {policyAreas.slice(0, 8).map((area) => (
                    <li key={area.name} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3 text-sm">
                      <div className="relative h-6 overflow-hidden rounded-md bg-slate-50 dark:bg-slate-900">
                        <div
                          className="absolute inset-y-0 left-0 bg-rose-100 dark:bg-rose-950/50"
                          style={{ width: `${(area.count / policyAreas[0].count) * 100}%` }}
                        />
                        <span className="relative px-2 leading-6 text-slate-700 dark:text-slate-300">{area.name}</span>
                      </div>
                      <span className="text-right text-slate-500 tabular-nums">{area.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {splits.length ? (
              <div className="mt-7 border-l-2 border-rose-500 pl-5">
                <h4 className="text-xs font-bold tracking-[0.12em] text-slate-500 uppercase">Recent splits from party</h4>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                  {splits.slice(0, 6).map((vote) => (
                    <li key={vote.voteId}>
                      Voted <strong className="font-semibold">{vote.position}</strong> on{" "}
                      {vote.billId ? (
                        <Link href={writHref("bill", vote.billId)} className="font-semibold hover:text-rose-600">
                          {vote.billNumber}
                        </Link>
                      ) : (
                        vote.question || `roll call ${vote.rollNumber}`
                      )}
                      <span className="text-slate-400"> · {formatDate(vote.date)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <Empty>No roll-call votes are linked to this person. Sponsored bills and races are below.</Empty>
        )}
      </DocketSection>

      <DocketSection id="votes" icon={<Vote className="h-4 w-4" />} eyebrow="Recent votes" title="Latest roll calls" tone="text-emerald-700 dark:text-emerald-400">
        {votes.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Measure</th>
                  <th className="px-3 py-2 font-medium">Vote</th>
                  <th className="py-2 pl-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {votes.slice(0, 25).map((vote) => (
                  <tr key={vote.voteId}>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-slate-500 tabular-nums">{formatDate(vote.date)}</td>
                    <td className="max-w-xs px-3 py-2.5">
                      {vote.billId ? (
                        <Link href={writHref("bill", vote.billId)} className="font-medium text-slate-900 hover:text-rose-600 dark:text-white">
                          {vote.billNumber}
                        </Link>
                      ) : null}
                      <p className="truncate text-xs text-slate-500">{vote.billTitle || vote.question}</p>
                    </td>
                    <td className="px-3 py-2.5 capitalize">
                      {vote.position === "absent" ? "Not voting" : vote.position}
                      {vote.broke ? (
                        <span className="ml-1.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-rose-700 uppercase dark:bg-rose-950/40 dark:text-rose-300">
                          Split
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pl-3 text-slate-500">{vote.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {record.total > 25 ? (
              <Link
                href={`/legislation/members/${entity.id}`}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-950 dark:hover:text-white"
              >
                All {record.total.toLocaleString()} votes, filterable by policy area <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        ) : (
          <Empty>No recorded votes.</Empty>
        )}
      </DocketSection>

      <DocketSection id="sponsored" icon={<ScrollText className="h-4 w-4" />} eyebrow="Legislation" title="Bills sponsored" tone="text-violet-700 dark:text-violet-400">
        {sponsored.length ? (
          <ul className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {sponsored.map((bill) => (
              <li key={bill.id}>
                <Link href={writHref("bill", bill.id)} className="flex items-start justify-between gap-4 px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-900">
                  <span className="min-w-0">
                    <span className="font-semibold text-slate-900 tabular-nums dark:text-white">{bill.billNumber}</span>
                    <span className="mt-0.5 block truncate text-slate-600 dark:text-slate-400">{bill.title}</span>
                  </span>
                  <StatusPill status={bill.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No sponsored bills are linked to this person.</Empty>
        )}
        {sponsoredTotal > sponsored.length ? (
          <p className="mt-3 text-xs text-slate-500">
            Showing the {sponsored.length} most recent of {sponsoredTotal.toLocaleString()} sponsored bills.
          </p>
        ) : null}
      </DocketSection>

      <DocketSection id="races" icon={<Landmark className="h-4 w-4" />} eyebrow="Elections" title="Races run" tone="text-amber-700 dark:text-amber-400">
        {candidacies.length ? (
          <ul className="mt-5 space-y-2">
            {candidacies.map((candidacy) => (
              <li key={candidacy.id}>
                <Link
                  href={writHref("race", candidacy.election.id)}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm hover:border-rose-300 dark:border-slate-800"
                >
                  <span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {candidacy.election.jurisdiction} {candidacy.election.office}
                    </span>
                    <span className="ml-2 text-slate-500">
                      {candidacy.election.cycle ?? formatDate(candidacy.election.electionDate)} · {candidacy.election.electionType}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {candidacy.won
                      ? "Won"
                      : candidacy.withdrew
                        ? "Withdrew"
                        : candidacy.status
                          ? candidacy.status.replaceAll("_", " ")
                          : candidacy.election.status === "scheduled"
                            ? "On the ballot"
                            : "Lost"}
                    {candidacy.incumbent ? " · Incumbent" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No candidacies are linked to this person.</Empty>
        )}
      </DocketSection>
    </DocketFrame>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-900/60">
      <p className="text-xs font-bold tracking-[0.12em] text-slate-500 uppercase">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950 tabular-nums dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

// ---------------------------------------------------------------- race docket

function RaceDocketView({ docket, onExport }: { docket: RaceDocket; onExport: () => void }) {
  const { election, cycle, upcomingGeneral, candidates, others, summary, consensus, areas } = docket;
  const incumbent = [...candidates, ...others].find((c) => c.candidacy.incumbent);
  const total = election.totalVotes ?? summary.totalVotes;
  const hasMoney = candidates.some((c) => c.finance || c.outside);
  const sections: Section[] = [
    { id: "candidates", label: upcomingGeneral ? "On the ballot" : "Candidates", count: candidates.length },
    ...(consensus ? [{ id: "ratings", label: "Ratings" }] : []),
    ...(hasMoney ? [{ id: "money", label: "Money" }] : []),
    ...(areas.length ? [{ id: "results", label: "Results by area", count: areas.length }] : []),
    ...(others.length ? [{ id: "field", label: "Rest of the field", count: others.length }] : []),
  ];

  return (
    <DocketFrame
      kindLabel="Race"
      meta={
        <>
          <span>{election.electionType}</span>
          <ElectionStatusPill status={election.status} />
          <span>{formatDate(election.electionDate)}</span>
        </>
      }
      title={`${election.jurisdiction} ${election.office}`}
      subtitle={
        incumbent
          ? `Incumbent: ${incumbent.name} (${partyLetter(incumbent.candidacy.party) ?? "Other"})`
          : election.openSeat
            ? "Open seat"
            : election.name
      }
      sections={sections}
      glance={[
        ["Cycle", String(cycle)],
        ["Office", election.office],
        ["Rating", consensus ? ratingLabel(consensus.rating) : ""],
        ["Seat", election.seatClass ? `Class ${election.seatClass}` : election.openSeat ? "Open" : ""],
        ["Total votes", total ? total.toLocaleString() : ""],
        ["Margin", summary.marginPct != null ? `${summary.marginPct.toFixed(1)} pts` : ""],
      ].filter((fact): fact is [string, string] => Boolean(fact[1]))}
      links={[
        { href: `/elections/${election.id}`, label: "Public race page" },
        { href: `/elections?cycle=${cycle}`, label: `${cycle} election center` },
      ]}
      onExport={onExport}
    >
      <DocketSection
        id="candidates"
        first
        icon={<Users className="h-4 w-4" />}
        eyebrow={upcomingGeneral ? "General election" : "Candidates"}
        title={upcomingGeneral ? "Who is on the ballot" : "Candidates and results"}
        tone="text-rose-600 dark:text-rose-400"
      >
        {candidates.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {candidates.map((candidate) => (
              <CandidateCard key={candidate.candidacy.id} candidate={candidate} total={upcomingGeneral ? 0 : total} />
            ))}
          </div>
        ) : (
          <Empty>Nominees have not been confirmed for this race yet. Filed candidates are listed under the rest of the field.</Empty>
        )}
      </DocketSection>

      {consensus ? (
        <DocketSection id="ratings" icon={<Scale className="h-4 w-4" />} eyebrow="Ratings" title={ratingLabel(consensus.rating)} tone="text-slate-600 dark:text-slate-400">
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {consensus.published ? "Median of the latest forecaster ratings." : "No forecaster has rated this race; this is the latest available rating."}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {consensus.ratings.map((rating) => {
              const style = RATING_STYLE[rating.rating];
              return (
                <div key={rating.source} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-500">
                    {HANDICAPPERS.find((h) => h.id === rating.source)?.label ?? rating.source}
                  </p>
                  <span
                    className="mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ background: style.fill, color: style.text }}
                  >
                    {ratingLabel(rating.rating)}
                  </span>
                  <p className="mt-2 text-xs text-slate-400">As of {formatDate(rating.asOf)}</p>
                </div>
              );
            })}
          </div>
        </DocketSection>
      ) : null}

      {hasMoney ? (
        <DocketSection id="money" icon={<CircleDollarSign className="h-4 w-4" />} eyebrow="Campaign money" title={`FEC filings for ${cycle}`} tone="text-emerald-700 dark:text-emerald-400">
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">Candidate</th>
                  <th className="px-3 py-2 text-right font-medium">Raised</th>
                  <th className="px-3 py-2 text-right font-medium">Spent</th>
                  <th className="px-3 py-2 text-right font-medium">Cash on hand</th>
                  <th className="py-2 pl-3 text-right font-medium">Outside spending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {candidates.map((candidate) => {
                  const cell = (value: number | null | undefined) => (value == null ? "—" : formatAmount(value, "USD"));
                  return (
                    <tr key={candidate.candidacy.id}>
                      <td className="py-2.5 pr-3 font-medium">{candidate.name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{cell(candidate.finance?.totalReceipts)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{cell(candidate.finance?.totalDisbursements)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{cell(candidate.finance?.cashOnHand)}</td>
                      <td className="py-2.5 pl-3 text-right tabular-nums">
                        {cell(candidate.outside ? candidate.outside.support + candidate.outside.oppose : null)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DocketSection>
      ) : null}

      {areas.length ? (
        <DocketSection id="results" icon={<ListOrdered className="h-4 w-4" />} eyebrow="Results" title="Largest areas by votes cast" tone="text-slate-600 dark:text-slate-400">
          <ul className="mt-5 divide-y divide-slate-100 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {areas.slice(0, 15).map((area) => {
              const color = partyColorFor(area.leaderParty);
              return (
                <li key={area.areaId} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 py-2.5 text-sm">
                  <span className="truncate font-medium text-slate-800 dark:text-slate-200">{area.areaName || area.areaId}</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: color.bg, color: color.text }}>
                    {partyLetter(area.leaderParty) ?? "Other"} +{area.marginPct.toFixed(1)}
                  </span>
                  <span className="w-24 text-right text-slate-500 tabular-nums">{area.total.toLocaleString()}</span>
                </li>
              );
            })}
          </ul>
          {areas.length > 15 ? (
            <Link
              href={`/elections/${election.id}`}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-950 dark:hover:text-white"
            >
              All {areas.length} areas with the results map <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </DocketSection>
      ) : null}

      {others.length ? (
        <DocketSection id="field" icon={<Briefcase className="h-4 w-4" />} eyebrow="Rest of the field" title="Primary, withdrawn, and filed candidates" tone="text-slate-600 dark:text-slate-400">
          <ul className="mt-5 divide-y divide-slate-100 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {others.map((candidate) => (
              <li key={candidate.candidacy.id} className="flex flex-wrap justify-between gap-3 py-2.5 text-sm">
                <CandidateName candidate={candidate} />
                <span className="text-slate-500">
                  {normalizePartyName(candidate.candidacy.party)} ·{" "}
                  {candidate.candidacy.withdrew
                    ? "Withdrawn"
                    : candidate.candidacy.status
                      ? candidate.candidacy.status.replaceAll("_", " ")
                      : "Filed"}
                </span>
              </li>
            ))}
          </ul>
        </DocketSection>
      ) : null}
    </DocketFrame>
  );
}

function CandidateName({ candidate }: { candidate: RaceCandidate }) {
  const href = candidate.hasVotes
    ? writHref("member", candidate.candidacy.candidateEntityId)
    : candidate.entity
      ? publicEntityPath(candidate.entity)
      : null;
  return href ? (
    <Link href={href} className="font-semibold text-slate-900 hover:text-rose-600 dark:text-white">
      {candidate.name}
    </Link>
  ) : (
    <span className="font-semibold">{candidate.name}</span>
  );
}

function CandidateCard({ candidate, total }: { candidate: RaceCandidate; total: number }) {
  const { candidacy } = candidate;
  const color = partyColorFor(candidacy.party);
  const share = total > 0 && candidacy.votes != null ? (candidacy.votes / total) * 100 : null;
  return (
    <article className="rounded-2xl border border-slate-200 border-t-4 p-5 dark:border-slate-800" style={{ borderTopColor: color.border }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <CandidateName candidate={candidate} />
          <p className="mt-1 text-sm text-slate-500">
            {normalizePartyName(candidacy.party)}
            {candidacy.incumbent ? " · Incumbent" : ""}
          </p>
        </div>
        {share != null ? (
          <div className="text-right">
            <p className="font-semibold tabular-nums">{share.toFixed(1)}%</p>
            <p className="text-xs text-slate-500 tabular-nums">{candidacy.votes?.toLocaleString()}</p>
          </div>
        ) : (
          <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: color.bg, color: color.text }}>
            {partyLetter(candidacy.party) ?? "Other"}
          </span>
        )}
      </div>
      {candidacy.won ? <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Winner</p> : null}
      {candidate.finance ? (
        <p className="mt-3 text-xs text-slate-500">
          Raised {formatAmount(candidate.finance.totalReceipts ?? 0, "USD")} · Cash on hand{" "}
          {formatAmount(candidate.finance.cashOnHand ?? 0, "USD")}
        </p>
      ) : null}
      <div className="mt-4 flex gap-4 text-xs font-semibold">
        {candidate.hasVotes ? (
          <Link href={writHref("member", candidacy.candidateEntityId)} className="text-rose-600 hover:text-rose-500 dark:text-rose-400">
            Voting record →
          </Link>
        ) : null}
        {candidate.entity ? (
          <Link href={publicEntityPath(candidate.entity)} className="text-slate-500 hover:text-slate-950 dark:hover:text-white">
            Subpoena case file →
          </Link>
        ) : null}
      </div>
    </article>
  );
}
