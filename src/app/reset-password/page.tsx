import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewPasswordForm } from "@/components/auth/auth-form";
import { getCurrentUser, safeNext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password · Worldview" };

// Reached from the forgot-password code (verifyEmailCodeAction), which has
// already signed the account in.
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (!(await getCurrentUser())) redirect(`/login?next=${encodeURIComponent(next)}`);
  return <NewPasswordForm next={next} />;
}
