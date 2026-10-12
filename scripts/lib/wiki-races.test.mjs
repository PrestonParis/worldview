import { describe, expect, it } from "vitest";
import {
  parseCandidates,
  parseIncumbent,
  parseRaceRow,
  parseRating,
  parseRatingsTable,
  raceKeyFromCell,
  tableRows,
} from "./wiki-races.mjs";

const ABBR = { Georgia: "GA", Maine: "ME", Ohio: "OH", Alabama: "AL", Alaska: "AK", Colorado: "CO" };

const SENATE_SUMMARY = `{| class="wikitable sortable"
|- valign=bottom
! colspan=2 | Constituency
|-
! [[2026 United States Senate election in Maine|Maine]]
| {{Shading PVI|D|4}}
| {{sortname|Susan|Collins}}
| {{Party shading/Republican}} | Republican
| data-sort-value=1996 | [[1996 United States Senate election in Maine|1996]]
| {{Party shading/Republican}} data-sort-value=51.0 | 51.0% R
| data-sort-value=0 | Incumbent renominated
| nowrap | {{Plainlist | 
*{{Party stripe|Republican Party (US)}}[[Susan Collins]] (Republican)<ref name="ME2026">{{#invoke:cite|web|title=x}}</ref>
*{{Party stripe|Democratic Party (United States)}}[[Troy Jackson]] (Democratic)<ref name="ConvResultUsaToday" />
}}

|-
! [[2026 United States Senate election in Alaska|Alaska]]
| {{Shading PVI|R|6}}
| {{sortname|Dan|Sullivan|dab=U.S. senator}}
| {{Party shading/Republican}} | Republican
| data-sort-value=1 | Incumbent advanced to general
| nowrap | {{Plainlist | 
*{{Party stripe|Democratic Party (US)}}[[Mary Peltola]] (Democratic)<ref name="AK2026" />
*{{Party stripe|Republican Party (US)}}Dan J. Sullivan (Republican)
*{{Party stripe|Republican Party (US)}}[[Dan Sullivan (U.S. senator)|Dan S. Sullivan]] (Republican)<ref name="AK2026">{{#invoke:cite|web}}</ref>
}}
`;

const HOUSE_SECTION = `{|class="wikitable sortable"
|-
!colspan=2 |District
|-
!{{ushr|CO|1|X}}
|{{shading PVI|D|29}}
|{{sortname|Diana|DeGette}}
|style="color:black;background-color:#B0CEFF" |Democratic
|[[1996 United States House of Representatives elections in Colorado|1996]]
|style="background:#DDDDDD" |Incumbent lost renomination
|nowrap |{{plainlist}}
**{{Party stripe|Independent}}Shimon Blau (Independent)
*{{Party stripe|Democratic Party (US)}}[[Melat Kiros]] (Democratic)
*{{Party stripe|Republican Party (US)}}Christy Peterson (Republican)
{{endplainlist}}
`;

const PREDICTIONS = `{| class="wikitable sortable"
|- style="vertical-align:bottom"
! colspan=2 | Constituency
|- style="vertical-align:bottom"
! State
! [[Cook Partisan Voting Index|PVI]]<ref name="PVI" />
! Senator
! Last election
! ''[[The Cook Political Report|Cook]]''<br />{{small|Sep 23,<br />2026}}<ref>{{Cite web |title=x}}</ref>
! [[Decision Desk HQ|DDHQ]]<br />{{small|Oct 5,<br/>2026}}
! ''[[Inside Elections|IE]]''<br />{{small|Oct 1,<br />2026}}<ref>{{Cite web |title=Senate Ratings}}</ref>
! [[Sabato's Crystal Ball|Sabato]]<br />{{small|Oct 6,<br />2026}}
|-
! [[2026 United States Senate election in Georgia|Georgia]]
| {{Shading PVI|R|1}}
| {{Party shading/Democratic}} | {{sortname|Jon|Ossoff}}
| {{Party shading/Democratic}} data-sort-value="-50.62" | 50.62% D
<!--Cook-->      | {{USRaceRating|Likely|D}}
<!--DDHQ-->      | {{USRaceRating|Safe|D}}
<!--IE-->        | {{USRaceRating|Lean|D}}
<!--Sabato-->    | {{USRaceRating|Likely|D}}
`;

