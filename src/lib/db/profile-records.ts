import { cache } from "react";
import { sql } from "drizzle-orm";
import { db } from "./client";
import { getEntitiesByIds } from "./entities";
import { getEntityContributionSummary } from "./contributions";
import { listEntityTraits } from "./traits";
import { listLobbyingForEntity } from "./lobbying";
import { publicEntityPath } from "../people/public";
import { editorialProfile, type EditorialProfile } from "../people/profile";
import {
  eventCategories,
  parseEditorial,
  toRecipientKind,
  type ContributionRecord,
  type EntitySummary,
  type EventCategory,
  type EventRecord,
  type FactRecord,
  type FlowRecord,
  type OutsideSpending,
  type ProfileEditorial,
  type RecordStatus,
  type RelationshipRecord,
  type SourceKind,
  type SourceRecord,
  type StatementRecord,
} from "../people/profile-model";
import type { EntityContributionSummary } from "../money";
import type { TraitRow } from "../people/traits";
import type { LobbyingRegistration } from "../validation/lobbying";
import type { Entity } from "../validation/entity";

// Everything a profile shows, loaded once per request (React cache) and
// shared by the profile layout and whichever tab is open.

export interface ProfileBundle {
  entity: Entity;
  editorial: ProfileEditorial | null;
  /** Pre-dossier editorial copy in entities.metadata.profile. */
  legacy: EditorialProfile | null;
  facts: FactRecord[];
  relationships: RelationshipRecord[];
  events: EventRecord[];
  statements: StatementRecord[];
  given: ContributionRecord[];
  received: EntityContributionSummary;
  /** For candidates: their campaign committees' reported receipts per cycle (FEC weball). */
  campaign: CampaignTotal[];
  flows: FlowRecord[];
  /** For candidates: independent expenditures in their races, and who funded those committees. */
  outside: OutsideSpending[];
  /** LDA filings where this entity is the client or the registrant firm. */
  lobbying: LobbyingRegistration[];
  traits: TraitRow[];
  sources: Map<string, SourceRecord>;
  sourceIdByKey: Map<string, string>;
  entities: Map<string, EntitySummary>;
  freshness: { editorialReviewedAt: string; sourcesVerifiedAt: string; financeSyncedAt: string };
}

export interface CampaignTotal {
  cycle: number;
  office: string;
  totalReceipts: number;
}

type Row = Record<string, unknown>;
const run = async (query: ReturnType<typeof sql>): Promise<Row[]> => (await db.execute(query)).rows as Row[];
const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => Number(v ?? 0);
const day = (v: unknown) => (v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const uuidArray = (ids: string[]) => sql`${`{${ids.join(",")}}`}::uuid[]`;
const textArray = (values: string[]) => sql`${`{${values.map((v) => `"${v.replaceAll('"', '\\"')}"`).join(",")}}`}::text[]`;

async function evidenceFor(recordType: string, ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!ids.length) return out;
  for (const r of await run(
    sql`select record_id, source_id from record_evidence where record_type = ${recordType} and record_id = any(${uuidArray(ids)})`,
  )) {
    const id = s(r.record_id);
    out.set(id, [...(out.get(id) ?? []), s(r.source_id)]);
  }
  return out;
}

function toStatus(v: unknown): RecordStatus {
  return v === "disputed" || v === "unresolved" ? v : "verified";
}

async function loadRelationships(entityId: string): Promise<RelationshipRecord[]> {
  const rows = await run(
    sql`select * from entity_edges where source_entity_id = ${entityId} or target_entity_id = ${entityId}`,
  );
  const evidence = await evidenceFor("edge", rows.map((r) => s(r.id)));
  return rows.map((r) => ({
    id: s(r.id),
    sourceEntityId: s(r.source_entity_id),
    targetEntityId: s(r.target_entity_id),
    relType: s(r.rel_type),
    label: s(r.label),
    role: s(r.role),
    validFrom: s(r.valid_from),
    validTo: s(r.valid_to),
    notes: s(r.notes),
    status: toStatus(r.status),
    prominence: n(r.prominence),
    sourceIds: evidence.get(s(r.id)) ?? (r.source_record_id ? [s(r.source_record_id)] : []),
  }));
}

