import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteAccountAction, updateDisplayNameAction } from "@/lib/actions/auth";
import { EmailSection, PasswordSection } from "@/components/auth/account-security";

export const metadata: Metadata = { title: "Account · Worldview" };

const PROVIDER_LABELS: Record<string, string> = { email: "Email", google: "Google" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Account</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {user.email} · member since {new Date(user.profile.registeredAt).toLocaleDateString()}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Profile</h2>
        <form action={updateDisplayNameAction} className="flex items-end gap-3">
          <div className="flex-1">
            <Field label="Display name" htmlFor="displayName">
              <input
                id="displayName"
                name="displayName"
                maxLength={80}
                defaultValue={user.displayName ?? ""}
                className={inputClass}
              />
            </Field>
          </div>
          <Button type="submit">Save</Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Email</h2>
        <EmailSection currentEmail={user.email} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Password</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Set one to sign in with your email and a password. Without one, sign in with Google or an emailed code.
        </p>
        <PasswordSection />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sign-in methods</h2>
        <ul className="text-sm text-slate-700 dark:text-slate-300">
          {user.providers.map((p) => (
            <li key={p}>{PROVIDER_LABELS[p] ?? p}</li>
          ))}
        </ul>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Google sign-in with the same email address joins this account automatically.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sessions</h2>
        <div className="flex flex-wrap gap-3">
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" className="border border-slate-300 dark:border-slate-700">
              Sign out
            </Button>
          </form>
          <form action="/auth/signout?scope=global" method="post">
            <Button type="submit" variant="ghost" className="border border-slate-300 dark:border-slate-700">
              Sign out everywhere
            </Button>
          </form>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">“Sign out everywhere” also signs out your other browsers and devices.</p>
      </section>

      <section className="space-y-3 rounded-md border border-red-200 p-4 dark:border-red-900">
        <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Delete account</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Permanently deletes your account, your saved map graphics, and your claimed quizzes.
        </p>
        <form action={deleteAccountAction} className="flex items-end gap-3">
          <div className="flex-1">
            <Field
              label="Type “delete” to confirm"
              htmlFor="confirm"
              error={error === "confirm" ? "Type “delete” to confirm." : undefined}
            >
              <input id="confirm" name="confirm" autoComplete="off" className={inputClass} />
            </Field>
          </div>
          <Button type="submit" variant="danger">Delete account</Button>
        </form>
      </section>
    </div>
  );
}
