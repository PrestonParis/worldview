"use client";

import { useSyncExternalStore } from "react";
import { hasSessionCookie } from "@/components/auth/can-edit";
import { clearGovernmentAction, saveGovernmentAction } from "@/lib/actions/myGovernment";
import { readStoredJson, writeStoredJson } from "@/lib/browser/storage";
import { parseSavedGovernment, toSavedGovernment, type SavedGovernment } from "@/lib/my-government/saved";
import type { GovernmentLookupResult } from "@/lib/my-government/types";

// The visitor's saved My Government result, shared by every component that
// highlights "your" races and officials. Kept in localStorage for everyone;
// signed-in accounts also keep it server-side, which wins on load so it
// follows them across devices.

const LOCAL_KEY = "worldview-my-government";

// `synced` is false for a save made while signed out, which is pushed to the
// account the next time a session is found.
interface LocalRecord {
  saved: SavedGovernment;
  synced: boolean;
}

let current: SavedGovernment | null = null;
let started = false;
const listeners = new Set<() => void>();

function set(next: SavedGovernment | null) {
  current = next;
  for (const listener of listeners) listener();
}

function readLocal(): LocalRecord | null {
  const raw = readStoredJson("local", LOCAL_KEY) as { saved?: unknown; synced?: unknown } | null;
  const saved = parseSavedGovernment(raw?.saved);
  return saved ? { saved, synced: raw?.synced === true } : null;
}

function start() {
  if (started) return;
  started = true;
  const local = readLocal();
  if (local) set(local.saved);
  if (!hasSessionCookie()) return;

  fetch("/api/my-government/saved", { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((body: { signedIn?: boolean; saved?: unknown } | null) => {
      if (!body?.signedIn) return;
      const remote = parseSavedGovernment(body.saved);
      if (remote) {
        writeStoredJson("local", LOCAL_KEY, { saved: remote, synced: true });
        set(remote);
      } else if (local && !local.synced) {
        void saveGovernmentAction(local.saved).then((result) => {
          if (result.ok) writeStoredJson("local", LOCAL_KEY, { saved: local.saved, synced: true });
        });
      } else if (local) {
        // Synced before but gone from the account: cleared on another device.
        writeStoredJson("local", LOCAL_KEY, null);
        set(null);
      }
    })
    .catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

// Resolves to whether the account copy was updated too (false when signed out).
export async function saveMyGovernment(result: GovernmentLookupResult): Promise<boolean> {
  const saved = toSavedGovernment(result);
  writeStoredJson("local", LOCAL_KEY, { saved, synced: false });
  set(saved);
  if (!hasSessionCookie()) return false;
  const response = await saveGovernmentAction(saved).catch(() => null);
  if (response?.ok) writeStoredJson("local", LOCAL_KEY, { saved, synced: true });
  return Boolean(response?.ok);
}

export async function clearMyGovernment(): Promise<void> {
  writeStoredJson("local", LOCAL_KEY, null);
  set(null);
  if (hasSessionCookie()) await clearGovernmentAction().catch(() => null);
}

export function useMyGovernment(): SavedGovernment | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