async function loadEvents(entityId: string): Promise<EventRecord[]> {
  const rows = await run(
    sql`select * from entity_events
        where subject_entity_id = ${entityId}
           or id in (select event_id from entity_event_participants where entity_id = ${entityId})`,
  );
  const ids = rows.map((r) => s(r.id));
  const [evidence, participants] = await Promise.all([
    evidenceFor("event", ids),
    ids.length
      ? run(sql`select event_id, entity_id, role from entity_event_participants where event_id = any(${uuidArray(ids)})`)
      : Promise.resolve([]),
  ]);
  const byEvent = new Map<string, { entityId: string; role: string }[]>();
  for (const p of participants) {
    const id = s(p.event_id);
    byEvent.set(id, [...(byEvent.get(id) ?? []), { entityId: s(p.entity_id), role: s(p.role) }]);
  }
  return rows.map((r) => ({
    id: s(r.id),
    key: s(r.event_key),
    subjectEntityId: s(r.subject_entity_id),
    dateStart: s(r.date_start),
    dateEnd: s(r.date_end),
    title: s(r.title),
    summary: s(r.summary),
    category: (eventCategories as readonly string[]).includes(s(r.category)) ? (s(r.category) as EventCategory) : "career",
    significance: Math.min(3, Math.max(1, n(r.significance))) as 1 | 2 | 3,
    chapterKey: s(r.chapter_key),
    status: toStatus(r.status),
    statusNote: s(r.status_note),
    participants: byEvent.get(s(r.id)) ?? [],
    sourceIds: evidence.get(s(r.id)) ?? [],
  }));
}

async function loadGiving(entityId: string): Promise<{ given: ContributionRecord[]; flows: FlowRecord[] }> {
  const rows = await run(
    sql`select id, donor_entity_id, recipient_entity_id, amount, date, cycle, recipient_kind, recipient_party,
               committee_id, receipt_type, memo_code, source_record_id, notes
        from contributions where donor_entity_id = ${entityId} and currency = 'USD' order by date`,
  );
  const given: ContributionRecord[] = rows.map((r) => {
    const date = day(r.date);
    return {
      id: s(r.id),
      donorEntityId: s(r.donor_entity_id),
      recipientEntityId: s(r.recipient_entity_id),
      amount: n(r.amount),
      date,
      // Rows from older importers carry no cycle; FEC cycles end in even years.
      cycle: n(r.cycle) || Math.ceil(Number(date.slice(0, 4)) / 2) * 2,
      kind: toRecipientKind(r.recipient_kind),
      party: s(r.recipient_party),
      committeeId: s(r.committee_id),
      receiptType: s(r.receipt_type),
      memo: r.memo_code === "X",
      sourceId: s(r.source_record_id),
      matchBasis: /Identity match: (\w+)/.exec(s(r.notes))?.[1] ?? "",
    };
  });

  // Independent expenditures by committees the subject funded, limited to the
  // cycles in which the subject gave to them.
  const funded = new Map<string, { entityId: string; cycles: Set<number> }>();
  for (const g of given) {
    if (g.memo || !g.committeeId || !["super_pac", "hybrid_pac", "pac"].includes(g.kind)) continue;
    const f = funded.get(g.committeeId) ?? { entityId: g.recipientEntityId, cycles: new Set<number>() };
    f.cycles.add(g.cycle);
    funded.set(g.committeeId, f);
  }
  if (!funded.size) return { given, flows: [] };
  const flowRows = await run(
    sql`select m.committee_id, m.cycle, m.kind, m.candidate_id, m.total, f.name candidate_name, i.entity_id candidate_entity_id
        from money_flows m
        left join fec_candidates f on f.candidate_id = m.candidate_id
        left join entity_identifiers i on i.scheme = 'fec_candidate' and i.value = m.candidate_id
        where m.committee_id = any(${textArray([...funded.keys()])}) and m.kind in ('ie_support', 'ie_oppose')
        order by m.total desc`,
  );
  const flows = flowRows.flatMap((r): FlowRecord[] => {
    const f = funded.get(s(r.committee_id));
    if (!f || !f.cycles.has(n(r.cycle))) return [];
    return [
      {
        committeeId: s(r.committee_id),
        committeeEntityId: f.entityId,
        cycle: n(r.cycle),
        supportOppose: r.kind === "ie_support" ? "support" : "oppose",
        candidateId: s(r.candidate_id),
        candidateName: s(r.candidate_name),
        candidateEntityId: s(r.candidate_entity_id),
        total: n(r.total),
      },
    ];
  });
  return { given, flows };
}

