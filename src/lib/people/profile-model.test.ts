import { describe, expect, it } from "vitest";
import {
  chapterCitations,
  formatPartialDate,
  givingEvents,
  highlightEvents,
  parseChapterBody,
  parseEditorial,
  spanLabel,
  summarizeGiving,
  type ContributionRecord,
} from "./profile-model";
import { recipientKindOf } from "../money/recipient-kinds";

const gift = (over: Partial<ContributionRecord>): ContributionRecord => ({
  id: Math.random().toString(36),
  donorEntityId: "donor",
  recipientEntityId: "pac",
  amount: 1000,
  date: "2022-04-01",
  cycle: 2022,
  kind: "super_pac",
  party: "",
  committeeId: "C1",
  receiptType: "10",
  memo: false,
  sourceId: "fec",
  matchBasis: "employer",
  ...over,
});

describe("parseChapterBody", () => {
  it("splits paragraphs and quotations and lifts citations out of the text", () => {
    const blocks = parseChapterBody("He wrote it [[a]].\n\n> A quoted line. [[b, c]]\n\nNo citation here.");
    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "quote", "paragraph"]);
    expect(blocks[0].segments).toEqual([{ text: "He wrote it" }, { cite: ["a"] }, { text: "." }]);
    expect(blocks[1].segments).toEqual([{ text: "A quoted line." }, { cite: ["b", "c"] }]);
    expect(blocks[2].segments).toEqual([{ text: "No citation here." }]);
  });

  it("lists every cited key once, in order", () => {
    expect(chapterCitations("x [[b]] y [[a, b]] z [[c]]")).toEqual(["b", "a", "c"]);
  });
});

describe("summarizeGiving", () => {
  it("never counts FEC memo lines", () => {
    const summary = summarizeGiving([
      gift({ amount: 250_000, kind: "joint_fundraising", recipientEntityId: "jfc" }),
      // The joint committee's allocation of the same money to the RNC.
      gift({ amount: 100_000, kind: "party", recipientEntityId: "rnc", memo: true }),
    ]);
    expect(summary.total).toBe(250_000);
    expect(summary.count).toBe(1);
    expect(summary.memoLines).toBe(1);
    expect(summary.byRecipient.map((r) => r.entityId)).toEqual(["jfc"]);
  });

  it("separates candidate gifts from committee gifts and only splits party where FEC records one", () => {
    const summary = summarizeGiving([
      gift({ amount: 10_000_000 }),
      gift({ amount: 2_900, kind: "candidate", party: "REP", recipientEntityId: "c1", cycle: 2020, date: "2019-05-01" }),
      gift({ amount: 2_700, kind: "candidate", party: "DEM", recipientEntityId: "c2", cycle: 2016, date: "2016-06-20" }),
    ]);
    expect(summary.candidateTotal).toBe(5_600);
    expect(summary.committeeTotal).toBe(10_000_000);
    expect(summary.byParty).toEqual([
      { party: "Republican", total: 2_900 },
      { party: "Democratic", total: 2_700 },
    ]);
    expect(summary.byCycle.map((c) => c.cycle)).toEqual([2016, 2020, 2022]);
    expect(summary.first).toBe("2016-06-20");
  });
});

describe("givingEvents", () => {
  it("makes one timeline event per recipient and cycle from the rows themselves", () => {
    const events = givingEvents(
      [
        gift({ amount: 10_000_000, date: "2021-03-12" }),
        gift({ amount: 5_000_000, date: "2022-04-18" }),
        gift({ amount: 900_000, recipientEntityId: "small" }),
        gift({ amount: 3_000_000, memo: true, recipientEntityId: "memo" }),
      ],
      new Map([["pac", "Protect Ohio Values PAC"]]),
      "donor",
    );
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Gives $15 million to Protect Ohio Values PAC");
    expect(events[0].dateStart).toBe("2021-03-12");
    expect(events[0].dateEnd).toBe("2022-04-18");
    expect(events[0].significance).toBe(3);
  });
});

describe("dates", () => {
  it("formats partial dates at their own precision", () => {
    expect(formatPartialDate("2004")).toBe("2004");
    expect(formatPartialDate("2004-08")).toBe("Aug. 2004");
    expect(formatPartialDate("2016-07-21")).toBe("July 21, 2016");
    expect(spanLabel("2003", "")).toBe("2003–present");
    expect(spanLabel("2016", "2016")).toBe("2016");
  });

  it("turns dated highlights into unsourced timeline entries", () => {
    const events = highlightEvents(["1998 — Co-founds Confinity", "No date here", "2002-10 – Sold to eBay"], "x");
    expect(events.map((e) => [e.dateStart, e.title, e.derivedFrom])).toEqual([
      ["1998", "Co-founds Confinity", "highlights"],
      ["2002-10", "Sold to eBay", "highlights"],
    ]);
  });
});

describe("parseEditorial", () => {
  it("drops malformed entries instead of rendering them", () => {
    const editorial = parseEditorial({
      summary: "s",
      roles: [{ label: "Investor", sources: ["a", 3] }, { detail: "no label" }],
      chapters: [{ key: "k", title: "T", body: "B" }, { key: "empty" }],
      ideas: { traditions: [{ label: "Libertarianism", atlasId: "libertarianism" }], featuredQuotes: ["q1", 7] },
      coverage: null,
      editorialReviewedAt: "2026-10-20",
      sourcesVerifiedAt: null,
    });
    expect(editorial.roles).toEqual([{ label: "Investor", detail: "", sources: ["a"] }]);
    expect(editorial.chapters.map((c) => c.key)).toEqual(["k"]);
    expect(editorial.ideas.featuredQuotes).toEqual(["q1"]);
    expect(editorial.sourcesVerifiedAt).toBe("");
  });
});

describe("recipientKindOf", () => {
  it("classifies FEC committees by type and designation", () => {
    expect(recipientKindOf("S", "P")).toBe("candidate");
    expect(recipientKindOf("Y", "U")).toBe("party");
    expect(recipientKindOf("O", "U")).toBe("super_pac");
    expect(recipientKindOf("V", "U")).toBe("hybrid_pac");
    expect(recipientKindOf("N", "J")).toBe("joint_fundraising");
    expect(recipientKindOf("Q", "B")).toBe("pac");
    expect(recipientKindOf(null, null)).toBe("other");
  });
});
