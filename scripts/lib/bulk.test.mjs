import { describe, it, expect } from "vitest";
import { parseCsv, chunk, num, int } from "./bulk.mjs";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, embedded commas/newlines and CRLF", () => {
    const text = 'a,b,c\r\n1,"x, y","he said ""hi"""\r\n2,"line\nbreak",\r\n';
    expect(parseCsv(text)).toEqual([
      { a: "1", b: "x, y", c: 'he said "hi"' },
      { a: "2", b: "line\nbreak", c: "" },
    ]);
  });
  it("strips a BOM and tolerates no trailing newline", () => {
    expect(parseCsv("﻿id,v\n7,8")).toEqual([{ id: "7", v: "8" }]);
  });
});

describe("chunk / num / int", () => {
  it("chunks", () => expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]));
  it("parses numbers leniently", () => {
    expect(num("")).toBeNull();
    expect(num("1.5")).toBe(1.5);
    expect(int("7.9")).toBe(7);
    expect(num("NA")).toBeNull();
  });
});
