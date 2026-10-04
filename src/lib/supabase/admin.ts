import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS and can manage auth users. Server-only;
// never import from a client component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
