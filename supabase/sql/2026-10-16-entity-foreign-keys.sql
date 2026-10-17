-- Foreign keys from every *_entity_id column to entities (2026-10-16-entities.sql),
-- now that entities live in the same database. NOT VALID: enforced for every
-- new or changed row, but existing rows aren't checked, because some
-- contributions point at donors the graph no longer has. Validate each with
-- ALTER TABLE ... VALIDATE CONSTRAINT once those rows are repaired.
--
-- Deleting an entity that still has records is refused (NO ACTION), except
-- where the reference is optional, which is cleared instead.
-- Requires the graph copy (scripts/graph-to-postgres.mjs) to have run before
-- any importer writes, or the importers' inserts will fail.

DO $$
DECLARE fk record;
BEGIN
  FOR fk IN SELECT * FROM (VALUES
    ('claims', 'speaker_entity_id', 'NO ACTION'),
    ('contributions', 'donor_entity_id', 'NO ACTION'),
    ('contributions', 'recipient_entity_id', 'NO ACTION'),
    ('candidate_finance', 'entity_id', 'CASCADE'),
    ('bills', 'sponsor_entity_id', 'SET NULL'),
    ('votes', 'voter_entity_id', 'NO ACTION'),
    ('bill_cosponsors', 'entity_id', 'NO ACTION'),
    ('lobbying_registrations', 'client_entity_id', 'NO ACTION'),
    ('lobbying_registrations', 'registrant_entity_id', 'NO ACTION'),
    ('candidacies', 'candidate_entity_id', 'NO ACTION'),
    ('member_ideology', 'entity_id', 'SET NULL'),
    ('independent_expenditures', 'spender_entity_id', 'SET NULL'),
    ('independent_expenditures', 'candidate_entity_id', 'SET NULL'),
    ('case_votes', 'justice_entity_id', 'SET NULL')
  ) AS t(tbl, col, on_delete)
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES entities (id) ON DELETE %s NOT VALID',
        fk.tbl, fk.tbl || '_' || fk.col || '_fk', fk.col, fk.on_delete
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
