import { describe, expect, it } from "vitest";
import { clusterConflict, clusterPeople, parseName, stateCode } from "./duplicates.mjs";

describe("parseName", () => {
  it("normalizes order, suffixes, initials and nicknames", () => {
    expect(parseName("Joseph R Biden JR")).toMatchObject({ key: "joseph biden", middles: ["r"] });
    expect(parseName("BIDEN, JOSEPH R. JR.")).toMatchObject({ key: "joseph biden", middles: ["r"] });
    expect(parseName("Joe Biden").key).toBe("joseph biden");
    expect(parseName('Rafael Edward "Ted" Cruz').key).toBe("edward cruz");
    expect(parseName("Ted Cruz").key).toBe("edward cruz");
    expect(parseName("Madonna")).toBeNull();
  });
});

describe("stateCode", () => {
  it("reads codes, names and office titles", () => {
    expect(stateCode("tx")).toBe("TX");
    expect(stateCode("New Hampshire")).toBe("NH");
    expect(stateCode("Governor of Kentucky")).toBe("KY");
    expect(stateCode("US")).toBeNull();
  });
});

const rec = (id, name, states, extra = {}) => ({ id, name, states: new Set(states), ...extra });

describe("clusterPeople", () => {
  it("joins same-name records that share a state", () => {
    const clusters = clusterPeople([
      rec("a", "Andy Beshear", ["KY"], { openstates: "ocd-1" }),
      rec("b", "Andy Beshear", ["KY"]),
      rec("c", "Mike Rogers", ["MI"]),
      rec("d", "Mike Rogers", ["AL"], { bioguide: "R000575" }),
    ]);
    expect(clusters.map((c) => c.map((m) => m.id).sort())).toEqual([["a", "b"]]);
  });

  it("keeps apart names whose middle initials or generations differ", () => {
    expect(clusterPeople([rec("a", "John A. Smith", ["TX"]), rec("b", "John B. Smith", ["TX"])])).toEqual([]);
    expect(clusterPeople([rec("a", "Joseph P Kennedy II", ["MA"]), rec("b", "Joseph P. Kennedy III", ["MA"])])).toEqual([]);
    expect(clusterPeople([rec("a", "Donald M. Payne", ["NJ"]), rec("b", "Donald M. Payne, Jr.", ["NJ"])])).toHaveLength(1);
  });

  it("refuses clusters holding two members or two legislators", () => {
    const [cluster] = clusterPeople([
      rec("a", "John Smith", ["TX"], { openstates: "ocd-1" }),
      rec("b", "John Smith", ["TX"], { openstates: "ocd-2" }),
    ]);
    expect(clusterConflict(cluster)).toBe("2 different openstates ids");
  });

  it("joins a former member and a current official only through one Wikidata QID", () => {
    const owens = clusterPeople([
      rec("a", "Douglas Wayne Owens", ["UT"], { bioguide: "O000150", wikidata: "Q1" }),
      rec("b", "Doug Owens", ["UT"], { openstates: "ocd-1" }),
    ]);
    expect(clusterConflict(owens[0])).toBe("member and state legislator not linked by Wikidata");
    const walz = clusterPeople([
      rec("a", "Timothy J. Walz", ["MN"], { bioguide: "W000799", wikidata: "Q2" }),
      rec("b", "Tim Walz", ["MN"], { openstates: "ocd-2", wikidata: "Q2" }),
    ]);
    expect(clusterConflict(walz[0])).toBeNull();
    const governor = clusterPeople([
      rec("a", "Jared Polis", ["CO"], { bioguide: "P000598", wikidata: "Q3" }),
      rec("b", "Jared Polis", ["CO"], { openstates: "ocd-3", executive: true }),
    ]);
    expect(clusterConflict(governor[0])).toBeNull();
  });
});
