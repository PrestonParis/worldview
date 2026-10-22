import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "./session";

const getCurrentUser = vi.fn<() => Promise<CurrentUser | null>>();
vi.mock("./session", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

const { requireContributor, requireContributorPage, requireOwnerPage, isOwner, NOT_SIGNED_IN, NOT_EDITOR } = await import("./guard");

function user(role: "member" | "editor"): CurrentUser {
  return {
    id: "user-1",
    email: "a@example.com",
    displayName: null,
    providers: ["email"],
    profile: { id: "user-1", displayName: null, role, registeredAt: "2026-10-14T00:00:00.000Z" },
  };
}

describe("requireContributor", () => {
  beforeEach(() => getCurrentUser.mockReset());

  it("denies signed-out visitors", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await requireContributor()).toEqual({ ok: false, error: NOT_SIGNED_IN });
  });

  it("denies members", async () => {
    getCurrentUser.mockResolvedValue(user("member"));
    expect(await requireContributor()).toEqual({ ok: false, error: NOT_EDITOR });
  });

  it("allows editors", async () => {
    getCurrentUser.mockResolvedValue(user("editor"));
    expect(await requireContributor()).toBeNull();
  });

  it("sends signed-out visitors on edit pages to sign in and back", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(requireContributorPage("/data/bills/a b/edit")).rejects.toThrow(
      "redirect:/login?next=%2Fdata%2Fbills%2Fa%20b%2Fedit",
    );
  });

  it("sends members on edit pages to the read-only page", async () => {
    getCurrentUser.mockResolvedValue(user("member"));
    await expect(requireContributorPage("/data/bills/b1/edit")).rejects.toThrow("redirect:/data/bills/b1");
  });

  it("lets editors open edit pages", async () => {
    getCurrentUser.mockResolvedValue(user("editor"));
    await expect(requireContributorPage("/data/bills/b1/edit")).resolves.toBeUndefined();
  });
});

// Server actions are public endpoints, so every shared-data action must check
// write access itself, before doing anything else.
describe("shared-data server actions", () => {
  const dir = path.join(__dirname, "../actions");
  // These manage the caller's own account, quizzes, and map projects, and
  // check ownership themselves.
  const ownerScoped = new Set(["auth.ts", "atlas.ts", "myGovernment.ts", "quiz.ts", "mapProjects.ts"]);
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !ownerScoped.has(f));

  it.each(files)("%s guards every exported action", (file) => {
    const source = readFileSync(path.join(dir, file), "utf8");
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const actions = tree.statements.filter(
      (statement): statement is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(statement) &&
        statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true &&
        statement.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword),
    );

    for (const action of actions) {
      const name = action.name?.text ?? "<anonymous>";
      const firstStatement = action.body?.statements[0]?.getText(tree);
      expect(firstStatement, `${file} → ${name}`).toBe("const denied = await requireContributor();");
    }
  });
});

describe("owner-only Geography", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    vi.stubEnv("OWNER_EMAIL", "Owner@Example.com");
  });

  it("matches the owner email case-insensitively", () => {
    expect(isOwner({ ...user("member"), email: "owner@example.com" })).toBe(true);
    expect(isOwner(user("editor"))).toBe(false);
    expect(isOwner(null)).toBe(false);
  });

  it("lets nobody in when OWNER_EMAIL is unset", () => {
    vi.stubEnv("OWNER_EMAIL", "");
    expect(isOwner({ ...user("editor"), email: "" })).toBe(false);
  });

  it("sends signed-out visitors to sign in and hides the page from other accounts", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(requireOwnerPage("/geography")).rejects.toThrow("redirect:/login?next=%2Fgeography");
    getCurrentUser.mockResolvedValue(user("editor"));
    await expect(requireOwnerPage("/geography")).rejects.toThrow("notFound");
  });

  it("gates every map-project action on the owner", () => {
    const src = readFileSync(path.join(__dirname, "../actions/mapProjects.ts"), "utf8");
    expect(src).toContain("isOwner(user)");
    expect(src).not.toContain("getCurrentUserId");
  });
});
