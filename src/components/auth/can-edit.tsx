"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Who is signed in, resolved in the browser so the shell layout stays
// cacheable. Only visitors holding a Supabase cookie ask /api/session;
// everyone else (and every crawler) costs nothing.
export interface SessionInfo {
  accountLabel: string | null;
  // Whether the visitor may change shared data. This only hides controls that
  // would fail anyway; the server actions enforce it (src/lib/auth/guard.ts).
  canEdit: boolean;
}

const SIGNED_OUT: SessionInfo = { accountLabel: null, canEdit: false };
const SessionContext = createContext<SessionInfo>(SIGNED_OUT);

const hasSessionCookie = () => document.cookie.split(";").some((c) => c.trim().startsWith("sb-"));

export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<SessionInfo>(SIGNED_OUT);

  // Re-checked on navigation so a sign-in redirect shows up. Signing out
  // lands on /login, outside the shell, which drops this state anyway.
  useEffect(() => {
    if (!hasSessionCookie()) return;
    let live = true;
    fetch("/api/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : SIGNED_OUT))
      .then((info: SessionInfo) => { if (live) setSession(info); })
      .catch(() => {});
    return () => { live = false; };
  }, [pathname]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionInfo {
  return useContext(SessionContext);
}

export function useCanEdit(): boolean {
  return useContext(SessionContext).canEdit;
}

export function ContributorOnly({ children }: { children: ReactNode }) {
  return useCanEdit() ? children : null;
}
