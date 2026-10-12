import { describe, expect, it } from "vitest";
import { candidateIdentityKey, normalizeCandidateName, normalizePartyName } from "./display";

describe("election display normalization", () => {
  it.each([
    ["REAGAN BOX", "Reagan Box"],
    ['Earl L. "Buddy" Carter', "Buddy Carter"],
    ["COYNE, JOHN F III", "John F. Coyne III"],
    ["JOHN KING", "John King"],
    ["OSSOFF, T. JONATHAN", "Jon Ossoff"],
    ["COLLINS, MICHAEL A JR", "Mike Collins"],
  ])("normalizes %s", (raw, expected) => expect(normalizeCandidateName(raw)).toBe(expected));

  it("creates a stable first and last name key", () => {
    expect(candidateIdentityKey("OSSOFF, T. JONATHAN")).toBe("jon ossoff");
    expect(candidateIdentityKey("Jon Ossoff")).toBe("jon ossoff");
  });

  it("normalizes major-party labels", () => {
    expect(normalizePartyName("DEMOCRATIC PARTY")).toBe("Democratic");
    expect(normalizePartyName("Republican")).toBe("Republican");
  });
});
