"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { ISSUE_GROUPS, issueGroup, type IssueGroupId } from "@/lib/quiz/issue-groups";
import type { IssueProfile } from "@/lib/quiz/results";
import { small } from "./results-ui";

type Sort = "category" | "importance";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const IMPORTANCE = { 1: "Low", 2: "Medium", 3: "High" } as const;
// Sort weight: most important first, skipped issues last.
const weight = (p: IssueProfile) => (p.skipped ? -1 : (p.importance ?? 0));

// Checklists and multiple selections give one stance per item; show them
// under a single label.
function groupByQuestion(attributes: IssueProfile["attributes"]) {
  const groups: { questionId: string; attribute: string; stances: string[] }[] = [];
  for (const a of attributes) {
    const last = groups.at(-1);
    if (last?.questionId === a.questionId) last.stances.push(a.stance);
    else groups.push({ questionId: a.questionId, attribute: a.attribute, stances: [a.stance] });
  }
  return groups;
}

// Issue-by-issue answers as a searchable profile: grouped by category,
// filterable, sortable by how much each issue matters to the respondent.
export function ResultsIssues({ profiles, slug, canEdit }: { profiles: IssueProfile[]; slug: string; canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<IssueGroupId | "all">("all");
  const [highOnly, setHighOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("category");

  const counts = useMemo(() => {
    const c = new Map<IssueGroupId, number>();
    for (const p of profiles) c.set(issueGroup(p.issueId), (c.get(issueGroup(p.issueId)) ?? 0) + 1);
    return c;
  }, [profiles]);
  const hasImportance = profiles.some((p) => p.importance !== null);

  const q = query.trim().toLowerCase();
  const shown = profiles.filter(
    (p) =>
      (group === "all" || issueGroup(p.issueId) === group) &&
      (!highOnly || p.importance === 3) &&
      (!q || p.name.toLowerCase().includes(q) || p.attributes.some((a) => a.stance.toLowerCase().includes(q) || a.attribute.toLowerCase().includes(q))),
  );
  const sections =
    sort === "importance"
      ? [{ id: "sorted", label: null, items: [...shown].sort((a, b) => weight(b) - weight(a)) }]
      : ISSUE_GROUPS.map((g) => ({ id: g.id, label: g.label, items: shown.filter((p) => issueGroup(p.issueId) === g.id) })).filter((s) => s.items.length > 0);

  const chip = (active: boolean) =>
    `inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
      active
        ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
        : "border-slate-200 text-slate-700 hover:border-slate-400 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
    }`;

  return (
    <div className="mt-5 space-y-5">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1 sm:max-w-sm">
            <span className="sr-only">Search issues</span>
            <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search issues and positions"
              className="min-h-10 w-full rounded-full border border-slate-300 bg-white py-2 pr-4 pl-9 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {hasImportance && (
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={highOnly} onChange={(e) => setHighOnly(e.target.checked)} className="size-4 accent-slate-900" />
                High importance only
              </label>
            )}
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="min-h-10 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="category">By category</option>
                <option value="importance">By importance</option>
              </select>
            </label>
            {canEdit && (
              <Link
                href={`/quiz/${slug}?view=priorities`}
                className="inline-flex min-h-10 items-center rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
              >
                Rank importance
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          <button type="button" aria-pressed={group === "all"} onClick={() => setGroup("all")} className={chip(group === "all")}>
            All <span className="tabular-nums opacity-70">{profiles.length}</span>
          </button>
          {ISSUE_GROUPS.filter((g) => counts.has(g.id)).map((g) => (
            <button key={g.id} type="button" aria-pressed={group === g.id} onClick={() => setGroup(g.id)} className={chip(group === g.id)}>
              {g.label} <span className="tabular-nums opacity-70">{counts.get(g.id)}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
          No issues match these filters.
        </p>
      ) : (
        sections.map((s) => (
          <div key={s.id}>
            {s.label && (
              <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {s.label}
                <span className="font-normal text-slate-500 tabular-nums dark:text-slate-400">{s.items.length}</span>
              </h3>
            )}
            <div className="grid items-start gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
              {s.items.map((p) => (
                <IssueCard key={p.issueId} profile={p} slug={slug} canEdit={canEdit} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ImportanceBadge({ level }: { level: 1 | 2 | 3 }) {
  const tone = {
    3: "bg-slate-950 text-white dark:bg-white dark:text-slate-950",
    2: "border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200",
    1: "text-slate-500 dark:text-slate-400",
  }[level];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tone}`}>
      {IMPORTANCE[level]}
      <span className="sr-only"> importance</span>
    </span>
  );
}

function IssueCard({ profile: p, slug, canEdit }: { profile: IssueProfile; slug: string; canEdit: boolean }) {
  const position = p.attributes[0]?.stance;
  const head = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-950 dark:text-white">{p.name}</span>
        <span className={`mt-0.5 block text-sm leading-snug ${p.skipped ? "text-slate-500 italic dark:text-slate-400" : "line-clamp-2 text-slate-700 dark:text-slate-300"}`}>
          {p.skipped ? "Skipped" : capitalize(position ?? "")}
        </span>
      </span>
      {p.importance && !p.skipped && <ImportanceBadge level={p.importance} />}
    </>
  );
  if (p.skipped) {
    return <div id={`issue-${p.issueId}`} className="flex scroll-mt-32 items-start gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-3 lg:scroll-mt-20 dark:border-slate-800">{head}</div>;
  }
  const groups = groupByQuestion(p.attributes);
  return (
    <details
      id={`issue-${p.issueId}`}
      className="group/issue scroll-mt-32 rounded-xl border border-slate-200 bg-white transition-shadow open:border-slate-300 open:shadow-sm lg:scroll-mt-20 dark:border-slate-800 dark:bg-slate-950 dark:open:border-slate-600"
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-start gap-3 px-4 py-3">
        {head}
        <ChevronDown size={16} aria-hidden className="mt-1 shrink-0 text-slate-500 transition-transform group-open/issue:rotate-180" />
      </summary>
      <dl className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
        {groups.map((g) => (
          <div key={g.questionId}>
            <dt className={small}>{g.attribute}</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {g.stances.map((stance, i) => {
                const cls = "inline-block rounded-lg bg-white px-2.5 py-1 text-sm leading-snug text-slate-900 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700";
                return canEdit ? (
                  <Link key={i} href={`/quiz/${slug}?edit=choice:${g.questionId}`} className={`${cls} hover:ring-slate-400`} title="Change this answer">
                    {capitalize(stance)}
                  </Link>
                ) : (
                  <span key={i} className={cls}>
                    {capitalize(stance)}
                  </span>
                );
              })}
            </dd>
          </div>
        ))}
        {canEdit && <p className={small}>Select a position to change that answer.</p>}
      </dl>
    </details>
  );
}
