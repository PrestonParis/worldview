import Link from "next/link";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import { RepresentsYou } from "@/components/my-government/highlights";
import { PortraitImage } from "@/components/people/portrait-image";
import { ProfileActions } from "./profile-actions";
import { entityColorFor } from "@/lib/entity-colors";
import { initials } from "@/lib/format";
import { formatPartialDate } from "@/lib/people/profile-model";
import type { HeroRole, KeyFact } from "@/lib/people/profile-view";
import type { Entity } from "@/lib/validation/entity";

// The first screen: who this is, why they matter, and what Worldview holds
// on them, in one compact block.
export function ProfileHero({
  entity,
  summary,
  roles,
  facts,
  updated,
}: {
  entity: Entity;
  summary: string;
  roles: HeroRole[];
  facts: KeyFact[];
  updated: string;
}) {
  const colors = entityColorFor(entity.type);
  return (
    <header className="wv-rise overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-7">
        <div
          className="relative mx-auto aspect-[4/5] w-32 overflow-hidden rounded-2xl sm:mx-0 sm:w-40 lg:w-44"
          style={{ background: colors.bg, color: colors.text }}
        >
          <span aria-hidden className="absolute inset-0 flex items-center justify-center text-4xl font-semibold">
            {initials(entity.name)}
          </span>
          {entity.imageUrl ? <PortraitImage src={entity.imageUrl} /> : null}
        </div>

        <div className="min-w-0">
          <h1 className="text-center font-serif text-3xl font-bold tracking-tight text-slate-950 sm:text-left sm:text-4xl lg:text-[2.75rem] dark:text-white">
            {entity.name}
          </h1>
          {roles.length ? (
            <ul className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {roles.map((role, i) => (
                <li
                  key={role.label}
                  title={role.detail || undefined}
                  className="wv-fade rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  style={{ "--i": i + 2 } as React.CSSProperties}
                >
                  {role.label}
                </li>
              ))}
            </ul>
          ) : null}
          {summary ? (
            <p className="mt-4 max-w-[68ch] text-[1.05rem] leading-7 text-slate-700 dark:text-slate-300">{summary}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start">
            <RepresentsYou entityId={entity.id} bioguideId={entity.bioguideId} />
            {updated ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <CalendarClock aria-hidden className="h-4 w-4" />
                Updated {formatPartialDate(updated)}
              </span>
            ) : null}
            <ProfileActions entityId={entity.id} name={entity.name} />
          </div>
        </div>
      </div>

      {facts.length ? (
        <dl
          className="grid grid-cols-2 border-t border-slate-200 bg-slate-50/70 sm:grid-cols-3 lg:grid-flow-col lg:grid-cols-none lg:auto-cols-fr dark:border-slate-800 dark:bg-slate-900/50"
        >
          {facts.map((fact, i) => {
            const body = (
              <>
                <dt className="text-sm text-slate-500 dark:text-slate-400">{fact.label}</dt>
                <dd className="mt-1 text-lg leading-6 font-semibold text-slate-950 tabular-nums dark:text-white">
                  {fact.value}
                  {fact.href ? <ArrowUpRight aria-hidden className="ml-1 inline h-4 w-4 text-slate-400" /> : null}
                </dd>
                {fact.note ? <dd className="mt-0.5 text-sm leading-5 text-slate-500 dark:text-slate-400">{fact.note}</dd> : null}
              </>
            );
            const cell =
              "wv-rise block border-slate-200 px-5 py-4 dark:border-slate-800 [&:not(:last-child)]:border-b lg:[&:not(:last-child)]:border-b-0 lg:[&:not(:last-child)]:border-r";
            return fact.href ? (
              <Link
                key={fact.label}
                href={fact.href}
                className={`${cell} transition-colors hover:bg-white dark:hover:bg-slate-900`}
                style={{ "--i": i + 3 } as React.CSSProperties}
              >
                {body}
              </Link>
            ) : (
              <div key={fact.label} className={cell} style={{ "--i": i + 3 } as React.CSSProperties}>
                {body}
              </div>
            );
          })}
        </dl>
      ) : null}
    </header>
  );
}
