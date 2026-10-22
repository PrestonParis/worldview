import { describe, expect, it } from "vitest";
import { buildSpectrum, parseRowKey, spectrumRowOf } from "./spectrum";
import type { Entity } from "../validation/entity";

function entity(id: string, type: string, name: string, metadata: Record<string, unknown> = {}, extra: Partial<Entity> = {}): Entity {
  return {
    id, type, name, description: "", biography: "", imageUrl: "", websiteUrl: "", xUrl: "", facebookUrl: "",
    instagramUrl: "", youtubeUrl: "", linkedinUrl: "", highlights: "", metadata: JSON.stringify(metadata),
    bioguideId: "", createdAt: "", updatedAt: "", ...extra,
  } as Entity;
}

describe("spectrumRowOf", () => {
  it("sorts entities into the spectrum's groups", () => {
    expect(spectrumRowOf(entity("1", "politician", "Pete Hegseth", { branch: "executive", office: "Secretary of Defense" }))).toBe("executive");
    expect(spectrumRowOf(entity("1b", "politician", "A Senator Turned Secretary", { branch: "executive", party: "R" }, { bioguideId: "X000002" }))).toBe("executive");
    expect(spectrumRowOf(entity("1c", "judge", "A Justice", { office: "Associate Justice of the Supreme Court" }))).toBe("court");
    expect(spectrumRowOf(entity("2", "politician", "A Legislator", { source: "openstates", party: "Democratic" }))).toBe("state");
    expect(spectrumRowOf(entity("3", "pundit", "Ben Shapiro"))).toBe("pundit");
    expect(spectrumRowOf(entity("4", "organization", "The Heritage Foundation"))).toBe("outlets");
    expect(spectrumRowOf(entity("5", "organization", "Some PAC", { lean: "liberal", leanBasis: "…" }))).toBe("money");
    expect(spectrumRowOf(entity("6", "donor", "Elon Musk"))).toBe("donors");
  });

  it("leaves Congress, FEC-scraped donors and unplaced institutions to the attribute explorer", () => {
    expect(spectrumRowOf(entity("7", "politician", "A Member", { party: "R" }, { bioguideId: "X000001" }))).toBeNull();
    expect(spectrumRowOf(entity("8", "donor", "DOE, JANE", { importedFrom: "openfec-schedule_a" }))).toBeNull();
    expect(spectrumRowOf(entity("9", "organization", "Stanford University"))).toBeNull();
  });
});

describe("parseRowKey", () => {
  it("maps the old administration row to the executive row", () => {
    expect(parseRowKey("administration")).toBe("executive");
    expect(parseRowKey("court")).toBe("court");
    expect(parseRowKey("nope")).toBeUndefined();
  });
});

describe("buildSpectrum", () => {
  it("splits the Court by the appointing president's party", () => {
    const rows = buildSpectrum(
      [
        entity("j1", "judge", "Justice R", { office: "Associate Justice of the Supreme Court", appointingParty: "Republican" }),
        entity("j2", "judge", "Justice D", { office: "Associate Justice of the Supreme Court", appointingParty: "Democrat" }),
      ],
      null,
    );
    expect(rows.find((row) => row.key === "court")).toMatchObject({ counts: { liberal: 1, conservative: 1, unplaced: 0 } });
  });

  it("counts each side and leads with Congress", () => {
    const rows = buildSpectrum(
      [entity("a", "pundit", "Ben Shapiro"), entity("b", "pundit", "Sam Seder"), entity("c", "pundit", "Lex Fridman")],
      [
        { key: "1", name: "D", party: "D", chamber: "House", seat: "CA-1", score: -0.4, href: null, imageUrl: null },
        { key: "2", name: "R", party: "R", chamber: "House", seat: "TX-1", score: 0.5, href: null, imageUrl: null },
      ],
    );
    expect(rows[0]).toMatchObject({ key: "congress", counts: { liberal: 1, conservative: 1, unplaced: 0 } });
    const pundits = rows.find((row) => row.key === "pundit")!;
    expect(pundits.counts).toEqual({ liberal: 1, conservative: 1, unplaced: 1 });
    expect(pundits.items.map((item) => item.name)).toEqual(["Ben Shapiro", "Lex Fridman", "Sam Seder"]);
  });
});
