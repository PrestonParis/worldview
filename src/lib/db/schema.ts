import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  pgEnum,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const sourceTypeEnum = pgEnum("source_type", [
  "primary",
  "secondary",
  "transcript",
  "article",
  "filing",
  "video",
  "official_statement",
]);

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  url: text("url"),
  publisher: text("publisher"),
  sourceType: sourceTypeEnum("source_type").notNull().default("secondary"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const claims = pgTable("claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  // References an Entity node in Neo4j by id. Not a foreign key —
  // entities live in a different store, see ARCHITECTURE notes.
  speakerEntityId: uuid("speaker_entity_id").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  venue: text("venue"),
  quote: text("quote").notNull(),
  topic: text("topic"),
  positionClassification: text("position_classification"),
  confidence: integer("confidence"),
  contradictsClaimId: uuid("contradicts_claim_id").references(
    (): AnyPgColumn => claims.id,
  ),
  sourceId: uuid("source_id").references(() => sources.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sourcesRelations = relations(sources, ({ many }) => ({
  claims: many(claims),
}));

export const claimsRelations = relations(claims, ({ one }) => ({
  source: one(sources, {
    fields: [claims.sourceId],
    references: [sources.id],
  }),
}));

export const mapProjects = pgTable(
  "map_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Supabase auth.users.id — a different schema Drizzle doesn't model, so
    // no FK constraint, just an indexed plain uuid (same convention as the
    // Neo4j entity references elsewhere in this file).
    ownerId: uuid("owner_id").notNull(),
    name: text("name").notNull().default("Untitled graphic"),
    // MapViewState and Layer[] from src/lib/types.ts — the editor's own
    // state, serialized as-is rather than re-declared as SQL columns.
    mapView: jsonb("map_view").notNull(),
    layers: jsonb("layers").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("map_projects_owner_id_idx").on(table.ownerId)],
);