// The recipient's side of the same flow records: committees that spent in
// this candidate's races, joined to the itemized donors those committees
// reported in the same cycle.
async function loadOutsideSpending(entityId: string): Promise<OutsideSpending[]> {
  const rows = await run(
    sql`select m.committee_id, m.cycle, m.kind, m.candidate_id, m.total, c.name committee_name, ci.entity_id committee_entity_id
        from entity_identifiers i
        join money_flows m on m.candidate_id = i.value and m.kind in ('ie_support', 'ie_oppose')
        left join fec_committees c on c.committee_id = m.committee_id
        left join entity_identifiers ci on ci.scheme = 'fec_committee' and ci.value = m.committee_id
        where i.entity_id = ${entityId} and i.scheme = 'fec_candidate' and m.total >= 100000
        order by m.total desc limit 24`,
  );
  if (!rows.length) return [];
  const committees = [...new Set(rows.map((r) => s(r.committee_id)))];
  const donors = await run(
    sql`select committee_id, cycle, donor_entity_id, sum(amount) total from contributions
        where committee_id = any(${textArray(committees)}) and coalesce(memo_code, '') <> 'X'
        group by 1, 2, 3 order by total desc`,
  );
  return rows.map((r) => ({
    committeeId: s(r.committee_id),
    committeeEntityId: s(r.committee_entity_id),
    committeeName: s(r.committee_name),
    cycle: n(r.cycle),
    supportOppose: r.kind === "ie_support" ? ("support" as const) : ("oppose" as const),
    candidateId: s(r.candidate_id),
    candidateName: "",
    candidateEntityId: entityId,
    total: n(r.total),
    topDonors: donors
      .filter((d) => s(d.committee_id) === s(r.committee_id) && n(d.cycle) === n(r.cycle))
      .slice(0, 3)
      .map((d) => ({ entityId: s(d.donor_entity_id), total: n(d.total) })),
  }));
}

async function loadStatements(entityId: string): Promise<StatementRecord[]> {
  const rows = await run(sql`select * from claims where speaker_entity_id = ${entityId} order by date`);
  return rows.map((r) => ({
    id: s(r.id),
    key: s(r.claim_key).split(":").at(-1) ?? "",
    issue: s(r.issue) || s(r.topic) || "Other",
    date: day(r.date),
    datePrecision: r.date_precision === "year" || r.date_precision === "month" ? r.date_precision : "day",
    venue: s(r.venue),
    quote: s(r.quote),
    summary: s(r.summary),
    stanceKind: r.stance_kind === "reported" || r.stance_kind === "interpretation" ? r.stance_kind : "explicit",
    verbatim: r.verbatim !== false,
    sourceId: s(r.source_id),
  }));
}

function toSource(r: Row): SourceRecord {
  return {
    id: s(r.id),
    key: s(r.source_key),
    title: s(r.title),
    url: s(r.url),
    publisher: s(r.publisher),
    author: s(r.author),
    kind: s(r.source_type) as SourceKind,
    publishedAt: day(r.published_at),
    accessedAt: day(r.accessed_at),
    documentId: s(r.document_id),
    repeatsKey: s(r.repeats_source_key),
    notes: s(r.notes),
  };
}

function summarize(entity: Entity): EntitySummary {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    href: publicEntityPath(entity),
    imageUrl: entity.imageUrl ?? "",
    description: entity.description ?? "",
  };
}

function editorialSourceKeys(editorial: ProfileEditorial | null): string[] {
  if (!editorial) return [];
  const keys = [
    ...editorial.roles.flatMap((r) => r.sources),
    ...editorial.chapters.flatMap((c) => [...c.body.matchAll(/\[\[([^\]]+)\]\]/g)].flatMap((m) => m[1].split(","))),
    ...editorial.ideas.traditions.flatMap((t) => t.sources),
    ...editorial.ideas.influences.flatMap((i) => i.sources),
    ...editorial.ideas.works.map((w) => w.source),
  ];
  return [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
}

