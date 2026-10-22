// Which tabs a profile shows, decided by the records it has rather than by a
// single entity type: a donor gets Money, anyone with sourced quotations gets
// Quotes. Tabs without data never render as empty shells. See
// docs/people-profile-architecture.md, "Profile modules".

import { highlightEvents, summarizeGiving, type EventRecord } from "./profile-model";
import { parseHighlights } from "../validation/entity";
import type { ProfileBundle } from "../db/profile-records";

export const profileTabs = [
  { id: "overview", label: "Overview", path: "" },
  { id: "biography", label: "Biography", path: "biography" },
  { id: "money", label: "Money", path: "money" },
  { id: "quotes", label: "Quotes", path: "quotes" },
] as const;

export type ProfileTabId = (typeof profileTabs)[number]["id"];

/** Editorial events plus, for profiles without them, dated legacy highlights. */
export function profileEvents(bundle: ProfileBundle): EventRecord[] {
  // Another profile's event this entity takes part in names its actor:
  // "Peter Thiel: Co-founds Confinity" on PayPal's timeline.
  const events = bundle.events.map((e) =>
    e.subjectEntityId === bundle.entity.id
      ? e
      : { ...e, title: `${bundle.entities.get(e.subjectEntityId)?.name ?? "Related"}: ${e.title}`, chapterKey: "" },
  );
  // Until a profile has its own editorial events, its dated highlights fill in.
  const own = bundle.events.some((e) => e.subjectEntityId === bundle.entity.id);
  return own ? events : [...events, ...highlightEvents(parseHighlights(bundle.entity.highlights), bundle.entity.id)];
}

export function availableTabs(bundle: ProfileBundle): Set<ProfileTabId> {
  const { entity, editorial, legacy } = bundle;
  const tabs = new Set<ProfileTabId>(["overview"]);
  if (editorial?.chapters.length || legacy?.sections.length || entity.biography?.trim()) tabs.add("biography");
  const received = bundle.received.raised.reduce((t, r) => t + r.count, 0);
  if (summarizeGiving(bundle.given).count || received || bundle.outside.length || bundle.lobbying.length) tabs.add("money");
  if (bundle.statements.some((s) => s.quote)) tabs.add("quotes");
  return tabs;
}

export function tabHref(base: string, id: ProfileTabId): string {
  const tab = profileTabs.find((t) => t.id === id)!;
  return tab.path ? `${base}/${tab.path}` : base;
}
