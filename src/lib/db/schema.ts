import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  check,
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

// Coarse donor kind. FEC `entity_type` (IND / PAC / PTY / CCM / COM / ORG)
// maps onto this; `super_pac` can't be told apart from `pac` by entity_type
// alone (needs the committee's designation), so it's only ever set by a
// future importer that also fetches committee metadata. Nullable — rows
// imported before Phase 2, and hand-entered rows, leave it unset.
export const contributionTypeEnum = pgEnum("contribution_type", [
  "individual",
  "pac",
  "super_pac",
  "party",
  "committee",
  "other",
]);

export const contributions = pgTable(
  "contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Both reference Entity nodes in Neo4j by id — same non-FK convention
    // as bills.sponsorEntityId / claims.speakerEntityId.
    donorEntityId: uuid("donor_entity_id").notNull(),
    recipientEntityId: uuid("recipient_entity_id").notNull(),
    // Whole currency units (e.g. dollars), not cents — political donation
    // data is reported in whole units in practice, avoiding both float
    // precision issues and numeric-as-string plumbing for a scale where
    // exact-cent precision isn't meaningful.
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("USD"),
    date: timestamp("date", { withTimezone: true }).notNull(),
    sourceRecordId: uuid("source_record_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    contributionType: contributionTypeEnum("contribution_type"),
    // Denormalized from the donor's FEC filing address (per-contribution,
    // not an entity property) — powers the /money/map choropleth without a
    // cross-store join per row. donor_industry is the exception: it *is* an
    // entity property, frozen here at import time so industry aggregation
    // stays single-store SQL. Re-stamp with scripts/backfill-donor-fields.mjs
    // when a donor's classification changes.
    donorState: text("donor_state"),
    donorCity: text("donor_city"),
    donorZip: text("donor_zip"),
    donorIndustry: text("donor_industry"),
    // FEC individual-schedule fields — null for organizational contributions.
    employer: text("employer"),
    occupation: text("occupation"),
    // Idempotency key for imported rows (e.g. FEC's schedule_a `sub_id`) —
    // null for anything entered by hand through /data/contributions, which
    // never sets it. Lets an import script re-run safely via ON CONFLICT.
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("contributions_donor_entity_id_idx").on(table.donorEntityId),
    index("contributions_recipient_entity_id_idx").on(table.recipientEntityId),
    index("contributions_donor_state_idx").on(table.donorState),
    index("contributions_donor_industry_idx").on(table.donorIndustry),
    uniqueIndex("contributions_external_id_idx").on(table.externalId),
  ],
);

// Per-candidate, per-cycle campaign-finance totals from FEC
// `/candidate/{id}/totals/`. One cheap call each; powers the /money
// leaderboard (Phase 8) without needing the contribution graph legible.
// `entityId` is a `politician` Entity ref (non-FK, same convention).
// Amounts are whole USD as `bigint` — a hot Senate race clears int4.
export const candidateFinance = pgTable(
  "candidate_finance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").notNull(),
    cycle: integer("cycle").notNull(),
    fecCandidateId: text("fec_candidate_id"),
    party: text("party"),
    office: text("office"), // "H" | "S" | "P"
    state: text("state"),
    district: text("district"),
    incumbentChallenge: text("incumbent_challenge"), // "I" | "C" | "O"
    totalReceipts: bigint("total_receipts", { mode: "number" }),
    totalDisbursements: bigint("total_disbursements", { mode: "number" }),
    cashOnHand: bigint("cash_on_hand", { mode: "number" }),
    debtsOwed: bigint("debts_owed", { mode: "number" }),
    individualContributions: bigint("individual_contributions", { mode: "number" }),
    pacContributions: bigint("pac_contributions", { mode: "number" }),
    partyContributions: bigint("party_contributions", { mode: "number" }),
    coverageEndDate: timestamp("coverage_end_date", { withTimezone: true }),
    sourceRecordId: uuid("source_record_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    // "{fecCandidateId}-{cycle}" — idempotency key for the importer's upsert.
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("candidate_finance_entity_idx").on(table.entityId),
    index("candidate_finance_cycle_idx").on(table.cycle),
    uniqueIndex("candidate_finance_external_id_idx").on(table.externalId),
  ],
);

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
    // claims.speakerEntityId. Nullable: the Congress.gov importer keeps a
    // bill whose sponsor didn't resolve to an entity rather than dropping
    // it (at full-Congress scope a silent skip distorts every count).
    sponsorEntityId: uuid("sponsor_entity_id"),
    // Congress number (e.g. 119) and the identifiers behind `externalId`
    // ("{congress}-{type}-{number}", e.g. "119-hr-1234"). `externalId` is
    // the idempotency key for the importer's upsert — null for bills added
    // by hand through /data/bills.
    congress: integer("congress"),
    externalId: text("external_id"),
    // Congress.gov policy area + subject terms (one per line, the
    // `entities.highlights` convention). Empty for hand-entered bills.
    policyArea: text("policy_area"),
    subjects: text("subjects"),
    latestActionDate: timestamp("latest_action_date", { withTimezone: true }),
    latestActionText: text("latest_action_text"),
    // The import run's `sources` row; set null if that source is deleted,
    // same as claims.sourceId.
    sourceId: uuid("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    // Last time the importer touched this row — drives the freshness line.
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bills_sponsor_entity_id_idx").on(table.sponsorEntityId),
    index("bills_congress_idx").on(table.congress),
    uniqueIndex("bills_external_id_idx").on(table.externalId),
  ],
);

