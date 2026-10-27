import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser, safeNext } from "@/lib/auth/session";
import { googleSignInEnabled } from "@/lib/auth/providers";

export const metadata: Metadata = { title: "Create account · Worldview" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  if (await getCurrentUser()) redirect(next);

  return (
    <AuthForm
      mode="register"
      next={next}
      initialError={error ?? null}
      googleEnabled={await googleSignInEnabled()}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null}
    />
  );
}
