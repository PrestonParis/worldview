"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { OFFENSES, type OffenseKey } from "@/lib/crime/offenses";

// The Crime Atlas selection, shared by every /crime section that follows the
// chosen offense. Mirrored to the URL (?offense=&year=&state=&city=&measure=
// &compare=) so a view can be linked. Read from the URL after mount rather
// than with useSearchParams, so the page still renders on the server.

export type Measure = "rate" | "change" | "coverage";

export interface CrimeSelection {
  offense: OffenseKey;
  year: string; // an annual year, or the preliminary year when prelim is true
  prelim: boolean;
  state: string | null;
  city: string | null; // agency ORI
  measure: Measure;
  compare: string;
}

type Ctx = CrimeSelection & { set: (patch: Partial<CrimeSelection>) => void };

const SelectionContext = createContext<Ctx | null>(null);

export function useCrimeSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useCrimeSelection outside CrimeSelectionProvider");
  return ctx;
}

const MEASURES: Measure[] = ["rate", "change", "coverage"];

export function CrimeSelectionProvider({
  years,
  prelimYear,
  states,
  children,
}: {
  years: string[];
  prelimYear: string | null;
  states: string[];
  children: ReactNode;
}) {
  const latest = years.at(-1)!;
  // `hydrated` turns on once the URL has been read, so the write-back below
  // never runs on the defaults and wipes the parameters it is about to read.
  const [sel, setSel] = useState<CrimeSelection & { hydrated: boolean }>({
    hydrated: false,
    offense: "violent_crime",
    year: latest,
    prelim: false,
    state: null,
    city: null,
    measure: "rate",
    compare: "",
  });
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const offense = q.get("offense");
    const year = q.get("year");
    const state = q.get("state")?.toUpperCase() ?? null;
    const compare = q.get("compare")?.toUpperCase() ?? "";
    const measure = q.get("measure") as Measure | null;
    const isPrelim = !!prelimYear && year === prelimYear;
    // The URL is the external source here; reading it after hydration keeps
    // the server render identical to the first client render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSel((cur) => ({
      ...cur,
      hydrated: true,
      offense: OFFENSES.some((o) => o.key === offense) ? (offense as OffenseKey) : cur.offense,
      year: isPrelim || (year && years.includes(year)) ? year! : cur.year,
      prelim: isPrelim,
      state: state && states.includes(state) ? state : null,
      city: q.get("city") || null,
      measure: measure && MEASURES.includes(measure) ? measure : cur.measure,
      compare: states.includes(compare) ? compare : "",
    }));
  }, [years, prelimYear, states]);

  useEffect(() => {
    if (!sel.hydrated) return;
    const q = new URLSearchParams(window.location.search);
    const put = (k: string, v: string | null, fallback: string | null = null) => (v && v !== fallback ? q.set(k, v) : q.delete(k));
    put("offense", sel.offense, "violent_crime");
    put("year", sel.year, latest);
    put("state", sel.state);
    put("city", sel.city);
    put("measure", sel.measure, "rate");
    put("compare", sel.compare);
    const qs = q.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }, [sel, latest]);

  const set = (patch: Partial<CrimeSelection>) => setSel((cur) => ({ ...cur, ...patch }));
  return <SelectionContext.Provider value={{ ...sel, set }}>{children}</SelectionContext.Provider>;
}
