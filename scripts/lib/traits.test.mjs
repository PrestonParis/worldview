import { describe, it, expect } from "vitest";
import {
  ancestryFromCategory,
  ancestryFromEthnicGroup,
  plausiblePerson,
  raceFromCategory,
  raceFromEthnicGroup,
  religionFromCategory,
  religionFromWikidata,
  settleReligions,
  sexFromWikidata,
} from "./traits.mjs";

describe("raceFromCategory", () => {
  it("files people under the group a category names them by", () => {
    expect(raceFromCategory("21st-century African-American politicians")).toBe("black");
    expect(raceFromCategory("Hispanic and Latino American members of the United States Congress")).toBe("hispanic");
    expect(raceFromCategory("Asian-American journalists")).toBe("asian");
    expect(raceFromCategory("Native American members of the United States House of Representatives")).toBe("native");
  });

  it("ignores categories about work on a group's behalf", () => {
    expect(raceFromCategory("Activists for African-American civil rights")).toBeNull();
    expect(raceFromCategory("African-American studies scholars")).toBeNull();
    expect(raceFromCategory("Native American rights activists")).toBeNull();
    expect(raceFromCategory("Asian-American and Pacific Islander state legislators in Hawaii")).toBeNull();
  });
});

describe("raceFromEthnicGroup", () => {
  it("maps Wikidata ethnic groups to Census groups", () => {
    expect(raceFromEthnicGroup("African Americans")).toBe("black");
    expect(raceFromEthnicGroup("Mexican Americans")).toBe("hispanic");
    expect(raceFromEthnicGroup("Indian Americans")).toBe("asian");
    expect(raceFromEthnicGroup("Irish Americans")).toBeNull();
  });
});

describe("ancestry", () => {
  it("reads descent categories", () => {
    expect(ancestryFromCategory("American people of Irish descent")).toEqual(["Irish"]);
    expect(ancestryFromCategory("American people of Polish-Jewish descent")).toEqual(["Polish", "Jewish"]);
    expect(ancestryFromCategory("American politicians")).toEqual([]);
  });

  it("reads ancestry ethnic groups but leaves Census groups to race", () => {
    expect(ancestryFromEthnicGroup("Irish Americans")).toBe("Irish");
    expect(ancestryFromEthnicGroup("American Jews")).toBe("Jewish");
    expect(ancestryFromEthnicGroup("Mexican Americans")).toBeNull();
  });
});

describe("religion", () => {
  it("reads self-identification categories", () => {
    expect(religionFromCategory("American Roman Catholics")).toBe("catholic");
    expect(religionFromCategory("Southern Baptists")).toBe("protestant");
    expect(religionFromCategory("Baptists from Texas")).toBe("protestant");
    expect(religionFromCategory("American Episcopalians")).toBe("protestant");
    expect(religionFromCategory("Latter Day Saints from Utah")).toBe("lds");
    expect(religionFromCategory("American Reform Jews")).toBe("jewish");
    expect(religionFromCategory("African-American Muslims")).toBe("muslim");
    expect(religionFromCategory("American atheists")).toBe("unaffiliated");
  });

  it("skips former faiths, institutions and religious work", () => {
    expect(religionFromCategory("Former Roman Catholics")).toBeNull();
    expect(religionFromCategory("Catholic University of America alumni")).toBeNull();
    expect(religionFromCategory("Critics of Islam")).toBeNull();
    expect(religionFromCategory("American Roman Catholic priests")).toBeNull();
    expect(religionFromCategory("Jewish American journalists")).toBeNull();
  });

  it("groups Wikidata religions the way Pew does", () => {
    expect(religionFromWikidata("Catholic Church")).toBe("catholic");
    expect(religionFromWikidata("Southern Baptist Convention")).toBe("protestant");
    expect(religionFromWikidata("The Church of Jesus Christ of Latter-day Saints")).toBe("lds");
    expect(religionFromWikidata("Greek Orthodox Church")).toBe("orthodox");
    expect(religionFromWikidata("Reform Judaism")).toBe("jewish");
    expect(religionFromWikidata("atheism")).toBe("unaffiliated");
    expect(religionFromWikidata("Christianity")).toBe("christian");
  });

  it("drops generic Christian when a tradition is known", () => {
    expect(settleReligions(["christian", "catholic"])).toEqual(["catholic"]);
    expect(settleReligions(["christian"])).toEqual(["christian"]);
  });
});

describe("sexFromWikidata", () => {
  it("maps sex or gender statements", () => {
    expect(sexFromWikidata("female")).toBe("female");
    expect(sexFromWikidata("trans woman")).toBe("female");
    expect(sexFromWikidata("non-binary")).toBe("nonbinary");
  });
});

describe("plausiblePerson", () => {
  it("accepts a match whose description names media work", () => {
    expect(plausiblePerson("American political commentator", "American political commentator and podcaster")).toBe(true);
  });

  it("rejects namesakes and nationality mismatches", () => {
    expect(plausiblePerson("American comedian and podcaster", "English footballer")).toBe(false);
    expect(plausiblePerson("American journalist", "British journalist")).toBe(false);
  });
});
