import { describe, expect, it } from "vitest";
import {
  buildMoneyGraph,
  classifyCommitteeName,
  contributionTypeFromFec,
  formatAmount,
  industryBreakdown,
  industryDonors,
  industryLabel,
  isDonorEdge,
  moneyEdgeLabel,
  stateBreakdown,
  stateDonors,
  buildLobbyingGraph,
  US_STATE_GRID,
  usStateName,
  type IndustryBreakdownRow,
  type StateBreakdownRow,
} from "./index";
import type { LobbyingRegistration } from "@/lib/validation/lobbying";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";

function entity(id: string, name: string, type: Entity["type"] = "company"): Entity {
  return {
    id,
    type,
    name,
    description: "",
    biography: "",
    imageUrl: "",
    websiteUrl: "",
    xUrl: "",
    facebookUrl: "",
    instagramUrl: "",
    youtubeUrl: "",
    linkedinUrl: "",
    highlights: "",
    metadata: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function manualEdge(id: string, source: string, target: string, label = "donated to"): Edge {
  return {
    id,
    sourceEntityId: source,
    targetEntityId: target,
    label,
    validFrom: "2024-02-01",
    validTo: "",
    notes: "hand entered",
    sourceRecordId: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("classifyCommitteeName", () => {
  it("matches known industry keywords", () => {
    expect(classifyCommitteeName("STIFEL, NICOLAUS & COMPANY")).toBe("finance-insurance-realestate");
    expect(classifyCommitteeName("Lockheed Martin Employees PAC")).toBe("defense");
    expect(classifyCommitteeName("United Auto Workers")).toBe("labor");
    expect(classifyCommitteeName("Pfizer Inc PAC")).toBe("health");
  });

  it("returns null when nothing matches, rather than guessing", () => {
    expect(classifyCommitteeName("Smith Family Fund")).toBeNull();
    expect(classifyCommitteeName("")).toBeNull();
    expect(classifyCommitteeName(null)).toBeNull();
  });
});

describe("contributionTypeFromFec", () => {
  it("maps FEC entity_type codes to the coarse enum", () => {
    expect(contributionTypeFromFec("IND")).toBe("individual");
    expect(contributionTypeFromFec("pac")).toBe("pac");
    expect(contributionTypeFromFec("PTY")).toBe("party");
    expect(contributionTypeFromFec("CCM")).toBe("committee");
    expect(contributionTypeFromFec("COM")).toBe("committee");
    expect(contributionTypeFromFec("ORG")).toBe("other");
    expect(contributionTypeFromFec("???")).toBeNull();
    expect(contributionTypeFromFec(undefined)).toBeNull();
  });
});

describe("industryLabel", () => {
  it("labels known slugs and title-cases unknown ones", () => {
    expect(industryLabel("defense")).toBe("Defense");
    expect(industryLabel("some-new-sector")).toBe("Some New Sector");
    expect(industryLabel(null)).toBe("Unclassified");
  });
});

describe("isDonorEdge", () => {
  it("recognizes funding-flavored labels", () => {
    expect(isDonorEdge("donated to")).toBe(true);
    expect(isDonorEdge("provided campaign financing")).toBe(true);
    expect(isDonorEdge("endorsed")).toBe(false);
  });
});

describe("formatAmount / moneyEdgeLabel", () => {
  it("formats whole-unit currency", () => {
    expect(formatAmount(75000, "USD")).toBe("$75,000");
    expect(formatAmount(1000, "")).toBe("$1,000");
  });

  it("appends a count only when > 1", () => {
    expect(moneyEdgeLabel(75000, 1, "USD")).toBe("$75,000");
    expect(moneyEdgeLabel(75000, 12, "USD")).toBe("$75,000 · 12×");
  });
});

describe("industryBreakdown / industryDonors", () => {
  const rows: IndustryBreakdownRow[] = [
    { recipientEntityId: "p1", industry: "finance-insurance-realestate", donorEntityId: "d1", currency: "USD", total: 60000, count: 6 },
    { recipientEntityId: "p1", industry: "finance-insurance-realestate", donorEntityId: "d2", currency: "USD", total: 20000, count: 2 },
    { recipientEntityId: "p1", industry: "labor", donorEntityId: "d3", currency: "USD", total: 20000, count: 1 },
    { recipientEntityId: "p2", industry: "defense", donorEntityId: "d4", currency: "USD", total: 50000, count: 5 },
    { recipientEntityId: "p1", industry: "", donorEntityId: "d5", currency: "EUR", total: 999, count: 1 },
  ];

  it("rolls up by sector, sorted, with shares of the in-scope total", () => {
    const { slices, total } = industryBreakdown(rows, { currency: "USD" });
    expect(total).toBe(150000);
    expect(slices.map((s) => s.industry)).toEqual([
      "finance-insurance-realestate",
      "defense",
      "labor",
    ]);
    expect(slices[0].total).toBe(80000);
    expect(slices[0].share).toBeCloseTo(80000 / 150000);
    expect(slices[0].label).toBe("Finance, Insurance & Real Estate");
  });

  it("filters to selected recipients and ignores other currencies", () => {
    const { slices, total } = industryBreakdown(rows, { currency: "USD", recipientIds: ["p1"] });
    expect(total).toBe(100000);
    expect(slices.map((s) => s.industry)).toEqual(["finance-insurance-realestate", "labor"]);
  });

  it("expands a sector to its donors, summed and sorted", () => {
    const donors = industryDonors(rows, {
      industry: "finance-insurance-realestate",
      currency: "USD",
      recipientIds: ["p1"],
    });
    expect(donors).toEqual([
      { donorEntityId: "d1", total: 60000, count: 6 },
      { donorEntityId: "d2", total: 20000, count: 2 },
    ]);
  });
});

describe("US_STATE_GRID", () => {
  it("covers 50 states + DC with unique abbreviations and cells", () => {
    expect(US_STATE_GRID).toHaveLength(51);
    expect(new Set(US_STATE_GRID.map((c) => c.abbr)).size).toBe(51);
    expect(new Set(US_STATE_GRID.map((c) => `${c.row},${c.col}`)).size).toBe(51);
    expect(usStateName("TX")).toBe("Texas");
    expect(usStateName("ZZ")).toBe("ZZ");
  });
});

describe("stateBreakdown / stateDonors", () => {
  const rows: StateBreakdownRow[] = [
    { recipientEntityId: "p1", state: "NY", donorEntityId: "d1", currency: "USD", total: 80000, count: 8 },
    { recipientEntityId: "p1", state: "NY", donorEntityId: "d2", currency: "USD", total: 20000, count: 2 },
    { recipientEntityId: "p1", state: "CA", donorEntityId: "d3", currency: "USD", total: 40000, count: 4 },
    { recipientEntityId: "p2", state: "TX", donorEntityId: "d4", currency: "USD", total: 30000, count: 3 },
    { recipientEntityId: "p1", state: "", donorEntityId: "d5", currency: "USD", total: 10000, count: 1 },
  ];

  it("sums by state, splits out the unknown bucket, sorts by total", () => {
    const { states, total, unknown } = stateBreakdown(rows, { currency: "USD" });
    expect(total).toBe(180000);
    expect(states.map((s) => s.state)).toEqual(["NY", "CA", "TX"]);
    expect(states[0].total).toBe(100000);
    expect(unknown?.total).toBe(10000);
    expect(states.some((s) => s.state === "")).toBe(false);
  });

  it("scopes to selected recipients", () => {
    const { states, total } = stateBreakdown(rows, { currency: "USD", recipientIds: ["p1"] });
    expect(total).toBe(150000);
    expect(states.map((s) => s.state)).toEqual(["NY", "CA"]);
  });

  it("lists donors within a state", () => {
    const donors = stateDonors(rows, { state: "NY", currency: "USD", recipientIds: ["p1"] });
    expect(donors).toEqual([
      { donorEntityId: "d1", total: 80000, count: 8 },
      { donorEntityId: "d2", total: 20000, count: 2 },
    ]);
  });
});

describe("buildLobbyingGraph", () => {
  const reg = (over: Partial<LobbyingRegistration>): LobbyingRegistration => ({
    id: crypto.randomUUID(),
    clientEntityId: "c1",
    registrantEntityId: "f1",
    year: 2024,
    period: "",
    amount: null,
    amountKind: "",
    notes: "",
    externalId: "",
    issues: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  });

  const entities = [
    entity("c1", "Lockheed Martin"),
    entity("f1", "Akin Gump"),
    entity("f2", "Brownstein"),
    entity("x", "Unconnected"),
  ];

  it("aggregates filings per client→firm pair, sums amount, spans years, dedupes issues/bills", () => {
    const g = buildLobbyingGraph({
      entities,
      registrations: [
        reg({ year: 2023, amount: 200000, issues: [{ id: "i1", issueCode: "DEF", issueLabel: "Defense", billId: "b1", description: "" }] }),
        reg({ year: 2024, amount: 300000, issues: [{ id: "i2", issueCode: "DEF", issueLabel: "Defense", billId: "", description: "" }] }),
        reg({ registrantEntityId: "f2", year: 2024, amount: 50000, issues: [] }),
      ],
    });

    expect(g.rows).toHaveLength(2);
    const big = g.rows[0];
    expect(big.registrantEntityId).toBe("f1");
    expect(big.total).toBe(500000);
    expect(big.filings).toBe(2);
    expect(big.firstYear).toBe(2023);
    expect(big.lastYear).toBe(2024);
    expect(big.issues).toEqual(["Defense"]);
    expect(big.billIds).toEqual(["b1"]);

    expect(g.entities.map((e) => e.id).sort()).toEqual(["c1", "f1", "f2"]);
    const bigEdge = g.edges.find((e) => e.targetEntityId === "f1")!;
    expect(bigEdge.label).toBe("$500,000 · 2 filings");
    expect(g.edgeStyles[bigEdge.id].strokeWidth!).toBeGreaterThan(
      g.edgeStyles[g.edges.find((e) => e.targetEntityId === "f2")!.id].strokeWidth!,
    );
  });

  it("labels a zero-amount pair by filing count", () => {
    const g = buildLobbyingGraph({
      entities,
      registrations: [reg({ amount: null })],
    });
    expect(g.edges[0].label).toBe("1 filing");
  });

  it("keeps an in-house (client === registrant) filing as a row but not an edge", () => {
    const g = buildLobbyingGraph({
      entities,
      registrations: [
        reg({ registrantEntityId: "c1", amount: 90000 }), // self-filer
        reg({ registrantEntityId: "f1", amount: 10000 }),
      ],
    });
    expect(g.rows.find((r) => r.inHouse)?.total).toBe(90000);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0].targetEntityId).toBe("f1");
  });
});

describe("buildMoneyGraph", () => {
  const entities = [
    entity("d1", "Stifel Nicolaus"),
    entity("d2", "Janney Montgomery Scott"),
    entity("p1", "Chuck Schumer", "politician"),
    entity("x9", "Unconnected Co"),
  ];

  it("turns contribution flows into weighted, styled edges + rows", () => {
    const g = buildMoneyGraph({
      entities,
      flows: [
        {
          donorEntityId: "d1",
          recipientEntityId: "p1",
          currency: "USD",
          total: 100000,
          count: 5,
          firstDate: "2025-01-13T00:00:00.000Z",
          lastDate: "2026-05-04T00:00:00.000Z",
        },
        {
          donorEntityId: "d2",
          recipientEntityId: "p1",
          currency: "USD",
          total: 2000,
          count: 1,
          firstDate: "2025-03-01T00:00:00.000Z",
          lastDate: "2025-03-01T00:00:00.000Z",
        },
      ],
      manualDonorEdges: [],
    });

    expect(g.edges).toHaveLength(2);
    expect(g.rows).toHaveLength(2);
    // Only connected entities survive.
    expect(g.entities.map((e) => e.id).sort()).toEqual(["d1", "d2", "p1"]);

    const big = g.edges.find((e) => e.sourceEntityId === "d1")!;
    const small = g.edges.find((e) => e.sourceEntityId === "d2")!;
    expect(big.label).toBe("$100,000 · 5×");
    // Bigger total → thicker stroke.
    expect(g.edgeStyles[big.id].strokeWidth!).toBeGreaterThan(
      g.edgeStyles[small.id].strokeWidth!,
    );
    expect(g.edgeStyles[big.id].dashed).toBeFalsy();
  });

  it("keeps a manual donor edge only when FEC doesn't already cover the pair", () => {
    const g = buildMoneyGraph({
      entities,
      flows: [
        {
          donorEntityId: "d1",
          recipientEntityId: "p1",
          currency: "USD",
          total: 100000,
          count: 5,
          firstDate: "",
          lastDate: "",
        },
      ],
      manualDonorEdges: [
        manualEdge("m1", "d1", "p1"), // dropped — FEC covers d1→p1
        manualEdge("m2", "d2", "p1"), // kept — unverified overlay
      ],
    });

    const ids = g.edges.map((e) => e.id).sort();
    expect(ids).toContain("m2");
    expect(ids).not.toContain("m1");
    expect(g.edgeStyles.m2.dashed).toBe(true);
    expect(g.rows.find((r) => r.donorEntityId === "d2")!.kind).toBe("manual");
  });
});
