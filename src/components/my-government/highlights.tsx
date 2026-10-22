"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MapPin, Vote } from "lucide-react";
import { useMyGovernment } from "@/components/my-government/use-my-government";
import { partyName, raceCode, type PartyLetter, type RaceSummary } from "@/lib/elections/overview";
import { US_STATE_NAMES } from "@/lib/money/us-states";
import { isMyRace, myOfficialFor } from "@/lib/my-government/saved";
import { ratingLabel } from "@/lib/validation/raceRating";

// Marks for the visitor's own races and officials, from their saved My
// Government result (use-my-government.ts). Each renders nothing until a
// result is saved, so cached server pages stay the same for everyone.

const BADGE =
  "inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300";

export function useIsMyRace(code: string): boolean {
  return isMyRace(code, useMyGovernment());
}

// A small "Yours" tag for race cards, chips and table rows.
export function MyRaceTag({ code }: { code: string }) {
  if (!useIsMyRace(code) || code === "US") return null;
  return (
    <span className="shrink-0 rounded bg-blue-600 px-1.5 text-[10px] font-semibold uppercase text-white" title="On your saved ballot">
      Yours
    </span>
  );
}

export function OnYourBallot({ jurisdiction }: { jurisdiction: string }) {
  const saved = useMyGovernment();
  if (!isMyRace(raceCode(jurisdiction).code, saved)) return null;
  return (
    <span className={BADGE}>
      <Vote size={12} /> On your ballot · {saved!.place}
    </span>
  );
}

// `link` off for spots already inside a link, like directory cards.
export function RepresentsYou({ entityId, bioguideId, link = true }: { entityId: string; bioguideId?: string | null; link?: boolean }) {
  const official = myOfficialFor({ id: entityId, bioguideId }, useMyGovernment());
  if (!official) return null;
  if (!link) {
    return (
      <span className={`${BADGE} self-start`}>
        <MapPin size={12} /> Represents you
      </span>
    );
  }
  return (
    <Link href="/my-government" className={BADGE} title="From your saved My Government result">
      <MapPin size={12} /> Represents you · {official.office}
    </Link>
  );
}

const PARTY_TEXT: Record<PartyLetter, string> = {
  D: "text-blue-700 dark:text-blue-300",
  R: "text-red-700 dark:text-red-300",
  I: "text-slate-600 dark:text-slate-300",
};

function raceLabel(race: RaceSummary): string {
  if (race.code === "US") return race.office;
  if (race.code.includes("-")) return `${race.office} · ${race.code}`;
  return `${race.office} · ${US_STATE_NAMES[race.stateAbbr ?? ""] ?? race.code}`;
}

function raceLine(race: RaceSummary): string {
  if (race.result) return `${race.result.winnerName} won${race.result.marginPct != null ? ` by ${race.result.marginPct.toFixed(1)} pts` : ""}`;
  const major = race.nominees.filter((nominee) => nominee.party);
  if (major.length) return major.map((nominee) => `${nominee.name} (${nominee.party})`).join(" vs. ");
  if (race.incumbent) return `${race.incumbent.name} (${race.incumbent.party ?? "?"}) holds the seat`;
  return "Candidates not yet filed";
}

// Every race on the saved ballot for one cycle (the newest when omitted).
export function MyRaces({ cycle, showPrompt = false, className = "" }: { cycle?: number; showPrompt?: boolean; className?: string }) {
  const saved = useMyGovernment();
  const [data, setData] = useState<{ key: string; cycle: number | null; races: RaceSummary[] } | null>(null);
  const key = saved ? `${saved.stateCode}|${saved.houseCode ?? ""}|${cycle ?? ""}` : "";

  useEffect(() => {
    if (!saved) return;
    const params = new URLSearchParams({ state: saved.stateCode });
    if (saved.houseCode) params.set("house", saved.houseCode);
    if (cycle) params.set("cycle", String(cycle));
    let live = true;
    fetch(`/api/my-government/races?${params}`)
      .then((res) => (res.ok ? res.json() : { cycle: null, races: [] }))
      .then((body: { cycle: number | null; races: RaceSummary[] }) => {
        if (live) setData({ key, ...body });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [saved, cycle, key]);

  if (!saved) {
    return showPrompt ? (
      <p className={`${className} flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300`}>
        <MapPin size={15} className="text-blue-600" />
        <Link href="/my-government" className="font-medium text-blue-700 hover:underline dark:text-blue-300">Save your address in My Government</Link>
        to see the races on your ballot here.
      </p>
    ) : null;
  }

  const races = data?.key === key ? data.races : [];
  if (!races.length) return null;

  return (
    <section aria-labelledby="my-races-heading" className={`${className} rounded-2xl border border-blue-200 bg-blue-50/60 p-5 dark:border-blue-900/60 dark:bg-blue-950/20`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="my-races-heading" className="text-base font-semibold text-slate-950 dark:text-white">
          Your {data?.cycle ?? ""} races
        </h2>
        <Link href="/my-government" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          <MapPin size={12} /> {saved.place}
        </Link>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {races.map((race) => {
          const party = race.result?.winnerParty ?? race.incumbent?.party ?? null;
          return (
            <li key={race.id}>
              <Link
                href={`/elections/${race.id}`}
                className="block h-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-600"
              >
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  {raceLabel(race)}{race.special ? " (special)" : ""}
                </p>
                <p className={`mt-1 text-sm font-medium ${party ? PARTY_TEXT[party] : "text-slate-900 dark:text-white"}`} title={party ? partyName(party) : undefined}>
                  {raceLine(race)}
                </p>
                {race.rating || race.openSeat ? (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {[race.rating ? ratingLabel(race.rating) : "", race.openSeat ? "Open seat" : ""].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
