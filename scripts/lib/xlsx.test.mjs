import { describe, expect, it } from "vitest";
import { columnIndex, parseSheetXml } from "./xlsx.mjs";

describe("xlsx reader", () => {
  it("maps column letters to indexes", () => {
    expect(columnIndex("A1")).toBe(0);
    expect(columnIndex("Z9")).toBe(25);
    expect(columnIndex("AA3")).toBe(26);
    expect(columnIndex("BC12")).toBe(54);
  });

  it("reads shared, inline, formula, and sparse cells", () => {
    const xml = `<sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>1820</v></c></row>
      <row r="3"><c r="B3" t="inlineStr"><is><t>Total &amp; more</t></is></c><c r="C3"><f>SUM(A1)</f><v>8390</v></c><c r="D3" t="str"><f>A1</f><v>NA</v></c></row>
    </sheetData>`;
    expect(parseSheetXml(xml, ["Year"])).toEqual([
      ["Year", null, 1820],
      [],
      [null, "Total & more", 8390, "NA"],
    ]);
  });
});