export const rollCalls = pgTable(
  "roll_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable: most roll calls are on a bill, but procedural and
    // nomination votes aren't. Cascade so removing a bill removes its roll
    // calls (and, in turn, their votes).
    billId: uuid("bill_id").references(() => bills.id, { onDelete: "cascade" }),
    congress: integer("congress").notNull(),
    // "House" | "Senate" — free text, like bills.chamber.
    chamber: text("chamber").notNull(),
    session: integer("session"),
    rollNumber: integer("roll_number").notNull(),
    // "On Passage", "On the Cloture Motion", "On the Nomination", …
    question: text("question"),
    voteType: text("vote_type"),
    result: text("result"),
    date: timestamp("date", { withTimezone: true }).notNull(),
    // Upstream vote id (e.g. "h119-45" / "s119-12") — the importer's
    // idempotency key.
    externalId: text("external_id"),
    sourceId: uuid("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("roll_calls_bill_id_idx").on(table.billId),
    index("roll_calls_congress_chamber_idx").on(table.congress, table.chamber),
    uniqueIndex("roll_calls_external_id_idx").on(table.externalId),
  ],
);

export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable now: a vote either belongs to a roll call (rollCallId set,
    // billId copied from the roll call when it has one) or is a bill-level
    // tally entered by hand through /data/bills (billId set, rollCallId
    // null). The check constraint below requires at least one.
    billId: uuid("bill_id").references(() => bills.id, { onDelete: "cascade" }),
    rollCallId: uuid("roll_call_id").references(() => rollCalls.id, {
      onDelete: "cascade",
    }),
    // Same convention — references a politician Entity in Neo4j.
    voterEntityId: uuid("voter_entity_id").notNull(),
    position: votePositionEnum("position").notNull(),
    // The voter's party at the time of the vote — snapshot from the
    // congress-legislators crosswalk by the roll-call importer. Null for
    // hand-entered votes.
    party: text("party"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("votes_bill_id_idx").on(table.billId),
    index("votes_roll_call_id_idx").on(table.rollCallId),
    index("votes_voter_entity_id_idx").on(table.voterEntityId),
    check(
      "votes_bill_or_roll_call",
      sql`${table.billId} is not null or ${table.rollCallId} is not null`,
    ),
    // One position per person per hand-entered bill-level tally…
    uniqueIndex("votes_bill_voter_unique")
      .on(table.billId, table.voterEntityId)
      .where(sql`${table.rollCallId} is null`),
    // …and one per person per roll call. (Splitting the old single unique
    // index this way is the one Phase 1 migration that needs care — but
    // every existing row has roll_call_id null, so the first partial index
    // covers exactly what the old one did.)
    uniqueIndex("votes_roll_call_voter_unique")
      .on(table.rollCallId, table.voterEntityId)
      .where(sql`${table.rollCallId} is not null`),
  ],
);

// ── Bill Explorer detail tables (Legislation & Courts, Phase 2) ───────────
// All hang off a bill with onDelete cascade; all populated by the
// Congress.gov importer (which replaces a bill's rows wholesale on each
// run) and hand-editable via /data/bills/[id]/edit. Same Neo4j-entity-by-
// -uuid convention for member references as bills.sponsorEntityId.

export const billCosponsors = pgTable(
  "bill_cosponsors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").notNull(),
    date: timestamp("date", { withTimezone: true }),
    isOriginal: boolean("is_original").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("bill_cosponsors_bill_id_idx").on(table.billId),
    index("bill_cosponsors_entity_id_idx").on(table.entityId),
    uniqueIndex("bill_cosponsors_bill_entity_unique").on(table.billId, table.entityId),
  ],
);