describe("wikipedia race parsing", () => {
  it("keys races by state, special and district", () => {
    expect(raceKeyFromCell(" [[2026 United States Senate election in Georgia|Georgia]]", ABBR)).toBe("GA");
    expect(raceKeyFromCell(" [[2026 United States Senate special election in Ohio|Ohio]] {{small|(special)}}", ABBR)).toBe("OH:special");
    expect(raceKeyFromCell("{{ushr|CO|1|X}}", ABBR)).toBe("CO-01");
    expect(raceKeyFromCell("{{ushr|AK|AL|X}}", ABBR)).toBe("AK-AL");
    expect(raceKeyFromCell("[[2026 Alabama gubernatorial election|Alabama]]", ABBR)).toBe("AL");
  });

  it("reads candidates and their parties", () => {
    const [maine, alaska] = tableRows(SENATE_SUMMARY).map((cells) => parseRaceRow(cells, ABBR)).filter(Boolean);
    expect(maine.key).toBe("ME");
    expect(maine.incumbent).toEqual({ name: "Susan Collins", link: "Susan Collins" });
    expect(maine.status).toBe("Incumbent renominated");
    expect(maine.candidates).toEqual([
      { name: "Susan Collins", party: "Republican", link: "Susan Collins" },
      { name: "Troy Jackson", party: "Democratic", link: "Troy Jackson" },
    ]);
    // Two candidates share a name; the wiki link tells the senator apart.
    expect(alaska.incumbent.link).toBe("Dan Sullivan (U.S. senator)");
    expect(alaska.candidates.map((c) => c.link)).toEqual(["Mary Peltola", null, "Dan Sullivan (U.S. senator)"]);
  });

  it("reads House district rows", () => {
    const [co1] = tableRows(HOUSE_SECTION).map((cells) => parseRaceRow(cells, ABBR)).filter(Boolean);
    expect(co1.key).toBe("CO-01");
    expect(co1.status).toBe("Incumbent lost renomination");
    expect(co1.candidates.map((c) => `${c.name} (${c.party})`)).toEqual([
      "Shimon Blau (Independent)",
      "Melat Kiros (Democratic)",
      "Christy Peterson (Republican)",
    ]);
    expect(parseIncumbent("{{sortname|Diana|DeGette}}").name).toBe("Diana DeGette");
  });

  it("maps rating templates", () => {
    expect(parseRating("{{USRaceRating|Lean|R|Flip}}")).toBe("lean_r");
    expect(parseRating("{{USRaceRating|Solid|D}}")).toBe("safe_d");
    expect(parseRating("{{USRaceRating|Tilt|D}}")).toBe("lean_d");
    expect(parseRating("{{USRaceRating|Tossup}}")).toBe("tossup");
  });

  it("matches rating columns by source name and date", () => {
    expect(parseRatingsTable(PREDICTIONS, ABBR)).toEqual([
      {
        key: "GA",
        ratings: [
          { source: "cook", asOf: "2026-09-23", rating: "likely_d" },
          { source: "inside-elections", asOf: "2026-10-01", rating: "lean_d" },
          { source: "sabato", asOf: "2026-10-06", rating: "likely_d" },
        ],
      },
    ]);
  });

  it("reads a first candidate that shares the list's opening line", () => {
    const raw = ' nowrap | {{Plainlist |*{{Party stripe|Republican Party (US)}}[[Mike Collins (politician)|Mike Collins]] (Republican)<ref name="GA2026" />\n*{{Party stripe|Democratic Party (United States)}}[[Jon Ossoff]] (Democratic)\n}}';
    expect(parseCandidates(raw).map((c) => c.name)).toEqual(["Mike Collins", "Jon Ossoff"]);
  });

  it("parses a bare candidate list", () => {
    expect(parseCandidates("*{{Party stripe|Libertarian Party (US)}}Jeff Wadlin (Libertarian)")).toEqual([
      { name: "Jeff Wadlin", party: "Libertarian", link: null },
    ]);
  });
});
