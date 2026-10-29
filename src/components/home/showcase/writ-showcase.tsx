"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { RATING_STYLE } from "@/lib/elections/overview";
import type { BillSample, BillStage, RaceSample, WritShowcase as WritData } from "@/lib/home/showcase";
import { CardHeading, CtaLink, ShowcaseCard, Tabs, focusRing, formatDay, metaLine, stage } from "./showcase-ui";

type View = "bill" | "race";

const PARTY_LABEL: Record<string, string> = { D: "Democrat", R: "Republican", I: "Independent" };
const PARTY_DOT: Record<string, string> = { D: "bg-blue-600", R: "bg-red-600", I: "bg-violet-600" };

export function WritShowcase({ data }: { data: WritData }) {
  const [view, setView] = useState<View>(data.bills.length ? "bill" : "race");
  const [billIndex, setBillIndex] = useState(0);
  const bill = data.bills[billIndex];
  const tabs = [
    ...(data.bills.length ? [{ id: "bill" as const, label: "Legislation" }] : []),
    ...(data.race ? [{ id: "race" as const, label: "Elections" }] : []),
  ];

  return (
    <ShowcaseCard>
      <CardHeading tool="writ" title="What happens after a bill is introduced?">
        Follow any bill from introduction through committee, floor votes and the President&rsquo;s desk, and any race from filing to result.
      </CardHeading>

      <div className="mt-5">
        {tabs.length > 1 ? <Tabs label="Writ preview" idPrefix="writ-showcase" value={view} onChange={setView} tabs={tabs} /> : null}
        <div className={`mt-3 p-4 ${stage}`}>
          {bill ? (
            <div role="tabpanel" id="writ-showcase-panel-bill" aria-labelledby="writ-showcase-tab-bill" hidden={view !== "bill"}>
              {data.bills.length > 1 ? (
                <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Sample bill">
                  {data.bills.map((b, i) => (
                    <button
                      key={b.id}
                      type="button"
                      aria-pressed={billIndex === i}
                      onClick={() => setBillIndex(i)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${focusRing} ${
                        billIndex === i
                          ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-400 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                      }`}
                    >
                      {b.number} · {b.stages.at(-1)?.status === "done" ? "Law" : "In progress"}
                    </button>
                  ))}
                </div>
              ) : null}
              <BillJourney bill={bill} />
            </div>
          ) : null}
          {data.race ? (
            <div role="tabpanel" id="writ-showcase-panel-race" aria-labelledby="writ-showcase-tab-race" hidden={view !== "race"}>
              <RacePanel race={data.race} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        {view === "race" && data.race ? (
          <CtaLink href={data.race.href} primary>Follow This Race</CtaLink>
        ) : bill ? (
          <CtaLink href={bill.href} primary>Follow This Bill</CtaLink>
        ) : null}
        <CtaLink href={data.electionsHref}>Explore Elections</CtaLink>
      </div>
    </ShowcaseCard>
  );
}

function BillJourney({ bill }: { bill: BillSample }) {
  const committees = bill.committees.join(" and ");
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {bill.number} · {bill.congress ? `${bill.congress}th Congress` : bill.chamber}
      </p>
      <p className="mt-1 text-lg leading-snug font-semibold text-slate-950 dark:text-white">{bill.title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
        A {bill.policyArea.toLowerCase()} bill
        {bill.sponsor ? <> sponsored by {bill.chamber === "Senate" ? "Sen." : "Rep."} {bill.sponsor}</> : null}
        {committees ? <>, referred to {committees}</> : null}.
      </p>
      <ol className="mt-4">
        {bill.stages.map((s, i) => (
          <StageRow key={s.key} stage={s} last={i === bill.stages.length - 1} />
        ))}
      </ol>
      <p className={`mt-1 border-t border-slate-200 pt-2.5 dark:border-slate-800 ${metaLine}`}>
        Latest action, {formatDay(bill.latest.date)}: {bill.latest.text.replace(/\s*\(consideration:.*\)\.?$/, "")} · Congress.gov
      </p>
    </div>
  );
}

function StageRow({ stage: s, last }: { stage: BillStage; last: boolean }) {
  const done = s.status === "done";
  const current = s.status === "current";
  return (
    <li className="relative grid grid-cols-[1.25rem_1fr] gap-x-3 pb-3">
      {!last ? (
        <span
          aria-hidden
          className={`absolute top-5 bottom-0 left-[9px] w-0.5 ${done ? "bg-indigo-600 dark:bg-indigo-400" : "border-l-2 border-dashed border-slate-300 dark:border-slate-700"}`}
        />
      ) : null}
      <span
        aria-hidden
        className={`relative z-10 mt-0.5 flex size-5 items-center justify-center rounded-full ${
          done
            ? "bg-indigo-600 text-white dark:bg-indigo-400 dark:text-slate-950"
            : current
              ? "border-2 border-indigo-600 bg-white ring-4 ring-indigo-600/15 dark:border-indigo-400 dark:bg-slate-950"
              : "border-2 border-dashed border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-950"
        }`}
      >
        {done ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className={`font-semibold ${s.status === "upcoming" ? "text-slate-500 dark:text-slate-400" : "text-slate-950 dark:text-white"}`}>{s.label}</span>
          {s.date ? <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">{formatDay(s.date)}</span> : null}
          {current ? <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">Next step</span> : null}
          <span className="sr-only">{done ? "(completed)" : current ? "(next step, not yet recorded)" : "(not yet reached)"}</span>
        </p>
        {s.detail ? <p className={metaLine}>{s.detail}</p> : null}
      </div>
    </li>
  );
}

function RacePanel({ race }: { race: RaceSample }) {
  const hasVotes = race.candidates.some((c) => c.votes !== null && c.votes > 0);
  const totalVotes = race.candidates.reduce((sum, c) => sum + (c.votes ?? 0), 0);
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        General election · {formatDay(race.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
      </p>
      <p className="mt-1 text-lg leading-snug font-semibold text-slate-950 dark:text-white">{race.title}</p>
      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
        {race.status === "scheduled" ? "Scheduled. No votes have been reported yet." : hasVotes ? "Results reported." : "No results recorded."}
      </p>

      <ul className="mt-4 space-y-2">
        {race.candidates.map((c) => (
          <li key={c.name} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <span className={`size-2.5 shrink-0 rounded-full ${PARTY_DOT[c.party] ?? "bg-slate-400"}`} aria-hidden />
              <span className="truncate font-semibold text-slate-950 dark:text-white">{c.name}</span>
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {PARTY_LABEL[c.party] ?? c.party}{c.incumbent ? " · incumbent" : ""}
              </span>
            </span>
            {hasVotes && c.votes !== null ? (
              <span className="shrink-0 text-sm font-semibold text-slate-950 tabular-nums dark:text-white">
                {((c.votes / totalVotes) * 100).toFixed(1)}%
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {race.ratings.length ? (
        <div className="mt-4">
          <p className="text-sm text-slate-800 dark:text-slate-200">
            Forecasters&rsquo; consensus: <strong className="font-semibold text-slate-950 dark:text-white">{race.consensus?.label ?? "—"}</strong>
          </p>
          <ul className="mt-2 grid grid-cols-3 gap-1.5">
            {race.ratings.map((r) => (
              <li key={r.source} className="rounded-lg px-2 py-2 text-center" style={{ backgroundColor: RATING_STYLE[r.rating].fill, color: RATING_STYLE[r.rating].text }}>
                <span className="block text-sm font-semibold">{r.label}</span>
                <span className="block text-[11px] opacity-85">{r.source}, {formatDay(r.asOf, { month: "short", day: "numeric" })}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
