import { describe, expect, it } from "vitest";
import { titleCase } from "./names.mjs";

describe("titleCase", () => {
  it("title-cases FEC committee names and keeps acronyms readable", () => {
    expect(titleCase("PROTECT OHIO VALUES PAC (POV PAC)")).toBe("Protect Ohio Values PAC (POV PAC)");
    expect(titleCase("MCCARTHY VICTORY FUND")).toBe("McCarthy Victory Fund");
    expect(titleCase("ROMNEY FOR PRESIDENT INC.")).toBe("Romney for President Inc.");
    expect(titleCase("OHIOANS FOR JD")).toBe("Ohioans for JD");
  });
});
