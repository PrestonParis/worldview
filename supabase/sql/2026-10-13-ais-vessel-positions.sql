CREATE TABLE IF NOT EXISTS "ais_vessel_positions" (
  "mmsi" text PRIMARY KEY,
  "ship_name" text,
  "call_sign" text,
  "ship_type" integer,
  "destination" text,
  "navigational_status" integer,
  "longitude" double precision NOT NULL,
  "latitude" double precision NOT NULL,
  "speed_knots" double precision,
  "course" double precision,
  "heading" integer,
  "observed_at" timestamptz NOT NULL,
  "received_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ais_vessel_positions_observed_at_idx"
  ON "ais_vessel_positions" ("observed_at");
CREATE INDEX IF NOT EXISTS "ais_vessel_positions_location_idx"
  ON "ais_vessel_positions" ("longitude", "latitude");
