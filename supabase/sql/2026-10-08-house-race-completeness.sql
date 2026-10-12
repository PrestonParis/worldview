-- Current-member rosters omit vacant districts. Scaffold every one of the
-- 435 apportioned House seats so the election center does not silently lose
-- a race when a representative resigns or dies before Election Day.

WITH apportionment(state, seats) AS (
  VALUES
    ('AL',7),('AK',1),('AZ',9),('AR',4),('CA',52),('CO',8),('CT',5),('DE',1),('FL',28),('GA',14),
    ('HI',2),('ID',2),('IL',17),('IN',9),('IA',4),('KS',4),('KY',6),('LA',6),('ME',2),('MD',8),
    ('MA',9),('MI',13),('MN',8),('MS',4),('MO',8),('MT',2),('NE',3),('NV',4),('NH',2),('NJ',12),
    ('NM',3),('NY',26),('NC',14),('ND',1),('OH',15),('OK',5),('OR',6),('PA',17),('RI',2),('SC',7),
    ('SD',1),('TN',9),('TX',38),('UT',4),('VT',1),('VA',11),('WA',10),('WV',2),('WI',8),('WY',1)
), districts AS (
  SELECT state,
         CASE WHEN seats = 1 THEN state || '-AL' ELSE state || '-' || lpad(district::text, 2, '0') END AS jurisdiction
  FROM apportionment, LATERAL generate_series(1, seats) AS district
)
INSERT INTO elections (
  id, name, office, jurisdiction, level, election_type, status,
  election_date, cycle, open_seat, external_id, notes
)
SELECT gen_random_uuid(), jurisdiction || ' — U.S. House 2026', 'U.S. House', jurisdiction,
       'federal', 'general', 'scheduled', '2026-11-03T00:00:00Z', 2026, true,
       'cycle:2026:house:' || jurisdiction,
       'Scaffolded for the 2026 cycle; no incumbent was present in the current-member roster.'
FROM districts
ON CONFLICT (external_id) DO NOTHING;
