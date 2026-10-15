# Auth: sign-in & registration

Replaces the old invite-only magic link, which broke in four ways: Supabase
dashboard invites send `#access_token` fragments the `?code=` callback never
read; magic links failed when opened in a different browser than the one that
requested them (PKCE verifier); mail scanners consumed the one-time link; and
the built-in Supabase mailer only delivers ~2 emails/hour.

## How it works

- **Browsing needs no account.** Accounts own things: `/geography` graphics,
  claimed quizzes.
- **Registration** (`/register`): open to anyone — email + password (8–72
  chars). With Supabase's "Confirm email" on, Supabase emails a 6-digit code
  and the account is only usable once it's typed on the page (`verifyOtp`);
  signing in to an unconfirmed account sends a fresh code. With it off, the
  account signs in immediately. Google sign-in creates an account the same
  way.
- **Sign-in** (`/login`): email + password. **Forgot your password?** emails a
  6-digit code; after it's entered the page asks for a new password
  (`setNewPasswordAction`) and signs in.
- **Profiles**: `finalizeSignIn()` (`src/lib/auth/session.ts`) creates the
  `profiles` row on an account's first sign-in. `getCurrentUser()` only
  treats a session as signed in when that row exists.
- **Roles** (`profiles.role`): new accounts are **members** — they own their
  maps and quizzes. Creating, editing, or deleting shared records (entities,
  bills, claims, …) needs an **editor**: every shared-data server action
  starts with `requireContributor()` (`src/lib/auth/guard.ts`, enforced by
  `guard.test.ts`), and edit controls only render for editors. Accounts that
  registered with the old registration code were made editors by
  `supabase/sql/2026-10-15-profile-roles.sql`. Grant or remove it with
  `npm run auth:role -- <email> editor|member` (`ENV_FILE=.env.cloud` for
  production).
- **Quiz claims**: "Sign in to claim" (top of an unclaimed quiz) sends you
  through sign-in/registration and claims the quiz automatically
  (`claimAfterSignIn` in `src/lib/quiz/access.ts`), landing on the results.
- **Account page** (`/account`): display name, sign-in methods, sign out, and
  delete account (removes map projects, claimed quizzes, profile, and the auth
  user via the service-role key).

## Setup checklist (cloud)

1. Apply the table: `ENV_FILE=.env.cloud node scripts/apply-sql.mjs supabase/sql/2026-10-02-profiles.sql`
   (also grandfathers every existing auth user). **Do this before deploying** —
   without the table nobody counts as signed in.
2. Remove the old `REGISTRATION_CODE` from the deploy environment (unused).
3. Supabase → Auth → URL Configuration: Site URL = production domain; add
   `https://<domain>/**` and preview URLs to the redirect allow-list.
4. SMTP first: Resend (or Postmark) with a verified sending domain +
   SPF/DKIM; Supabase → Auth → SMTP Settings; raise the email rate limit. The
   built-in mailer sends ~2 emails/hour, which open registration outgrows.
5. Supabase → Auth → Email Templates: paste `supabase/templates/sign-in-code.html`
   into **Magic Link** (forgot password) and **Confirm signup** (new accounts).
   The defaults only contain a link, not `{{ .Token }}`.
6. Supabase → Authentication → Sign In / Providers → Email: turn **on**
   "Confirm email" so new accounts must prove their address. The app also
   works with it off (no confirmation step).
7. Google: create an OAuth client (Google Cloud Console → Credentials), redirect
   URI `https://<project-ref>.supabase.co/auth/v1/callback`; enable the Google
   provider in Supabase; set `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`.
8. Optional Turnstile: create a widget at Cloudflare, put the secret in
   Supabase → Auth → Bot and Abuse Protection, set
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

Locally, `supabase/config.toml` already wires the template; mail lands in
Mailpit at http://127.0.0.1:54324.
