import { afterEach, describe, expect, it, vi } from "vitest";
import { parseStoredJson, readStoredNumber } from "./storage";

describe("browser storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("treats malformed JSON as missing instead of throwing", () => {
    expect(parseStoredJson("{")).toBeNull();
    expect(parseStoredJson(null)).toBeNull();
  });

  it("parses valid JSON without asserting its domain type", () => {
    expect(parseStoredJson('{"version":1}')).toEqual({ version: 1 });
  });

  it("uses a fallback when browser storage is unavailable", () => {
    expect(readStoredNumber("session", "missing", 7)).toBe(7);
  });

  it("uses the requested fallback when a numeric key is absent", () => {
    const storage = { getItem: vi.fn(() => null) };
    vi.stubGlobal("window", { localStorage: storage, sessionStorage: storage });

    expect(readStoredNumber("local", "missing", 7)).toBe(7);
  });
});
