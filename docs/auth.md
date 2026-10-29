# Auth: sign-in and registration

Every email the app sends is a typed code, never a link. Links broke in four
ways: Supabase dashboard invites send `#access_token` fragments the `?code=`
callback never read, links failed when opened in a different browser than the
one that requested them (PKCE verifier), mail scanners consumed one-time
links, and the built-in Supabase mailer only delivers about 2 emails an hour.

## How it works

- **Browsing needs no account.** Accounts own claimed quizzes and saved
  governments. The `/geography` studio is limited to the `OWNER_EMAIL`
  account.
- **Three ways in**, on both `/login` and `/register`:
  - **Google** — the button shows whenever the Google provider is on in
    Supabase (`src/lib/auth/providers.ts` reads the project's public
    settings); lands on `/auth/callback`.
  - **Email + password** (8–72 chars). With Supabase's "Confirm email" on, a
    new account types an emailed code before it can sign in; signing in to an
    unconfirmed account sends a fresh code.
  - **Email code, no password** ("Email me a sign-in code instead"). An
    address without an account gets one, confirmed by the same code.
- **Forgot password** emails a recovery code (`resetPasswordForEmail`, same
  answer whether or not the address has an account). The right code signs the
  account in and goes to `/reset-password` to choose a new one — its own page,
  because `/login` sends signed-in visitors on to `next`.
- **Every email is a typed code**, never a link, so mail scanners and
  other-browser opens can't break it. Resend is offered after 60 seconds.
- **Profiles**: `finalizeSignIn()` (`src/lib/auth/session.ts`) creates the
  `profiles` row on an account's first sign-in. `getCurrentUser()` only
  treats a session as signed in when that row exists.
- **Roles** (`profiles.role`): new accounts are **members** — they own their
  quizzes and saved governments. Creating, editing, or deleting shared records (entities,
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
- **Account page** (`/account`): display name; change email (code to the new
  address, plus one to the current address while "Secure email change" is
  on); set or change password; sign-in methods; sign out or sign out
  everywhere; delete account (removes map projects, claimed quizzes, profile, and the auth
  user via the service-role key).

## Setup checklist (cloud)

1. Supabase → Auth → URL Configuration: Site URL = production domain; add
   `https://<domain>/**` and preview URLs to the redirect allow-list.
2. SMTP first: Resend (or Postmark) with a verified sending domain +
   SPF/DKIM; Supabase → Auth → SMTP Settings; raise the email rate limit. The
   built-in mailer sends ~2 emails/hour, which open registration outgrows.
3. Supabase → Auth → Email Templates — each needs `{{ .Token }}` (the
   defaults only contain a link). Subjects are in `supabase/config.toml`:
   | Template                                              | File                                        |
   | ----------------------------------------------------- | ------------------------------------------- |
   | Confirm signup                                        | `supabase/templates/confirm-code.html`      |
   | Magic Link (email sign-in)                            | `supabase/templates/sign-in-code.html`      |
   | Reset Password                                        | `supabase/templates/reset-code.html`        |
   | Change Email Address                                  | `supabase/templates/email-change-code.html` |
   | Set **Email OTP Length** to 6 (cloud defaulted to 8). |
4. Supabase → Authentication → Sign In / Providers → Email: turn **on**
   "Confirm email" so new accounts must prove their address. The app also
   works with it off (no confirmation step).
5. Google: create an OAuth client (Google Cloud Console → Credentials), redirect
   URI `https://<project-ref>.supabase.co/auth/v1/callback`; enable the Google
   provider in Supabase with that client's ID + secret. The button appears on
   its own within 5 minutes.
6. Required in production: create a Turnstile widget at Cloudflare, put the
   secret in Supabase → Auth → Bot and Abuse Protection, and set both
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel.
   Email-sending actions fail closed when the public key or token is missing.
   Also set `RATE_LIMIT_SALT` to a random deployment secret so rate-limit
   identifiers stored in Postgres cannot be enumerated from IP addresses.

Locally, `supabase/config.toml` already wires the templates (restart with
`supabase stop && supabase start` after editing one); mail lands in
Mailpit at http://127.0.0.1:54324.
