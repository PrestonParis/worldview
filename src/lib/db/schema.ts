import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
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
