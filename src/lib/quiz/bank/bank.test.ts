import { describe, it, expect } from "vitest";
import { statements, issues, issueOrder } from "./index";
import { axes } from "../axes";
import { allTraditions, ideologies, umbrellaTraditions } from "../ideologies";
import { authorities, axisIds, changes, legacies, lensIds, nationBases, peoples, traditions, type ChoiceQuestion, type Condition, type LensId } from "../types";
import { COVERAGE_ORDER } from "../engine";
import { explainQuestion, explainStatement } from "../explanations";

const primaryAxis = (id: string) => id.split(".")[0];

describe("axes", () => {
  it("defines every axis id exactly once", () => {
    expect(axes.map((a) => a.id).sort()).toEqual([...axisIds].sort());
  });
});

describe("statements", () => {
  it("provide plain-language context for every statement", () => {
    for (const statement of statements) {
      expect(explainStatement(statement).length, statement.id).toBeGreaterThan(30);
    }
  });

  it("have unique ids and unique text", () => {
    expect(new Set(statements.map((s) => s.id)).size).toBe(statements.length);
    expect(new Set(statements.map((s) => s.text.toLowerCase())).size).toBe(statements.length);
  });

  it("load on their own axis at full weight, with locations in range", () => {
    for (const s of statements) {
      const own = s.axes[primaryAxis(s.id) as keyof typeof s.axes];
      expect(own, s.id).toBeDefined();
      expect(own!.weight, s.id).toBe(1);
      for (const [axis, l] of Object.entries(s.axes)) {
        expect(axisIds, `${s.id} → ${axis}`).toContain(axis);
        expect(Math.abs(l!.location), s.id).toBeLessThanOrEqual(1);
        expect(l!.weight, s.id).toBeGreaterThan(0);
        expect(l!.weight, s.id).toBeLessThanOrEqual(1);
      }
    }
  });

  // Directional items point toward the pole on their location's side, so they
  // can't sit at 0; centre statements are compromises and must be ideal-point.
  it("use an item model consistent with their location", () => {
    for (const s of statements) {
      const own = s.axes[primaryAxis(s.id) as keyof typeof s.axes]!.location;
      if (own === 0) expect(s.model, s.id).toBe("ideal");
      if (s.model === "directional") expect(own, s.id).not.toBe(0);
    }
  });

  it("avoid wording relative to the status quo", () => {
    for (const s of statements) {
      expect(s.text, s.id).not.toMatch(/\b(currently|than (it|they) (is|are|do) now|too (much|far|little))\b/i);
    }
  });

  for (const axis of axisIds) {
    describe(axis, () => {
      const own = statements.filter((s) => primaryAxis(s.id) === axis);
      const loc = (s: (typeof own)[number]) => s.axes[axis]!.location;

      it("has at least 18 statements", () => {
        expect(own.length).toBeGreaterThanOrEqual(18);
      });

      // Equal pro and con counts cancel out people who tend to agree with everything.
      it("is balanced between its poles", () => {
        const neg = own.filter((s) => loc(s) < 0).length;
        const pos = own.filter((s) => loc(s) > 0).length;
        expect(Math.abs(neg - pos) / Math.max(neg, pos)).toBeLessThanOrEqual(0.1);
      });

      it("covers the whole range with no gaps", () => {
        for (const target of [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]) {
          const near = own.filter((s) => Math.abs(loc(s) - target) <= 0.125);
          expect(near.length, `location ${target}`).toBeGreaterThanOrEqual(2);
        }
      });
    });
  }
});

