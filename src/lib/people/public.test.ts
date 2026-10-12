import { describe, expect, it } from "vitest";
import { parseEntityMetadata, publicEntitySlug, slugifyEntityName } from "./public";

describe("public people helpers", () => {
  it("builds stable readable profile slugs", () => {
    expect(publicEntitySlug({ id: "86f35abc-1234-5678-9abc-def012345678", name: "Matt Walsh" }))
      .toBe("matt-walsh-86f35abc");
  });

  it("normalizes punctuation and accents", () => {
    expect(slugifyEntityName("Angus S., Jr. King")).toBe("angus-s-jr-king");
    expect(slugifyEntityName("José Muñoz")).toBe("jose-munoz");
  });

  it("treats invalid metadata as empty", () => {
    expect(parseEntityMetadata("not-json")).toEqual({});
  });
});
