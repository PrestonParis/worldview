import { describe, expect, it } from "vitest";
import {
  contestDistrict,
  lastNamesAgree,
  matchCandidate,
  normalizeDistrict,
  officeFamily,
  parseBallotName,
  parseRegistryName,
  type MatchTarget,
  type Registration,
} from "./candidates";

describe("office families", () => {
  it("reads SOS contest names and registry labels alike", () => {
    const pairs: [string, string][] = [
      ["State House of Representatives - District 56", "State Representative"],
      ["State Senate - District 7", "State Senator"],
      ["County Commission - District 2", "County Commissioner"],
      ["County BOE - Post 3", "School Board Member"],
      ["Board of Education District 3", "School Board Member"],
      ["Lieutenant Governor", "Lieutenant Governor"],
      ["PSC - District 3", "Public Service Commissioner"],
      ["County Commission Chairman", "County Commission - Chair"],
      ["US Senate", "U.S. Senate"],
    ];
    for (const [ballot, registry] of pairs) {
      expect(officeFamily(ballot), ballot).not.toBeNull();
      expect(officeFamily(ballot), ballot).toBe(officeFamily(registry));
    }
    expect(officeFamily("Governor")).toBe("governor");
    expect(officeFamily("Clerk of Superior Court")).toBe("clerk");
    expect(officeFamily("Tax Commissioner")).toBe("tax_commissioner");
    expect(officeFamily("Commissioner of Insurance")).toBe("insurance");
    expect(officeFamily("Spec Alapaha City Council - Post 4")).toBe("city_council");
  });

  it("normalizes districts written three ways", () => {
    expect(contestDistrict("State House District 56")).toBe("56");
    expect(contestDistrict("State Representative District 056")).toBe("56");
    expect(contestDistrict("GA HOUSE 56")).toBe("56");
    expect(officeFamily("GA HOUSE 56")).toBe("state_house");
    expect(contestDistrict("HD 56")).toBe("56");
    expect(normalizeDistrict("056")).toBe("56");
    expect(normalizeDistrict("1-B")).toBe("1B");
    expect(normalizeDistrict(null)).toBeNull();
  });
});

describe("circuits", () => {
  it("reads the circuit from contest names and registry jurisdictions", async () => {
    const { circuitOf } = await import("./candidates");
    expect(circuitOf("District Attorney - Enotah Judicial Circuit")).toBe("enotah");
    expect(circuitOf("Superior Court Judge - Lookout Mountain Judicial Circuit")).toBe("lookout mountain");
    expect(circuitOf("Atlantic")).toBe("atlantic");
  });
});

describe("names", () => {
  it("parses ballot and registry orders", () => {
    expect(parseBallotName("Nathaniel Hicks Jr.")).toEqual({ last: "hicks", givens: ["nathaniel"] });
    expect(parseBallotName('Rebecca "Becky" Jackson')).toEqual({ last: "jackson", givens: ["rebecca", "becky"] });
    expect(parseRegistryName("Jackson, Rebecca (Becky) L.")).toEqual({ last: "jackson", givens: ["rebecca", "l", "becky"] });
    expect(parseRegistryName("OSSOFF, T. JONATHAN")).toEqual({ last: "ossoff", givens: ["t", "jonathan"] });
    expect(parseRegistryName("COLLINS, MICHAEL A JR")).toEqual({ last: "collins", givens: ["michael", "a"] });
  });

  it("agrees on compound last names", () => {
    expect(lastNamesAgree("bottoms", "lance bottoms")).toBe(true);
    expect(lastNamesAgree("smith-jones", "jones")).toBe(true);
    expect(lastNamesAgree("jackson", "johnson")).toBe(false);
  });
});

describe("matchCandidate", () => {
  const reg = (id: string, name: string, extra: Partial<Registration> = {}): Registration => ({
    id,
    names: [parseRegistryName(name)],
    officeFamily: "state_house",
    district: "56",
    jurisdiction: null,
    active: true,
    ...extra,
  });
  const hd56: MatchTarget = { name: "", officeFamily: "state_house", district: "56", counties: [], municipality: null, local: false };

  it("verifies on office, district and full name", () => {
    const r = matchCandidate({ ...hd56, name: "Mike Collins" }, [reg("a", "Collins, Michael A"), reg("b", "Smith, Ann")]);
    expect(r).toMatchObject({ kind: "verified", registrationId: "a" });
  });

  it("never matches across districts", () => {
    const r = matchCandidate({ ...hd56, name: "Mike Collins" }, [reg("a", "Collins, Michael", { district: "57" })]);
    expect(r.kind).toBe("none");
  });

  it("calls a unique last name with a different given name probable", () => {
    const r = matchCandidate({ ...hd56, name: "Mo Ivory" }, [reg("a", "Ivory, Noraima")]);
    expect(r).toMatchObject({ kind: "probable", registrationId: "a" });
  });

  it("uses the filed ballot name", () => {
    const r = matchCandidate({ ...hd56, name: "Mo Ivory" }, [{ ...reg("a", "Ivory, Noraima"), names: [parseRegistryName("Ivory, Noraima"), parseRegistryName("Ivory, Mo")] }]);
    expect(r).toMatchObject({ kind: "verified", registrationId: "a" });
  });

  it("refuses two different people with one last name", () => {
    const r = matchCandidate({ ...hd56, name: "Pat Jones" }, [reg("a", "Jones, Robert"), reg("b", "Jones, Linda")]);
    expect(r).toEqual({ kind: "ambiguous", count: 2 });
  });

  it("collapses one person's two registrations and prefers the active one", () => {
    const r = matchCandidate({ ...hd56, name: "Ann Smith" }, [reg("old", "Smith, Ann", { active: false }), reg("new", "Smith, Ann B.")]);
    expect(r).toMatchObject({ kind: "verified", registrationId: "new" });
  });

  it("requires the county for local offices", () => {
    const target: MatchTarget = { name: "Andrea Smith", officeFamily: "county_commission", district: "3", counties: ["DeKalb County"], municipality: null, local: true };
    const dekalb = reg("a", "Smith, Andrea B.", { officeFamily: "county_commission", district: "3", jurisdiction: "DeKalb" });
    const fulton = reg("b", "Smith, Andrea", { officeFamily: "county_commission", district: "3", jurisdiction: "Fulton" });
    expect(matchCandidate(target, [fulton, dekalb])).toMatchObject({ kind: "verified", registrationId: "a" });
    expect(matchCandidate(target, [fulton]).kind).toBe("none");
  });

  it("reads a consolidated government as its county", () => {
    const target: MatchTarget = { name: "Ann Lee", officeFamily: "city_council", district: "5", counties: ["Bibb County"], municipality: null, local: true };
    const r = matchCandidate(target, [reg("a", "Lee, Ann", { officeFamily: "city_council", district: "5", jurisdiction: "Macon-Bibb (Cons. Gov.)" })]);
    expect(r).toMatchObject({ kind: "verified", registrationId: "a" });
  });

  it("downgrades a full-name match when the registration has no district", () => {
    const r = matchCandidate({ ...hd56, name: "Ann Smith" }, [reg("a", "Smith, Ann", { district: null })]);
    expect(r.kind).toBe("probable");
  });
});
