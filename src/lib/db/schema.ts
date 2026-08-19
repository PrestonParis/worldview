import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
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

export const claimVerdictEnum = pgEnum("claim_verdict", [
  "true",
  "mostly_true",
  "mixed",
  "mostly_false",
  "false",
  "unsubstantiated",
]);

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
  // Fact-check verdict — deliberately separate from positionClassification
  // (the speaker's stance on a topic, used by /alignment) and set only
  // through the /fact-check workbench's dedicated action, not the general
  // claim form. NULL verdict means not yet reviewed.
  verdict: claimVerdictEnum("verdict"),
  verdictNotes: text("verdict_notes"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
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

export const billStatusEnum = pgEnum("bill_status", [
  "introduced",
  "in_committee",
  "passed_chamber",
  "passed_both_chambers",
  "enacted",
  "vetoed",
  "failed",
]);

export const votePositionEnum = pgEnum("vote_position", [
  "yea",
  "nay",
  "present",
  "absent",
]);

export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billNumber: text("bill_number").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    status: billStatusEnum("status").notNull().default("introduced"),
    // Free text, like claims.venue — legislatures vary (House/Senate,
    // unicameral assemblies, etc.), not worth a fixed enum.
    chamber: text("chamber"),
    introducedDate: timestamp("introduced_date", { withTimezone: true }).notNull(),
    // References a `politician`-type Entity node in Neo4j. Not a foreign
    // key — entities live in a different store, same convention as
    // claims.speakerEntityId.
    sponsorEntityId: uuid("sponsor_entity_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("bills_sponsor_entity_id_idx").on(table.sponsorEntityId)],
);

export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    // Same convention — references a politician Entity in Neo4j.
    voterEntityId: uuid("voter_entity_id").notNull(),
    position: votePositionEnum("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("votes_bill_id_idx").on(table.billId),
    index("votes_voter_entity_id_idx").on(table.voterEntityId),
    uniqueIndex("votes_bill_voter_unique").on(table.billId, table.voterEntityId),
  ],
);

export const billsRelations = relations(bills, ({ many }) => ({ votes: many(votes) }));
export const votesRelations = relations(votes, ({ one }) => ({
  bill: one(bills, { fields: [votes.billId], references: [bills.id] }),
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
