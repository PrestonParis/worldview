import { describe, expect, it } from "vitest";
import { possessive, sexOf } from "./profile-view";
import type { ProfileBundle } from "../db/profile-records";

const bundle = (facts: { key: string; value: string }[], traits: { trait: string; value: string }[] = []) =>
  ({ facts, traits }) as unknown as ProfileBundle;

describe("sexOf", () => {
  it("reads the dossier fact first, then the Wikidata trait", () => {
    expect(sexOf(bundle([{ key: "sex", value: "Male" }], [{ trait: "sex", value: "female" }]))).toBe("male");
    expect(sexOf(bundle([], [{ trait: "sex", value: "female" }]))).toBe("female");
  });

  it("gives no pronoun without a male or female record", () => {
    expect(possessive(bundle([]))).toBeNull();
    expect(possessive(bundle([], [{ trait: "sex", value: "nonbinary" }]))).toBeNull();
    expect(possessive(bundle([{ key: "sex", value: "Female" }]))).toBe("her");
  });
});
