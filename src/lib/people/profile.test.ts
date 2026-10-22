import { describe, expect, it } from "vitest";
import { ageOnDate, editorialProfile } from "./profile";

describe("ageOnDate", () => {
  it("changes age on the birthday", () => {
    expect(ageOnDate("1967-10-11", new Date("2026-10-10T12:00:00Z"))).toBe(58);
    expect(ageOnDate("1967-10-11", new Date("2026-10-11T12:00:00Z"))).toBe(59);
  });
});

describe("editorialProfile", () => {
  it("rejects malformed facts and unsafe citations", () => {
    const profile = editorialProfile({
      metadata: JSON.stringify({
        profile: {
          facts: [
            { key: "born", label: "Born", value: "1967", source: { label: "Source", url: "https://example.com" } },
            { label: "Missing key", value: "ignored" },
          ],
          sections: [{ heading: "Career", body: "Text", sources: [{ label: "Bad", url: "javascript:alert(1)" }] }],
        },
      }),
    });
    expect(profile?.facts).toHaveLength(1);
    expect(profile?.facts[0].source?.url).toBe("https://example.com");
    expect(profile?.sections[0].sources).toEqual([]);
  });
});