export const loadProfileBundle = cache(async (entity: Entity): Promise<ProfileBundle> => {
  const id = entity.id;
  const [profileRows, factRows, events, statements, giving, received, traits, outside, lobbying, campaignRows] = await Promise.all([
    run(sql`select * from entity_profiles where entity_id = ${id}`),
    run(sql`select * from entity_facts where entity_id = ${id} order by sort`),
    loadEvents(id),
    loadStatements(id),
    loadGiving(id),
    getEntityContributionSummary(id),
    listEntityTraits(id).catch(() => []),
    entity.type === "politician" ? loadOutsideSpending(id) : Promise.resolve([]),
    listLobbyingForEntity(id).catch(() => []),
    entity.type === "politician"
      ? run(sql`select cycle, office, total_receipts from candidate_finance where entity_id = ${id} and total_receipts > 0 order by cycle`)
      : Promise.resolve([]),
  ]);
  const campaign: CampaignTotal[] = campaignRows.map((r) => ({ cycle: n(r.cycle), office: s(r.office), totalReceipts: n(r.total_receipts) }));
  const p = profileRows[0];
  const editorial = p
    ? parseEditorial({
        summary: s(p.summary),
        roles: p.roles,
        chapters: p.chapters,
        ideas: p.ideas,
        coverage: p.coverage,
        editorialReviewedAt: day(p.editorial_reviewed_at) || null,
        sourcesVerifiedAt: day(p.sources_verified_at) || null,
      })
    : null;

  const relationships = await loadRelationships(id);
  const factEvidence = await evidenceFor("fact", factRows.map((r) => s(r.id)));
  const facts: FactRecord[] = factRows.map((r) => ({
    id: s(r.id),
    key: s(r.fact_key),
    label: s(r.label),
    value: s(r.value),
    detail: s(r.detail),
    asOf: day(r.as_of),
    featured: Boolean(r.featured),
    sourceIds: factEvidence.get(s(r.id)) ?? [],
  }));

  // Sources: everything any record points at, plus keys the prose cites.
  const sourceIds = new Set<string>([
    ...facts.flatMap((f) => f.sourceIds),
    ...relationships.flatMap((r) => r.sourceIds),
    ...events.flatMap((e) => e.sourceIds),
    ...statements.map((x) => x.sourceId),
    ...giving.given.map((g) => g.sourceId),
  ]);
  const keys = editorialSourceKeys(editorial);
  const ids = [...sourceIds].filter(Boolean);
  const sourceRows = await run(
    sql`select * from sources where id = any(${uuidArray(ids)})${keys.length ? sql` or source_key = any(${textArray(keys)})` : sql``}`,
  );
  const sources = new Map(sourceRows.map((r) => [s(r.id), toSource(r)]));
  const sourceIdByKey = new Map([...sources.values()].filter((x) => x.key).map((x) => [x.key, x.id]));

  const entityIds = new Set<string>([
    id,
    ...relationships.flatMap((r) => [r.sourceEntityId, r.targetEntityId]),
    ...events.flatMap((e) => [e.subjectEntityId, ...e.participants.map((x) => x.entityId)]),
    ...giving.given.map((g) => g.recipientEntityId),
    ...giving.flows.flatMap((f) => [f.candidateEntityId, f.committeeEntityId]),
    ...outside.flatMap((o) => [o.committeeEntityId, ...o.topDonors.map((d) => d.entityId)]),
    ...received.topDonors.map((d) => d.entityId),
    ...received.topRecipients.map((d) => d.entityId),
    ...lobbying.flatMap((r) => [r.clientEntityId, r.registrantEntityId]),
  ]);
  const entities = new Map(
    (await getEntitiesByIds([...entityIds].filter(Boolean))).map((e) => [e.id, summarize(e)]),
  );
  entities.set(id, summarize(entity));

  const financeSyncedAt = giving.given.length
    ? day(
        (
          await run(
            sql`select max(updated_at) t from contributions where donor_entity_id = ${id} and source_record_id is not null`,
          )
        )[0]?.t,
      )
    : "";

  return {
    entity,
    editorial,
    legacy: editorialProfile(entity),
    facts,
    relationships,
    events,
    statements,
    given: giving.given,
    received,
    campaign,
    flows: giving.flows,
    outside,
    lobbying,
    traits,
    sources,
    sourceIdByKey,
    entities,
    freshness: {
      editorialReviewedAt: editorial?.editorialReviewedAt || editorialProfile(entity)?.reviewedAt || "",
      sourcesVerifiedAt: editorial?.sourcesVerifiedAt ?? "",
      financeSyncedAt,
    },
  };
});
