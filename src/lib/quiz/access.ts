// Who may view, answer, and claim a quiz (docs/quiz-plan.md, Persistence &
// sharing). Server-only: reads the edit cookie and the Supabase session.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getCurrentUserId } from "../auth/session";
import * as quizDb from "../db/quizSessions";
import type { QuizSession, QuizVisibility } from "../db/quizSessions";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const SLUG_PATTERN = /^[0-9A-Za-z]{12}$/;

export function newSlug(): string {
  // Rejection sampling keeps every character uniform.
  let out = "";
  while (out.length < 12) {
    for (const b of randomBytes(16)) {
      if (b < 248 && out.length < 12) out += BASE62[b % 62];
    }
  }
  return out;
}

export function newEditToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function editCookieName(slug: string): string {
  return `quiz_${slug}`;
}

export const EDIT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function currentUserId(): Promise<string | null> {
  return getCurrentUserId();
}

async function holdsEditCookie(session: QuizSession): Promise<boolean> {
  const token = (await cookies()).get(editCookieName(session.slug))?.value;
  if (!token) return false;
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(session.editTokenHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface QuizAccess {
  canView: boolean;
  // Answer, edit answers, and refine.
  canEdit: boolean;
  // Signed in and holding the edit cookie on an unclaimed quiz.
  canClaim: boolean;
  isOwner: boolean;
  signedIn: boolean;
}

// Unclaimed: anyone with the link views; the starting browser edits.
// Claimed: edit rights follow the owner's account; private hides it from
// everyone else.
export async function quizAccess(session: QuizSession): Promise<QuizAccess> {
  const userId = await currentUserId();
  const isOwner = !!session.ownerId && session.ownerId === userId;
  if (session.ownerId) {
    return {
      canView: isOwner || session.visibility === "public",
      canEdit: isOwner,
      canClaim: false,
      isOwner,
      signedIn: !!userId,
    };
  }
  const holder = await holdsEditCookie(session);
  return { canView: true, canEdit: holder, canClaim: holder && !!userId, isOwner: false, signedIn: !!userId };
}

// Claims an unclaimed quiz for the signed-in user if this browser holds its
// edit cookie. Shared by the claim button and the post-sign-in claim route.
export async function claimIfAllowed(slug: string, visibility: QuizVisibility): Promise<boolean> {
  if (!SLUG_PATTERN.test(slug)) return false;
  const session = await quizDb.getQuizSession(slug);
  if (!session) return false;
  const access = await quizAccess(session);
  const userId = await currentUserId();
  if (!access.canClaim || !userId) return false;
  const claimed = await quizDb.claimQuizSession(session.id, userId, visibility);
  if (claimed) (await cookies()).delete(editCookieName(slug));
  return claimed;
}

// Every quiz this visitor can call theirs, newest first: claimed by their
// account, or unclaimed and started in this browser (it holds the edit cookie).
export async function viewerQuizSessions(): Promise<{ session: QuizSession; claimed: boolean }[]> {
  const userId = await currentUserId();
  const prefix = editCookieName("");
  const held = (await cookies())
    .getAll()
    .filter((c) => c.name.startsWith(prefix) && SLUG_PATTERN.test(c.name.slice(prefix.length)))
    .map((c) => c.name.slice(prefix.length))
    .slice(0, 50);
  const [owned, browser] = await Promise.all([userId ? quizDb.listQuizSessions(userId) : [], quizDb.getQuizSessionsBySlugs(held)]);
  const unclaimed: QuizSession[] = [];
  for (const s of browser) if (!s.ownerId && (await holdsEditCookie(s))) unclaimed.push(s);
  return [...owned.map((session) => ({ session, claimed: true })), ...unclaimed.map((session) => ({ session, claimed: false }))].sort(
    (a, b) => b.session.updatedAt.getTime() - a.session.updatedAt.getTime(),
  );
}

// Where "Sign in to claim" sends a signed-out visitor: sign in (or register),
// then claim automatically and land on the results.
export function signInToClaimHref(slug: string): string {
  return `/login?next=${encodeURIComponent(`/quiz/${slug}/claim`)}`;
}

const CLAIM_NEXT = /^\/quiz\/([0-9A-Za-z]{12})\/claim$/;

// Right after sign-in: if the visitor came from "Sign in to claim", claim now
// and return the results URL, so the address bar never shows /claim.
export async function claimAfterSignIn(next: string): Promise<string> {
  const slug = next.match(CLAIM_NEXT)?.[1];
  if (!slug) return next;
  await claimIfAllowed(slug, "public");
  return `/quiz/${slug}?view=results`;
}
