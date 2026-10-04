import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { claimIfAllowed, currentUserId, SLUG_PATTERN } from "@/lib/quiz/access";

// "Sign in to claim" lands here after sign-in: claim the quiz this browser
// started (public, switchable from the owner panel) and show the results.
// Claiming needs the quiz's edit cookie, so a link alone can't claim anyone
// else's quiz.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const origin = new URL(request.url).origin;
  if (!SLUG_PATTERN.test(slug)) return NextResponse.redirect(`${origin}/quiz`);

  if (!(await currentUserId())) {
    return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(`/quiz/${slug}/claim`)}`);
  }
  if (await claimIfAllowed(slug, "public")) revalidatePath(`/quiz/${slug}`);
  return NextResponse.redirect(`${origin}/quiz/${slug}?view=results`);
}
