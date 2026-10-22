"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, BadgeDollarSign, ExternalLink, FileText, Phone, UserRound, Vote } from "lucide-react";
import { formatValue, initials } from "@/lib/format";
import { partyColor, partyLetter } from "@/lib/money/semantic";
import type { GovernmentOfficial, OfficialRecord } from "@/lib/my-government/types";

// One officeholder on a My Government result: who they are, the numbers
// Worldview holds on them, and where to go next. `record` arrives after the
// card first renders (records.ts), so everything it adds is optional.

const usd = (v: number) => formatValue(v, "usd", { compact: true });

function raceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function OfficialAvatar({ name, party, size = "md" }: { name: string; party?: string; size?: "sm" | "md" }) {
  const color = partyColor(party);
  const box = size === "sm" ? "h-8 w-8 text-[11px]" : "h-12 w-12 text-sm";
  return (
    <span
      className={`${box} relative flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white dark:ring-slate-950`}
      style={{ background: color }}
      title={party ? `${name} (${party})` : name}
    >
      {initials(name)}
    </span>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <span className="block text-lg font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">{value}</span>
      <span className="block text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-lg px-2 py-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-900">
      {body}
    </Link>
  ) : (
    <div className="px-2 py-1.5">{body}</div>
  );
}

// DW-NOMINATE's economic dimension on a left–right track.
function IdeologyMeter({ score }: { score: number }) {
  const at = Math.min(100, Math.max(0, ((score + 1) / 2) * 100));
  return (
    <div className="px-2">
      <div className="flex items-baseline justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>Left</span>
        <span className="font-medium text-slate-700 tabular-nums dark:text-slate-200">
          DW-NOMINATE {score > 0 ? "+" : score < 0 ? "−" : ""}
          {Math.abs(score).toFixed(2)}
        </span>
        <span>Right</span>
      </div>
      <div
        className="relative mt-1.5 h-1.5 rounded-full"
        style={{ background: "linear-gradient(90deg, var(--viz-dem), #cbd5e1 50%, var(--viz-rep))" }}
      >
        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow dark:border-slate-950 dark:bg-white"
          style={{ left: `${at}%` }}
        />
      </div>
    </div>
  );
}

function Action({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
    >
      {icon}
      {children}
    </Link>
  );
}

export function OfficialCard({ official, record }: { official: GovernmentOfficial; record?: OfficialRecord }) {
  const name = official.name ?? official.office;
  const letter = partyLetter(official.party);
  const color = partyColor(official.party);
  const r = record;
  const moneyHref = r?.finance ? `/money?cycle=${r.finance.cycle}&candidate=${r.entityId}#follow` : null;
  const votesHref = r && r.rollCallVotes > 0 ? `/legislation/members/${r.entityId}` : null;
  const stats = r
    ? [
        r.finance ? { label: `Raised, ${r.finance.cycle}`, value: usd(r.finance.receipts), href: moneyHref ?? undefined } : null,
        r.rollCallVotes ? { label: "Roll-call votes", value: r.rollCallVotes.toLocaleString(), href: votesHref ?? undefined } : null,
        r.billsSponsored ? { label: "Bills sponsored", value: r.billsSponsored.toLocaleString(), href: r.profilePath } : null,
        r.finance?.cashOnHand ? { label: "Cash on hand", value: usd(r.finance.cashOnHand), href: moneyHref ?? undefined } : null,
      ].filter((s): s is NonNullable<typeof s> => s !== null).slice(0, 3)
    : [];

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <div className="flex items-start gap-3.5 p-5 pb-4">
        <OfficialAvatar name={name} party={official.party} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{official.office}</p>
          <h3 className="mt-0.5 text-lg leading-snug font-semibold text-slate-950 dark:text-white">
            {r ? (
              <Link href={r.profilePath} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {official.party ? (
              <span className="inline-flex items-center gap-1 font-medium" style={{ color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                {letter === "D" ? "Democrat" : letter === "R" ? "Republican" : official.party}
              </span>
            ) : null}
            <span>{official.jurisdiction}</span>
          </p>
        </div>
      </div>

      {r?.nextRace ? (
        <Link
          href={`/elections/${r.nextRace.id}`}
          className="mx-5 mb-3 flex items-center justify-between gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-950/70"
        >
          <span className="flex items-center gap-1.5">
            <Vote size={13} /> On your ballot {raceDate(r.nextRace.date)}
          </span>
          <ArrowUpRight size={13} />
        </Link>
      ) : null}

      {stats.length ? (
        <div className="mx-3 grid grid-cols-3 gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
          {stats.map((s) => (
            <Stat key={s.label} {...s} />
          ))}
        </div>
      ) : null}

      {r?.nominate != null ? (
        <div className="mx-3 mt-3">
          <IdeologyMeter score={r.nominate} />
        </div>
      ) : null}

      <div className="min-h-4 flex-1" />
      <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 px-3 py-2.5 dark:border-slate-800">
        {r ? <Action href={r.profilePath} icon={<UserRound size={13} />}>Profile</Action> : null}
        {votesHref ? <Action href={votesHref} icon={<FileText size={13} />}>Votes</Action> : null}
        {moneyHref ? <Action href={moneyHref} icon={<BadgeDollarSign size={13} />}>Money</Action> : null}
        <span className="ml-auto flex items-center gap-1">
          {official.phone ? (
            <a
              href={`tel:${official.phone.replace(/[^\d+]/g, "")}`}
              title={official.phone}
              aria-label={`Call ${official.phone}`}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
            >
              <Phone size={14} />
            </a>
          ) : null}
          {official.website ? (
            <a
              href={official.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
            >
              Website <ExternalLink size={11} />
            </a>
          ) : null}
        </span>
      </div>
    </article>
  );
}
