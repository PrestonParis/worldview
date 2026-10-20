import { afterEach, describe, expect, it, vi } from "vitest";
import { actionFailure, validationFailure } from "./result";

afterEach(() => vi.restoreAllMocks());

describe("action results", () => {
  it("keeps internal errors in server logs", () => {
    const error = new Error('duplicate key value violates unique constraint "private_index"');
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(actionFailure("records.create", error)).toEqual({
      ok: false,
      error: "That change could not be saved. Please try again.",
    });
    expect(logged).toHaveBeenCalledWith("[action:records.create]", error);
  });

  it("keeps validation feedback specific", () => {
    expect(validationFailure({ issues: [{ message: "A title is required." }] })).toEqual({
      ok: false,
      error: "A title is required.",
    });
  });
});
