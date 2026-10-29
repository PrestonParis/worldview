import { describe, expect, it } from "vitest";
import { atlasTraditionHref } from "./tradition-link";

describe("atlasTraditionHref", () => {
  it("links main-catalog traditions directly", () => {
    expect(atlasTraditionHref("libertarianism")).toBe("/atlas/philosophies/libertarianism");
  });

  it("maps specialist traditions to their reference-page counterpart", () => {
    expect(atlasTraditionHref("liberal-constitutionalism")).toBe("/atlas/philosophies/modern-liberalism");
    expect(atlasTraditionHref("developmental-state")).toBe("/atlas/philosophies/developmentalism");
  });

  it("does not generate broken links for unmapped or missing traditions", () => {
    expect(atlasTraditionHref("economic-nationalism")).toBeNull();
    expect(atlasTraditionHref("conservatism")).toBeNull();
    expect(atlasTraditionHref("")).toBeNull();
  });
});