export const billActions = pgTable(
  "bill_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    chamber: text("chamber"),
    text: text("text").notNull(),
    actionType: text("action_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("bill_actions_bill_id_date_idx").on(table.billId, table.date)],
);

export const billCommittees = pgTable(
  "bill_committees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    chamber: text("chamber"),
    activity: text("activity"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("bill_committees_bill_id_idx").on(table.billId)],
);

export const billRelations = pgTable(
  "bill_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    // The related bill's own external id ("119-hr-5"); resolved to a real
    // row in `relatedBillId` when we've imported it, else just shown by
    // number/title.
    relatedExternalId: text("related_external_id"),
    relatedBillId: uuid("related_bill_id").references((): AnyPgColumn => bills.id, {
      onDelete: "set null",
    }),
    relatedBillNumber: text("related_bill_number"),
    relatedTitle: text("related_title"),
    relationshipType: text("relationship_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("bill_relations_bill_id_idx").on(table.billId),
    uniqueIndex("bill_relations_bill_related_unique").on(
      table.billId,
      table.relatedExternalId,
    ),
  ],
);

export const billTextVersions = pgTable(
  "bill_text_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    versionType: text("version_type"),
    date: timestamp("date", { withTimezone: true }),
    format: text("format"),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("bill_text_versions_bill_id_idx").on(table.billId)],
);

export const billsRelations = relations(bills, ({ many, one }) => ({
  votes: many(votes),
  rollCalls: many(rollCalls),
  cosponsors: many(billCosponsors),
  actions: many(billActions),
  committees: many(billCommittees),
  relatedBills: many(billRelations),
  textVersions: many(billTextVersions),
  source: one(sources, { fields: [bills.sourceId], references: [sources.id] }),
}));
export const rollCallsRelations = relations(rollCalls, ({ one, many }) => ({
  bill: one(bills, { fields: [rollCalls.billId], references: [bills.id] }),
  votes: many(votes),
}));
export const votesRelations = relations(votes, ({ one }) => ({
  bill: one(bills, { fields: [votes.billId], references: [bills.id] }),
  rollCall: one(rollCalls, {
    fields: [votes.rollCallId],
    references: [rollCalls.id],
  }),
}));
export const billCosponsorsRelations = relations(billCosponsors, ({ one }) => ({
  bill: one(bills, { fields: [billCosponsors.billId], references: [bills.id] }),
}));
export const billActionsRelations = relations(billActions, ({ one }) => ({
  bill: one(bills, { fields: [billActions.billId], references: [bills.id] }),
}));
export const billCommitteesRelations = relations(billCommittees, ({ one }) => ({
  bill: one(bills, { fields: [billCommittees.billId], references: [bills.id] }),
}));
export const billRelationsRelations = relations(billRelations, ({ one }) => ({
  bill: one(bills, { fields: [billRelations.billId], references: [bills.id] }),
}));
export const billTextVersionsRelations = relations(billTextVersions, ({ one }) => ({
  bill: one(bills, { fields: [billTextVersions.billId], references: [bills.id] }),
}));

// ── Lobbying (Money & Influence, Phase 5) ─────────────────────────────────
// One Senate LDA filing = one registration. `client` (the org that hired
// lobbyists) and `registrant` (the lobbying firm) are Neo4j Entity refs,
// same non-FK convention as contributions.donorEntityId. `amount` is the
// filing's reported income OR expenses in whole USD (which one is in
// `amountKind`); nullable because many filings report neither or "less than
// $5,000".
export const lobbyingRegistrations = pgTable(
  "lobbying_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientEntityId: uuid("client_entity_id").notNull(),
    registrantEntityId: uuid("registrant_entity_id").notNull(),
    year: integer("year").notNull(),
    // LDA filing_period, e.g. "first_quarter", "year_end" — free text.
    period: text("period"),
    amount: integer("amount"),
    // "income" (client→firm engagements) | "expenses" (in-house lobbying) | null
    amountKind: text("amount_kind"),
    sourceRecordId: uuid("source_record_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    // LDA filing_uuid — idempotency key for the importer, null for
    // hand-entered rows.
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lobbying_registrations_client_idx").on(table.clientEntityId),
    index("lobbying_registrations_registrant_idx").on(table.registrantEntityId),
    index("lobbying_registrations_year_idx").on(table.year),
    uniqueIndex("lobbying_registrations_external_id_idx").on(table.externalId),
  ],
);

