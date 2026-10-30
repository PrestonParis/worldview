"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { POLICIES } from "@/lib/guns/policies";

// The /guns selection: the explorer's policy and state, the open workspace,
// and the evidence-matrix cell. Mirrored to the URL (?policy=&state=&view=
// &row=&outcome=) so any view can be linked; read after mount so the server
// render stays identical to the first client render.

export interface GunSelection {
  policy: string;
  state: string | null;
  view: string | null;
  row: string | null; // evidence row
  outcome: string | null; // evidence outcome
}

type Ctx = GunSelection & { set: (patch: Partial<GunSelection>) => void };

const SelectionContext = createContext<Ctx | null>(null);

export function useGunSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useGunSelection outside GunSelectionProvider");
  return ctx;
}

const DEFAULT_POLICY = POLICIES[0].id;

export function GunSelectionProvider({ states, children }: { states: string[]; children: ReactNode }) {
  const [sel, setSel] = useState<GunSelection & { hydrated: boolean }>({
    hydrated: false,
    policy: DEFAULT_POLICY,
    state: null,
    view: null,
    row: null,
    outcome: null,
  });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const policy = q.get("policy");
    const state = q.get("state")?.toUpperCase() ?? null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSel((cur) => ({
      ...cur,
      hydrated: true,
      policy: POLICIES.some((p) => p.id === policy) ? policy! : cur.policy,
      state: state && states.includes(state) ? state : null,
      view: q.get("view") || null,
      row: q.get("row") || null,
      outcome: q.get("outcome") || null,
    }));
  }, [states]);

  useEffect(() => {
    if (!sel.hydrated) return;
    const q = new URLSearchParams(window.location.search);
    const put = (k: string, v: string | null, fallback: string | null = null) => (v && v !== fallback ? q.set(k, v) : q.delete(k));
    put("policy", sel.policy, DEFAULT_POLICY);
    put("state", sel.state);
    put("view", sel.view);
    put("row", sel.row);
    put("outcome", sel.outcome);
    const qs = q.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }, [sel]);

  const set = (patch: Partial<GunSelection>) => setSel((cur) => ({ ...cur, ...patch }));
  return <SelectionContext.Provider value={{ ...sel, set }}>{children}</SelectionContext.Provider>;
}
