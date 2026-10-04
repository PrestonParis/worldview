import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser, safeNext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in · Worldview" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  if (await getCurrentUser()) redirect(next);

  return (
    <AuthForm
      mode="signin"
      next={next}
      initialError={error ?? null}
      googleEnabled={process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true"}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null}
    />
  );
}