// The issues / bills named on one registration's lobbying activities.
export const lobbyingIssues = pgTable(
  "lobbying_issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => lobbyingRegistrations.id, { onDelete: "cascade" }),
    // LDA general_issue_code, e.g. "TAX", "DEF", "HCR".
    issueCode: text("issue_code"),
    issueLabel: text("issue_label"),
    // Best-effort link to a known bill (bill number parsed out of the
    // activity description); nullable and usually null.
    billId: uuid("bill_id").references(() => bills.id, { onDelete: "set null" }),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("lobbying_issues_registration_idx").on(table.registrationId),
    index("lobbying_issues_bill_idx").on(table.billId),
  ],
);

export const lobbyingRegistrationsRelations = relations(
  lobbyingRegistrations,
  ({ many }) => ({ issues: many(lobbyingIssues) }),
);
export const lobbyingIssuesRelations = relations(lobbyingIssues, ({ one }) => ({
  registration: one(lobbyingRegistrations, {
    fields: [lobbyingIssues.registrationId],
    references: [lobbyingRegistrations.id],
  }),
  bill: one(bills, { fields: [lobbyingIssues.billId], references: [bills.id] }),
}));

// Generic import-run log, written by every legislation importer (and, in
// later phases, the courts importers). Drives the "last synced" freshness
// line and lets an incremental run resume from `cursor`.
export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // "congress-bills" | "congress-votes" | … — free text, one per importer.
    source: text("source").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    // "ok" | "error" | "partial"
    status: text("status").notNull().default("ok"),
    rowsInserted: integer("rows_inserted").notNull().default(0),
    rowsUpdated: integer("rows_updated").notNull().default(0),
    rowsSkipped: integer("rows_skipped").notNull().default(0),
    error: text("error"),
    // High-water mark for the next incremental run (e.g. the max
    // updateDate processed). Opaque string, owned by each importer.
    cursor: text("cursor"),
  },
  (table) => [index("sync_runs_source_started_at_idx").on(table.source, table.startedAt)],
);

export const electionLevelEnum = pgEnum("election_level", [
  "federal",
  "state",
  "local",
]);

export const electionTypeEnum = pgEnum("election_type", [
  "general",
  "primary",
  "runoff",
  "special",
]);

export const electionStatusEnum = pgEnum("election_status", [
  "scheduled",
  "provisional",
  "certified",
]);

export const elections = pgTable(
  "elections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Free text, like bills.chamber — offices vary by country and level
    // (President, U.S. Senate, Governor, Mayor, ballot measure…) and aren't
    // worth a fixed enum.
    office: text("office").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    level: electionLevelEnum("level").notNull().default("federal"),
    electionType: electionTypeEnum("election_type").notNull().default("general"),
    status: electionStatusEnum("status").notNull().default("certified"),
    electionDate: timestamp("election_date", { withTimezone: true }).notNull(),
    // Denormalized turnout — optional, and not necessarily the sum of
    // candidacy vote counts (write-ins, undervotes, blank ballots).
    totalVotes: integer("total_votes"),
    // The comparable prior race (the 2020 result behind a 2024 one) — powers
    // the Phase 3 swing map. Self-reference; same spirit as
    // claims.contradictsClaimId.
    priorElectionId: uuid("prior_election_id").references(
      (): AnyPgColumn => elections.id,
      { onDelete: "set null" },
    ),
    // Primary → general linkage.
    parentElectionId: uuid("parent_election_id").references(
      (): AnyPgColumn => elections.id,
      { onDelete: "set null" },
    ),
    // Idempotency key for imported rows (e.g.
    // "medsl:countypres:2020:US:president") — null for anything entered by
    // hand through /data/elections. Lets an import script re-run safely.
    externalId: text("external_id"),
    // Election year, denormalized from electionDate so "the current cycle"
    // is a cheap indexed lookup. Filled by every importer; nullable only for
    // legacy hand rows.
    cycle: integer("cycle"),
    // True when no incumbent is seeking re-election (retirement, term limit,
    // new seat). Drives the "OPEN SEAT" treatment in the cycle dashboard.
    openSeat: boolean("open_seat").notNull().default(false),
    // U.S. Senate class (1/2/3); null for every other office.
    seatClass: integer("seat_class"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("elections_external_id_idx").on(table.externalId),
    index("elections_election_date_idx").on(table.electionDate),
    index("elections_cycle_idx").on(table.cycle),
  ],
);

