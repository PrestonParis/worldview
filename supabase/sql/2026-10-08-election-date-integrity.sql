-- Correct the 2026 federal general-election date and prevent it from
-- regressing. The FEC lists Tuesday, November 3, 2026 as the regularly
-- scheduled federal general election date.

UPDATE elections
SET election_date = '2026-11-03T00:00:00Z', updated_at = now()
WHERE cycle = 2026
  AND level = 'federal'
  AND election_type = 'general'
  AND election_date::date <> DATE '2026-11-03';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'elections_2026_federal_general_date'
  ) THEN
    ALTER TABLE elections ADD CONSTRAINT elections_2026_federal_general_date
      CHECK (
        cycle <> 2026
        OR level <> 'federal'
        OR election_type <> 'general'
        OR election_date::date = DATE '2026-11-03'
      );
  END IF;
END $$;
