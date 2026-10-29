"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PortraitImage } from "@/components/people/portrait-image";
import { formatValue } from "@/lib/format";
import { quoteDate } from "@/lib/people/profile-model";
import type { ProfileSample, SubpoenaShowcase as SubpoenaData } from "@/lib/home/showcase";
import { CardHeading, CtaLink, ShowcaseCard, Tabs, focusRing, formatDay, metaLine, stage } from "./showcase-ui";

type View = "money" | "timeline" | "quotes";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export function SubpoenaShowcase({ data }: { data: SubpoenaData }) {
  const [index, setIndex] = useState(0);
  const profile = data.profiles[index];

  return (
    <ShowcaseCard>
      <CardHeading tool="subpoena" title="Who holds power, and what’s on the record?">
        Sourced files on the people behind American politics: what they built, what they gave, what they said, and when.
      </CardHeading>

      {data.profiles.length > 1 ? (
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900" role="group" aria-label="Sample profile">
          {data.profiles.map((p, i) => (
            <button
              key={p.href}
              type="button"
              aria-pressed={index === i}
              onClick={() => setIndex(i)}
              className={`flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${focusRing} ${
                index === i
                  ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Portrait profile={p} size="size-6" text="text-[9px]" />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      <ProfilePreview key={profile.href} profile={profile} />

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <CtaLink href={profile.href} primary>Open Full Profile</CtaLink>
        <CtaLink href="/subpoena">Browse Profiles</CtaLink>
      </div>
    </ShowcaseCard>
  );
}

function Portrait({ profile, size, text }: { profile: ProfileSample; size: string; text: string }) {
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${size} ${text}`}>
      {initials(profile.name)}
      {profile.imageUrl ? <PortraitImage src={profile.imageUrl} /> : null}
    </span>
  );
}

function ProfilePreview({ profile }: { profile: ProfileSample }) {
  const tabs = [
    ...(profile.giving ? [{ id: "money" as const, label: "Money" }] : []),
    ...(profile.events.length ? [{ id: "timeline" as const, label: "Timeline" }] : []),
    ...(profile.quotes.length ? [{ id: "quotes" as const, label: "In their words" }] : []),
  ];
  const [view, setView] = useState<View>(tabs[0]?.id ?? "money");
  const facts = profile.facts.slice(0, 4);

  return (
    <div className={`mt-3 ${stage}`}>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <Portrait profile={profile} size="size-14" text="text-base" />
          <div className="min-w-0">
            <p className="truncate text-lg leading-tight font-semibold text-slate-950 dark:text-white">{profile.name}</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-600 dark:text-slate-400">{profile.roles.join(" · ")}</p>
          </div>
        </div>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-800 dark:text-slate-200">{profile.summary}</p>

        {facts.length ? (
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
                <dt className="truncate text-[11px] font-medium text-slate-600 dark:text-slate-400">{f.label}</dt>
                <dd className="truncate text-sm font-semibold text-slate-950 dark:text-white" title={f.value}>{f.value}</dd>
                {f.note ? <p className="truncate text-[11px] text-slate-500 dark:text-slate-400" title={f.note}>{f.note}</p> : null}
              </div>
            ))}
          </dl>
        ) : null}

        {profile.tradition ? (
          <p className={`mt-3 ${metaLine}`}>
            Political tradition:{" "}
            {profile.tradition.href ? (
              <Link href={profile.tradition.href} className={`font-semibold text-blue-700 hover:underline dark:text-blue-300 ${focusRing}`}>
                {profile.tradition.label}
              </Link>
            ) : (
              <span className="font-semibold text-slate-900 dark:text-slate-100">{profile.tradition.label}</span>
            )}
            {profile.tradition.basis.length <= 24 ? ` · ${profile.tradition.basis.toLowerCase()}` : ""}
          </p>
        ) : null}
      </div>

      {tabs.length ? (
        <div className="border-t border-slate-200 bg-white px-4 pt-3 pb-4 dark:border-slate-800 dark:bg-slate-950">
          <Tabs label={`${profile.name} records`} idPrefix="subpoena-showcase" value={view} onChange={setView} tabs={tabs} />
          <div className="mt-3 min-h-44">
            {profile.giving ? (
              <div role="tabpanel" id="subpoena-showcase-panel-money" aria-labelledby="subpoena-showcase-tab-money" hidden={view !== "money"}>
                <GivingPanel giving={profile.giving} />
              </div>
            ) : null}
            <div role="tabpanel" id="subpoena-showcase-panel-timeline" aria-labelledby="subpoena-showcase-tab-timeline" hidden={view !== "timeline"}>
              <ol className="space-y-2.5">
                {profile.events.map((e) => (
                  <li key={`${e.date}-${e.title}`} className="grid grid-cols-[3.25rem_1fr] gap-2 text-sm">
                    <span className="font-semibold text-slate-950 tabular-nums dark:text-white">{e.date.slice(0, 4)}</span>
                    <span className="text-slate-700 dark:text-slate-300">{e.title}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div role="tabpanel" id="subpoena-showcase-panel-quotes" aria-labelledby="subpoena-showcase-tab-quotes" hidden={view !== "quotes"}>
              <ul className="space-y-3">
                {profile.quotes.map((q) => (
                  <li key={q.quote}>
                    <blockquote className="border-l-2 border-violet-500 pl-3 text-sm leading-6 text-slate-900 dark:text-slate-100">“{q.quote}”</blockquote>
                    <p className={`mt-1 pl-3 ${metaLine}`}>
                      {[quoteDate(q), q.venue].filter(Boolean).join(" · ")}
                      {q.source ? (
                        <>
                          {" · "}
                          <a href={q.source.url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-0.5 underline decoration-slate-300 underline-offset-2 hover:text-slate-950 dark:decoration-slate-600 dark:hover:text-white ${focusRing}`}>
                            {q.source.publisher}
                            <ExternalLink size={10} aria-hidden />
                          </a>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Itemized giving per two-year election cycle, every cycle from the first
// to the last drawn so gaps read as gaps.
function GivingPanel({ giving }: { giving: NonNullable<ProfileSample["giving"]> }) {
  const byCycle = new Map(giving.cycles.map((c) => [c.cycle, c.total]));
  const first = giving.cycles[0]?.cycle ?? 0;
  const last = giving.cycles.at(-1)?.cycle ?? 0;
  const cycles: { cycle: number; total: number }[] = [];
  for (let c = first; c <= last; c += 2) cycles.push({ cycle: c, total: byCycle.get(c) ?? 0 });
  const max = Math.max(1, ...cycles.map((c) => c.total));
  const peak = cycles.reduce((a, b) => (b.total > a.total ? b : a), cycles[0]);
  return (
    <div>
      <p className="text-sm text-slate-800 dark:text-slate-200">
        <span className="font-semibold text-slate-950 tabular-nums dark:text-white">{formatValue(giving.total, "usd", { compact: true })}</span> in{" "}
        {giving.count.toLocaleString()} itemized FEC contributions, {giving.first.slice(0, 4)}–{giving.last.slice(0, 4)}
      </p>
      <div
        className="mt-3 flex h-16 items-end gap-px"
        role="img"
        aria-label={`Contributions by election cycle, ${first} to ${last}. Largest: ${formatValue(peak.total, "usd", { compact: true })} in the ${peak.cycle} cycle.`}
      >
        {cycles.map((c) => (
          <span
            key={c.cycle}
            title={`${c.cycle - 1}–${String(c.cycle).slice(2)}: ${formatValue(c.total, "usd")}`}
            className={`flex-1 rounded-t-sm ${c.cycle === peak.cycle ? "bg-violet-600 dark:bg-violet-400" : "bg-violet-300 dark:bg-violet-800"}`}
            style={{ height: `${c.total ? Math.max(3, (c.total / max) * 100) : 0}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
        <span>{first} cycle</span>
        <span>Peak {formatValue(peak.total, "usd", { compact: true })}, {peak.cycle - 1}–{String(peak.cycle).slice(2)}</span>
        <span>{last}</span>
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-700 dark:text-slate-300">Largest recipients</p>
      <ul className="mt-1 space-y-1">
        {giving.top.map((r) => (
          <li key={r.href} className="flex items-baseline justify-between gap-3 text-sm">
            <Link href={r.href} className={`truncate text-slate-800 hover:text-blue-700 hover:underline dark:text-slate-200 dark:hover:text-blue-300 ${focusRing}`}>{r.name}</Link>
            <span className="shrink-0 font-semibold text-slate-950 tabular-nums dark:text-white">{formatValue(r.total, "usd", { compact: true })}</span>
          </li>
        ))}
      </ul>
      <p className={`mt-2 ${metaLine}`}>Federal Election Commission, latest record {formatDay(giving.last)}</p>
    </div>
  );
}