export const candidacies = pgTable(
  "candidacies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    electionId: uuid("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    // References a `politician`-type Entity node in Neo4j. Not a foreign key
    // — same convention as bills.sponsorEntityId / votes.voterEntityId.
    candidateEntityId: uuid("candidate_entity_id").notNull(),
    // Free text, like elections.office — party systems vary by country and era.
    party: text("party"),
    incumbent: boolean("incumbent").notNull().default(false),
    withdrew: boolean("withdrew").notNull().default(false),
    votes: integer("votes"),
    won: boolean("won").notNull().default(false),
    // Where this candidacy is in the cycle: "filed" (statement of candidacy
    // on file) → "primary_winner" / "nominee" → or "withdrew" /
    // "lost_primary". Free text, null for historical rows. Drives which
    // candidacies the general-election views show.
    status: text("status"),
    // FEC candidate id (e.g. "S6OH00163") — links this candidacy to its
    // campaign-finance row in candidate_finance without a name match.
    fecCandidateId: text("fec_candidate_id"),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("candidacies_election_id_idx").on(table.electionId),
    index("candidacies_candidate_entity_id_idx").on(table.candidateEntityId),
    index("candidacies_fec_candidate_id_idx").on(table.fecCandidateId),
    uniqueIndex("candidacies_election_candidate_unique").on(
      table.electionId,
      table.candidateEntityId,
    ),
    uniqueIndex("candidacies_external_id_idx").on(table.externalId),
  ],
);

export const resultAreaKindEnum = pgEnum("result_area_kind", [
  "county",
  "precinct",
  "district",
  "state",
]);

// Geographic breakdown of an election's returns — one row per (candidacy,
// area). `areaId` is the FIPS / GEOID that also keys the map GeoJSON
// feature (see public/data/us-counties.geojson), so the choropleth joins
// with no cross-store lookup. Populated by scripts/import-county-results.mjs,
// not by hand.
export const electionResults = pgTable(
  "election_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    electionId: uuid("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    candidacyId: uuid("candidacy_id")
      .notNull()
      .references(() => candidacies.id, { onDelete: "cascade" }),
    areaKind: resultAreaKindEnum("area_kind").notNull().default("county"),
    areaId: text("area_id").notNull(),
    areaName: text("area_name"),
    votes: integer("votes").notNull(),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("election_results_election_id_idx").on(table.electionId),
    index("election_results_area_id_idx").on(table.areaId),
    uniqueIndex("election_results_candidacy_area_unique").on(
      table.candidacyId,
      table.areaKind,
      table.areaId,
    ),
    uniqueIndex("election_results_external_id_idx").on(table.externalId),
  ],
);

// Race handicapper ratings (Sabato, Cook, CNALYSIS, …). Each import stamps
// a dated row so the detail page can show "moved Lean R → Tossup on <date>";
// the dashboard reads the latest per (election, source).
export const raceRatingEnum = pgEnum("race_rating", [
  "safe_d",
  "likely_d",
  "lean_d",
  "tossup",
  "lean_r",
  "likely_r",
  "safe_r",
  "safe_i",
]);

export const raceRatings = pgTable(
  "race_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    electionId: uuid("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    rating: raceRatingEnum("rating").notNull(),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    url: text("url"),
    notes: text("notes"),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("race_ratings_election_id_idx").on(table.electionId),
    uniqueIndex("race_ratings_election_source_asof_unique").on(
      table.electionId,
      table.source,
      table.asOf,
    ),
    uniqueIndex("race_ratings_external_id_idx").on(table.externalId),
  ],
);

export const electionsRelations = relations(elections, ({ many }) => ({
  candidacies: many(candidacies),
  results: many(electionResults),
  ratings: many(raceRatings),
}));

export const raceRatingsRelations = relations(raceRatings, ({ one }) => ({
  election: one(elections, {
    fields: [raceRatings.electionId],
    references: [elections.id],
  }),
}));

export const candidaciesRelations = relations(candidacies, ({ one, many }) => ({
  election: one(elections, {
    fields: [candidacies.electionId],
    references: [elections.id],
  }),
  results: many(electionResults),
}));

export const electionResultsRelations = relations(electionResults, ({ one }) => ({
  election: one(elections, {
    fields: [electionResults.electionId],
    references: [elections.id],
  }),
  candidacy: one(candidacies, {
    fields: [electionResults.candidacyId],
    references: [candidacies.id],
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
