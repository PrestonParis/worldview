import { describe, expect, it } from "vitest";
import { daysUntilElection, federalGeneralElectionDate, validateFederalElectionDate } from "./dates";

describe("federal election dates", () => {
  it("computes the Tuesday after the first Monday", () => {
    expect(federalGeneralElectionDate(2024)).toBe("2024-11-05");
    expect(federalGeneralElectionDate(2026)).toBe("2026-11-03");
    expect(federalGeneralElectionDate(2028)).toBe("2028-11-07");
  });

  it("rejects a wrong federal general election date", () => {
    expect(validateFederalElectionDate({ level: "federal", electionType: "general", electionDate: "2026-11-02" })).toContain("2026-11-03");
    expect(validateFederalElectionDate({ level: "federal", electionType: "general", electionDate: "2026-11-03" })).toBeNull();
  });

  it("counts calendar days in UTC", () => {
    expect(daysUntilElection("2026-11-03", new Date("2026-10-08T20:00:00Z"))).toBe(26);
  });
});
