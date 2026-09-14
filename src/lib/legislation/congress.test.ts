import { describe, it, expect } from "vitest";
import {
  chamberForBillType,
  billExternalId,
  billNumberLabel,
  billStatusFromLatestAction,
  rollCallExternalId,
  normalizeVotePosition,
  isAfterCursor,
  rollCallCursorKey,
  pickResultsArray,
  pickVoteMeta,
  findMemberVotes,
  readMemberVote,
} from "./congress";

describe("chamberForBillType", () => {
  it("routes House and Senate bill types", () => {
    expect(chamberForBillType("hr")).toBe("House");
    expect(chamberForBillType("HJRES")).toBe("House");
    expect(chamberForBillType("s")).toBe("Senate");
    expect(chamberForBillType("sconres")).toBe("Senate");
  });
  it("is empty for an unknown type", () => {
    expect(chamberForBillType("xyz")).toBe("");
  });
});

describe("billExternalId / billNumberLabel", () => {
  it("builds the idempotency key", () => {
    expect(billExternalId(119, "HR", 1234)).toBe("119-hr-1234");
  });
  it("formats a display label", () => {
    expect(billNumberLabel("hr", 1234)).toBe("H.R. 1234");
    expect(billNumberLabel("sjres", 7)).toBe("S.J.Res. 7");
  });
});

describe("billStatusFromLatestAction", () => {
  it("defaults to introduced when there is no action", () => {
    expect(billStatusFromLatestAction("")).toBe("introduced");
    expect(billStatusFromLatestAction(null)).toBe("introduced");
  });
  it("recognizes enactment even when earlier stages are mentioned", () => {
    expect(
      billStatusFromLatestAction("Passed House, Passed Senate. Became Public Law No: 118-1."),
    ).toBe("enacted");
  });
  it("recognizes a veto", () => {
    expect(billStatusFromLatestAction("Vetoed by President")).toBe("vetoed");
  });
  it("distinguishes one chamber from both", () => {
    expect(billStatusFromLatestAction("Passed House without objection")).toBe("passed_chamber");
    expect(billStatusFromLatestAction("Passed Senate. Passed House.")).toBe("passed_both_chambers");
  });
  it("maps committee referral and failure", () => {
    expect(billStatusFromLatestAction("Referred to the Committee on Finance.")).toBe("in_committee");
    expect(billStatusFromLatestAction("Motion to proceed rejected in Senate.")).toBe("failed");
  });
});

describe("rollCallExternalId", () => {
  it("keys by chamber, congress, session, number", () => {
    expect(rollCallExternalId("House", 119, 1, 45)).toBe("h119-1-45");
    expect(rollCallExternalId("Senate", 119, 2, 12)).toBe("s119-2-12");
  });
});

describe("normalizeVotePosition", () => {
  it("folds the many spellings", () => {
    expect(normalizeVotePosition("Aye")).toBe("yea");
    expect(normalizeVotePosition("Yea")).toBe("yea");
    expect(normalizeVotePosition("No")).toBe("nay");
    expect(normalizeVotePosition("Not Guilty")).toBe("nay");
    expect(normalizeVotePosition("Present")).toBe("present");
    expect(normalizeVotePosition("Not Voting")).toBe("absent");
  });
  it("treats the unknown as absent, not dropped", () => {
    expect(normalizeVotePosition("???")).toBe("absent");
    expect(normalizeVotePosition(undefined)).toBe("absent");
  });
});

describe("isAfterCursor", () => {
  it("passes everything when there is no cursor", () => {
    expect(isAfterCursor("2026-01-01", null)).toBe(true);
  });
  it("compares update dates lexically", () => {
    expect(isAfterCursor("2026-02-01", "2026-01-15")).toBe(true);
    expect(isAfterCursor("2026-01-01", "2026-01-15")).toBe(false);
  });
});

describe("rollCallCursorKey", () => {
  it("pads so keys sort lexically in roll-call order", () => {
    expect(rollCallCursorKey("House", 1, 45)).toBe("h-1-000045");
    expect(rollCallCursorKey("Senate", 2, 7)).toBe("s-2-000007");
    expect(rollCallCursorKey("House", 1, 9) < rollCallCursorKey("House", 1, 10)).toBe(true);
  });
});

describe("pickResultsArray", () => {
  it("returns an array payload as-is", () => {
    expect(pickResultsArray([1, 2])).toEqual([1, 2]);
  });
  it("digs out the first array-valued property", () => {
    expect(pickResultsArray({ pagination: {}, houseRollCallVotes: [{ a: 1 }] })).toEqual([
      { a: 1 },
    ]);
  });
  it("is empty for anything else", () => {
    expect(pickResultsArray(null)).toEqual([]);
    expect(pickResultsArray({ x: 1 })).toEqual([]);
  });
});

describe("pickVoteMeta", () => {
  it("digs out the object carrying rollCallNumber (with its voteQuestion)", () => {
    const membersPayload = {
      houseRollCallVoteMemberVotes: {
        rollCallNumber: 240,
        legislationType: "HR",
        legislationNumber: "3424",
        voteQuestion: "On Motion to Suspend the Rules and Pass",
        results: [{ bioguideID: "A000055", voteCast: "Yea" }],
      },
      request: {},
    };
    const meta = pickVoteMeta(membersPayload);
    expect(meta.voteQuestion).toBe("On Motion to Suspend the Rules and Pass");
    expect(meta.legislationNumber).toBe("3424");
  });
  it("returns an empty object when there's no vote meta", () => {
    expect(pickVoteMeta({ error: "x" })).toEqual({});
  });
});

describe("findMemberVotes / readMemberVote", () => {
  it("locates a nested member-vote array by its vote field", () => {
    const payload = {
      houseRollCallVoteMemberVotes: {
        results: [
          { bioguideID: "P000197", voteCast: "Yea", voteParty: "D" },
          { bioguideID: "M000355", voteCast: "Nay", voteParty: "R" },
        ],
      },
    };
    const rows = findMemberVotes(payload);
    expect(rows).toHaveLength(2);
    expect(readMemberVote(rows[0])).toEqual({
      bioguideId: "P000197",
      position: "Yea",
      party: "D",
    });
  });
  it("tolerates the Senate field-name variant", () => {
    expect(readMemberVote({ bioguideId: "S000148", vote: "Nay", party: "D" })).toEqual({
      bioguideId: "S000148",
      position: "Nay",
      party: "D",
    });
  });
  it("returns an empty array when nothing matches", () => {
    expect(findMemberVotes({ error: "not found" })).toEqual([]);
  });
});
