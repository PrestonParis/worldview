export type StorageArea = "local" | "session";

function storageFor(area: StorageArea): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return area === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function parseStoredJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function readStoredJson(area: StorageArea, key: string): unknown {
  const storage = storageFor(area);
  if (!storage) return null;
  try {
    return parseStoredJson(storage.getItem(key));
  } catch {
    return null;
  }
}

export function writeStoredJson(area: StorageArea, key: string, value: unknown): boolean {
  const storage = storageFor(area);
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readStoredNumber(area: StorageArea, key: string, fallback = 0): number {
  const storage = storageFor(area);
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredNumber(area: StorageArea, key: string, value: number): boolean {
  const storage = storageFor(area);
  if (!storage) return false;
  try {
    storage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}
