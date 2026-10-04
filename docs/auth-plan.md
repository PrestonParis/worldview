# Auth: sign-in & registration

Replaces the old invite-only magic link, which broke in four ways: Supabase
dashboard invites send `#access_token` fragments the `?code=` callback never
read; magic links failed when opened in a different browser than the one that
requested them (PKCE verifier); mail scanners consumed the one-time link; and
the built-in Supabase mailer only delivers ~2 emails/hour.

## How it works

- **Browsing needs no account.** Accounts own things: `/geography` graphics,
  claimed quizzes.
- **Sign-in** (`/login`): email + password. "Forgot your password?" falls
  back to a 6-digit code emailed and typed on the page (`verifyOtp`); after
  that, set a new password on `/account`. **Continue with Google** appears
  once configured.
- **Registration** (`/register`): registration code (`REGISTRATION_CODE`) +
  email + password (8–72 chars). The code is checked server side
  (`src/lib/actions/auth.ts`) before `signUp`, and the account is registered
  in the same request — no email is sent. Google registration carries the
  code across the OAuth redirect in a 30-minute signed pass cookie
  (`src/lib/auth/registration.ts`).
- **Quiz claims**: "Sign in to claim" (top of an unclaimed quiz) sends you
  through sign-in/registration and claims the quiz automatically
  (`claimAfterSignIn` in `src/lib/quiz/access.ts`), landing on the results.
- **The gate is `profiles`, not `auth.users`.** Anyone can create a Supabase
  auth user with the public anon key, so `getCurrentUser()`
  (`src/lib/auth/session.ts`) only treats a session as signed in when a
  profile row exists. `finalizeSignIn()` signs out any session without one.
  Every owner check (map projects, quiz claims) goes through it.
- **Account page** (`/account`): display name, sign-in methods, sign out, and
  delete account (removes map projects, claimed quizzes, profile, and the auth
  user via the service-role key).

## Registration code

Lives only in env: `REGISTRATION_CODE` in `.env.local`, `.env.cloud`,
`.env.local.docker`, and the deploy environment. Empty or unset = registration
closed. To rotate, change the env value; outstanding passes stop working.

## Setup checklist (cloud)

1. Apply the table: `ENV_FILE=.env.cloud node scripts/apply-sql.mjs supabase/sql/2026-10-02-profiles.sql`
   (also grandfathers every existing auth user). **Do this before deploying** —
   without the table nobody counts as signed in.
2. Set `REGISTRATION_CODE` in the deploy environment.
3. Supabase → Auth → URL Configuration: Site URL = production domain; add
   `https://<domain>/**` and preview URLs to the redirect allow-list.
4. Supabase → Authentication → Sign In / Providers → Email: turn **off**
   "Confirm email", or password sign-ups get no session.
5. Supabase → Auth → Email Templates (only used by the forgot-password code): paste `supabase/templates/sign-in-code.html`
   into **Magic Link** and **Confirm signup** (subject "Your Worldview sign-in
   code"). The defaults only contain a link, not `{{ .Token }}`.
6. SMTP: Resend (or Postmark) with a verified sending domain + SPF/DKIM;
   Supabase → Auth → SMTP Settings; raise the email rate limit.
7. Google: create an OAuth client (Google Cloud Console → Credentials), redirect
   URI `https://<project-ref>.supabase.co/auth/v1/callback`; enable the Google
   provider in Supabase; set `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`.
8. Optional Turnstile: create a widget at Cloudflare, put the secret in
   Supabase → Auth → Bot and Abuse Protection, set
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

Locally, `supabase/config.toml` already wires the template; mail lands in
Mailpit at http://127.0.0.1:54324.