describe("issue modules", () => {
  const questions: ChoiceQuestion[] = issues.flatMap((m) => [m.screener, ...m.followUps]);

  it("cover 31 distinct issues", () => {
    expect(new Set(issues.map((m) => m.id)).size).toBe(31);
    expect(issues.length).toBe(31);
  });

  it("are ordered: every issue once, foundations first", () => {
    expect([...issueOrder].sort()).toEqual(issues.map((m) => m.id).sort());
    expect(new Set(issueOrder).size).toBe(issueOrder.length);
    const firstOther = issues.findIndex((m) => !m.foundation);
    expect(issues.slice(firstOther).some((m) => m.foundation)).toBe(false);
    expect(issues.slice(0, firstOther).map((m) => m.id)).toEqual(["regime", "economic-system", "religion-law"]);
  });

  it("visit every axis once in coverage order", () => {
    expect([...COVERAGE_ORDER].sort()).toEqual([...axisIds].sort());
    expect(new Set(COVERAGE_ORDER).size).toBe(axisIds.length);
  });

  // An issue can only be ruled out by an answer that's already been given:
  // a foundation screener, or a follow-up asked straight after it.
  it("are ruled out only by real foundation options", () => {
    const foundations = new Map(
      issues
        .filter((m) => m.foundation)
        .flatMap((m) => [m.screener, ...m.followUps.filter((f) => !f.later)])
        .map((q) => [q.id, new Set(q.options.map((o) => o.id))]),
    );
    const check = (c: Condition, ctx: string) => {
      if ("all" in c) return c.all.forEach((x) => check(x, ctx));
      if ("any" in c) return c.any.forEach((x) => check(x, ctx));
      const opts = foundations.get(c.q);
      expect(opts, `${ctx} → ${c.q}`).toBeDefined();
      for (const id of c.in) expect(opts!.has(id), `${ctx} → ${c.q}/${id}`).toBe(true);
    };
    for (const m of issues) {
      if (!m.unless) continue;
      expect(m.foundation, m.id).toBeFalsy();
      check(m.unless, m.id);
    }
  });

  it("have unique question ids prefixed by their issue", () => {
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
    for (const m of issues) {
      for (const q of [m.screener, ...m.followUps]) {
        expect(q.id.startsWith(`${m.id}.`), q.id).toBe(true);
      }
    }
  });

  it("use complete questions and provide an explanation for each one", () => {
    for (const issue of issues) {
      for (const question of [issue.screener, ...issue.followUps]) {
        expect(question.prompt, question.id).toMatch(/\?$/);
        expect(explainQuestion(question, issue).length, question.id).toBeGreaterThan(30);
      }
    }
  });

  it("have at least two options with unique ids and a stance", () => {
    for (const q of questions) {
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(2);
      expect(new Set(q.options.map((o) => o.id)).size, q.id).toBe(q.options.length);
      for (const o of q.options) {
        expect(o.stance.length, `${q.id}/${o.id}`).toBeGreaterThan(0);
        for (const [axis, l] of Object.entries(o.axes)) {
          expect(axisIds, `${q.id}/${o.id} → ${axis}`).toContain(axis);
          expect(Math.abs(l!.location)).toBeLessThanOrEqual(1);
          expect(l!.weight).toBeGreaterThan(0);
          expect(l!.weight).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("name a policy-profile attribute, unique within the module", () => {
    for (const m of issues) {
      const attrs = [m.screener, ...m.followUps].map((q) => q.attribute);
      for (const a of attrs) expect(a.length, m.id).toBeGreaterThan(0);
      expect(new Set(attrs).size, m.id).toBe(attrs.length);
    }
  });

  it("marks exclusive options only on multiple-selection questions", () => {
    for (const q of questions) {
      for (const option of q.options) {
        if (option.exclusive) expect(["multiple", "checklist"], `${q.id}/${option.id}`).toContain(q.selection);
      }
    }
  });

  it("includes compact policy batteries for independent selections", () => {
    const multiple = questions.filter((question) => question.selection === "multiple" || question.selection === "checklist");
    for (const question of multiple) {
      expect(question.options.some((option) => option.exclusive), question.id).toBe(true);
    }
  });

  // Each checklist item is a yes/no question: both answers need a stance and
  // the same axes, or the "no" side would silently carry no evidence.
  it("give every checklist item a yes and a no on the same axes, ending with None of these", () => {
    const checklists = questions.filter((q) => q.selection === "checklist");
    expect(checklists.length).toBeGreaterThanOrEqual(10);
    for (const q of checklists) {
      expect(q.options.at(-1)!.exclusive, q.id).toBe(true);
      expect(Object.keys(q.options.at(-1)!.axes), q.id).toEqual([]);
      for (const o of q.options.slice(0, -1)) {
        expect(o.exclusive, `${q.id}/${o.id}`).toBeFalsy();
        expect(o.unchecked, `${q.id}/${o.id}`).toBeDefined();
        expect(o.unchecked!.stance.length, `${q.id}/${o.id}`).toBeGreaterThan(0);
        expect(Object.keys(o.unchecked!.axes).sort(), `${q.id}/${o.id}`).toEqual(Object.keys(o.axes).sort());
      }
    }
    for (const q of questions.filter((q) => q.selection !== "checklist")) {
      for (const o of q.options) expect(o.unchecked, `${q.id}/${o.id}`).toBeUndefined();
    }
  });

  it("screeners feed at least one axis", () => {
    for (const m of issues) {
      expect(m.screener.options.some((o) => Object.keys(o.axes).length > 0), m.id).toBe(true);
    }
  });

  // A follow-up may only depend on questions asked before it in the same module.
  it("follow-up conditions reference earlier questions and real options", () => {
    for (const m of issues) {
      const seen = new Map<string, Set<string>>([[m.screener.id, new Set(m.screener.options.map((o) => o.id))]]);
      const check = (c: Condition, ctx: string) => {
        if ("all" in c) return c.all.forEach((x) => check(x, ctx));
        if ("any" in c) return c.any.forEach((x) => check(x, ctx));
        const opts = seen.get(c.q);
        expect(opts, `${ctx} → ${c.q}`).toBeDefined();
        for (const id of c.in) expect(opts!.has(id), `${ctx} → ${c.q}/${id}`).toBe(true);
      };
      for (const f of m.followUps) {
        if (f.when) check(f.when, f.id);
        seen.set(f.id, new Set(f.options.map((o) => o.id)));
      }
    }
  });

  // A lens may be split across a screener and its follow-up (form of
  // government, then who rules), but every value is offered exactly once and
  // within one module.
  it("offer every lens value exactly once, within a single module", () => {
    const valid: Record<LensId, readonly string[]> = { tradition: traditions, authority: authorities, nation: nationBases, people: peoples, change: changes, legacy: legacies };
    for (const lens of lensIds) {
      const modules = issues.filter((m) => [m.screener, ...m.followUps].some((q) => q.options.some((o) => o.lens?.[lens])));
      expect(modules.length, lens).toBe(1);
      const offered = [modules[0].screener, ...modules[0].followUps].flatMap((q) => q.options.flatMap((o) => (o.lens?.[lens] ? [o.lens[lens]] : [])));
      expect([...offered].sort(), lens).toEqual([...valid[lens]].sort());
    }
  });

  // A condition listing every screener option is just "always" — omit it.
  it("conditions are never trivially true", () => {
    for (const m of issues) {
      for (const f of m.followUps) {
        if (f.when && "q" in f.when && f.when.q === m.screener.id) {
          expect(f.when.in.length, f.id).toBeLessThan(m.screener.options.length);
        }
      }
    }
  });
});

describe("ideologies", () => {
  it("keep umbrella labels out of matching, each covering real traditions", () => {
    const matchable = new Set(ideologies.map((i) => i.id));
    expect(new Set(allTraditions.map((i) => i.id)).size).toBe(allTraditions.length);
    const covered = umbrellaTraditions.flatMap((u) => u.covers ?? []);
    for (const u of umbrellaTraditions) {
      expect(matchable.has(u.id), u.id).toBe(false);
      expect(u.covers?.length ?? 0, u.id).toBeGreaterThanOrEqual(2);
      for (const id of u.covers ?? []) expect(matchable.has(id), `${u.id} covers ${id}`).toBe(true);
    }
    expect(new Set(covered).size, "a tradition sits under one umbrella").toBe(covered.length);
  });

  it("number at least 50 with unique ids and names", () => {
    expect(ideologies.length).toBeGreaterThanOrEqual(50);
    expect(new Set(ideologies.map((i) => i.id)).size).toBe(ideologies.length);
    expect(new Set(ideologies.map((i) => i.name)).size).toBe(ideologies.length);
  });

  it("place every axis in range, with at least two core axes", () => {
    for (const i of ideologies) {
      expect(Object.keys(i.position).sort(), i.id).toEqual([...axisIds].sort());
      for (const [axis, v] of Object.entries(i.position)) {
        expect(Math.abs(v), `${i.id} → ${axis}`).toBeLessThanOrEqual(1);
      }
      if (i.core) {
        expect(i.core.length, i.id).toBeGreaterThanOrEqual(2);
        expect(new Set(i.core).size, i.id).toBe(i.core.length);
        for (const axis of i.core) expect(axisIds, `${i.id} core → ${axis}`).toContain(axis);
      }
    }
  });

  it("tag lenses only with known values", () => {
    const valid: Record<LensId, readonly string[]> = { tradition: traditions, authority: authorities, nation: nationBases, people: peoples, change: changes, legacy: legacies };
    for (const i of ideologies) {
      for (const lens of lensIds) {
        for (const v of i[lens] ?? []) expect(valid[lens], `${i.id} ${lens}`).toContain(v);
      }
    }
  });

  it("no two ideologies share an identical position", () => {
    const keys = ideologies.map((i) => JSON.stringify(Object.entries(i.position).sort()));
    expect(new Set(keys).size).toBe(ideologies.length);
  });
});
