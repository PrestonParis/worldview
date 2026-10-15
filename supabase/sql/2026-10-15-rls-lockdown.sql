-- Closes the Supabase Data API (PostgREST / GraphQL) on every public table.
-- The anon key ships to every browser, and Supabase projects created before
-- its default-grant change hand the anon and authenticated roles full
-- read/write on new public tables. The app never reads data through the
-- Supabase client: all access goes through DATABASE_URL as the table owner,
-- which bypasses RLS. So: RLS on (no policies) for every table, and no table
-- or sequence grants for the API roles, now or for tables created later.
-- New tables must still ENABLE ROW LEVEL SECURITY in their own migration.

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
