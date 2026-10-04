import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock("./session", () => ({ getCurrentUserId: () => getCurrentUserId() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const { requireContributor, requireContributorPage, NOT_SIGNED_IN } = await import("./guard");

describe("requireContributor", () => {
  beforeEach(() => getCurrentUserId.mockReset());

  it("denies visitors without a registered account", async () => {
    getCurrentUserId.mockResolvedValue(null);
    expect(await requireContributor()).toEqual({ ok: false, error: NOT_SIGNED_IN });
  });

  it("allows registered users", async () => {
    getCurrentUserId.mockResolvedValue("user-1");
    expect(await requireContributor()).toBeNull();
  });

  it("sends signed-out visitors on edit pages to sign in and back", async () => {
    getCurrentUserId.mockResolvedValue(null);
    await expect(requireContributorPage("/data/bills/a b/edit")).rejects.toThrow(
      "redirect:/login?next=%2Fdata%2Fbills%2Fa%20b%2Fedit",
    );
  });
});

// Server actions are public endpoints, so every shared-data action must check
// write access itself, before doing anything else.
describe("shared-data server actions", () => {
  const dir = path.join(__dirname, "../actions");
  // These manage the caller's own account, quizzes, and map projects, and
  // check ownership themselves.
  const ownerScoped = new Set(["auth.ts", "quiz.ts", "mapProjects.ts"]);
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !ownerScoped.has(f));

  it.each(files)("%s guards every exported action", (file) => {
    const source = readFileSync(path.join(dir, file), "utf8");
    const actions = [...source.matchAll(/^export async function (\w+)[\s\S]*?\n\): [^\n]*\{\n([^\n]*)\n/gm)];
    const declared = source.match(/^export async function /gm)?.length ?? 0;
    expect(actions.length, `${file}: could not parse every action`).toBe(declared);
    for (const [, name, firstLine] of actions) {
      expect(firstLine.trim(), `${file} → ${name}`).toBe("const denied = await requireContributor();");
    }
  });
});
