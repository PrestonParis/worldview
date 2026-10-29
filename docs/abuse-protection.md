# Production abuse protection

Worldview uses Vercel's firewall as the outer bot filter and application-level
controls for clients that pass the browser challenge.

## Application controls

- `src/lib/security/rate-limit.ts` stores atomic fixed-window counters in the
  primary Postgres database. Identifiers are salted SHA-256 hashes; raw IP
  addresses are not retained.
- Anonymous quiz creation requires Cloudflare Turnstile in production and is
  limited per connection. A verified editable retake or signed-in user does
  not need a second challenge.
- Authentication email actions, including account email changes, require
  Turnstile and have per-connection, per-address, and (where signed in)
  per-account limits.
- Government lookups, search, public data, crime details, ingestion, partner
  publishing, telemetry, session checks, and cache revalidation have separate
  cost budgets.
- Exact-address requests are coalesced only in volatile instance memory for a
  few minutes. They are not placed in a shared persistent cache.
- A guarded daily retention pass removes expired counters, opener events older
  than 90 days, and unclaimed unfinished quizzes inactive for 30 days.

## Required production configuration

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `RATE_LIMIT_SALT` (random, stable across deployments)
- Supabase Auth → Bot and Abuse Protection configured with the Turnstile secret
- Vercel firewall rules for known training crawlers kept enabled

## Alerts to configure in provider dashboards

Code cannot create account-level billing alerts. Configure these before
raising traffic limits:

- Vercel: function execution, bandwidth, firewall mitigations, and spend alerts
- Supabase: database size, connection saturation, slow queries, and Auth email volume
- Civic/geocoding providers: daily quota and error-rate alerts

Application denials are logged as `[abuse:rate-limit]` with only the scope and
retry interval. Retention runs log `[abuse:retention]`. Alert on sustained 429
rates, sudden new scopes, and repeated upstream 5xx responses.
