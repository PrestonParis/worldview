// The elections the tracker follows on its own (data/elections/ga/schedule.json):
// what the watch workflow starts, what the watchdog keeps alive, and which
// city-run elections are read alongside the SOS feed.

import type { CityConfig } from "./city.ts";
import type { ElectionKind } from "./types.ts";

export interface ScheduledElection {
  date: string;
  kind: ElectionKind;
  /** SOS id when known; null means find it in the SOS list by date and kind. */
  id: string | null;
  watchStartUtc: string;
  /** Last day (ET) the watch and watchdog keep this election running. */
  stopAfter: string;
  cities: CityConfig[];
}

export function parseSchedule(raw: unknown): ScheduledElection[] {
  const list = (raw as { elections?: ScheduledElection[] })?.elections ?? [];
  return list.map((e) => ({ ...e, id: e.id ?? null, cities: e.cities ?? [] }));
}

/** Today in Georgia, as YYYY-MM-DD. */
export const etDate = (at: Date = new Date()) => at.toLocaleDateString("en-CA", { timeZone: "America/New_York" });

export const scheduledOn = (schedule: ScheduledElection[], date: string | null) => schedule.find((e) => e.date === date) ?? null;

/** Elections whose watch should be running now: started, and not past stopAfter. */
export function activeElections(schedule: ScheduledElection[], at: Date = new Date()): ScheduledElection[] {
  return schedule.filter((e) => at.getTime() >= Date.parse(e.watchStartUtc) && etDate(at) <= e.stopAfter);
}
