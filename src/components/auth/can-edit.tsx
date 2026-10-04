"use client";

import { createContext, useContext, type ReactNode } from "react";

// Whether the visitor may change shared data. This only hides controls that
// would fail anyway; the server actions enforce it (src/lib/auth/guard.ts).
const CanEditContext = createContext(false);

export function CanEditProvider({ canEdit, children }: { canEdit: boolean; children: ReactNode }) {
  return <CanEditContext.Provider value={canEdit}>{children}</CanEditContext.Provider>;
}

export function useCanEdit(): boolean {
  return useContext(CanEditContext);
}

export function ContributorOnly({ children }: { children: ReactNode }) {
  return useCanEdit() ? children : null;
}
