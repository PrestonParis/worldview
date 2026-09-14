import { entitySchema } from "../validation/entity";
import { sourceSchema } from "../validation/source";
import { edgeSchema } from "../validation/edge";
import { claimSchema } from "../validation/claim";
import { electionSchema } from "../validation/election";
import { candidacySchema } from "../validation/candidacy";
import { electionResultSchema } from "../validation/electionResult";
import { raceRatingSchema } from "../validation/raceRating";
import * as entitiesDb from "../neo4j/entities";
import * as edgesDb from "../neo4j/edges";
import * as sourcesDb from "../db/sources";
import * as claimsDb from "../db/claims";
import * as electionsDb from "../db/elections";
import * as candidaciesDb from "../db/candidacies";
import * as electionResultsDb from "../db/electionResults";
import * as raceRatingsDb from "../db/raceRatings";

/**
 * Batch ingestion for the data-collection pipeline. A caller submits any
 * combination of entities/sources/edges/claims/elections/candidacies/
 * electionResults in one
 * request. Items are processed in that order so that a later item can point
 * at a record created earlier in the *same* batch — give the earlier item a
 * `clientId` and reference it from the later item as `"$ref:<clientId>"`
 * instead of a real id. Records that already exist just use their real
 * id/uuid as normal.
 *
 * `elections` and `candidacies` items may carry an `externalId`; when
 * present the write is an idempotent upsert on that key (re-runnable
 * imports), otherwise a plain insert.
 *
 * Each item is validated and written independently: one bad record doesn't
 * sink the rest of the batch. Check `results[type][i].ok` / `.error` and
 * retry only the failed items.
 */

type RawItem = Record<string, unknown> & { clientId?: unknown };

export interface IngestBatchPayload {
  entities?: RawItem[];
  sources?: RawItem[];
  edges?: RawItem[];
  claims?: RawItem[];
  elections?: RawItem[];
  candidacies?: RawItem[];
  electionResults?: RawItem[];
  raceRatings?: RawItem[];
}

interface ItemResult {
  index: number;
  clientId?: string;
  ok: boolean;
  id?: string;
  error?: string;
}

export interface IngestBatchResult {
  results: {
    entities: ItemResult[];
    sources: ItemResult[];
    edges: ItemResult[];
    claims: ItemResult[];
    elections: ItemResult[];
    candidacies: ItemResult[];
    electionResults: ItemResult[];
    raceRatings: ItemResult[];
  };
  summary: {
    created: number;
    failed: number;
  };
}

const REF_PREFIX = "$ref:";

function resolveRefs(
  raw: RawItem,
  refFields: string[],
  refs: Map<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  delete out.clientId;
  for (const field of refFields) {
    const value = out[field];
    if (typeof value === "string" && value.startsWith(REF_PREFIX)) {
      const key = value.slice(REF_PREFIX.length);
      const resolved = refs.get(key);
      if (!resolved) {
        throw new Error(
          `Unresolved reference "${value}" in field "${field}" — no earlier item in this batch set clientId "${key}"`,
        );
      }
      out[field] = resolved;
    }
  }
  return out;
}

function clientIdOf(raw: RawItem): string | undefined {
  return typeof raw.clientId === "string" ? raw.clientId : undefined;
}

export async function runIngestBatch(
  payload: IngestBatchPayload,
): Promise<IngestBatchResult> {
  const refs = new Map<string, string>();
  const results: IngestBatchResult["results"] = {
    entities: [],
    sources: [],
    edges: [],
    claims: [],
    elections: [],
    candidacies: [],
    electionResults: [],
    raceRatings: [],
  };

  for (const [index, raw] of (payload.entities ?? []).entries()) {
    const clientId = clientIdOf(raw);
    try {
      const resolved = resolveRefs(raw, [], refs);
      const parsed = entitySchema.safeParse(resolved);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid entity");
      }
      const entity = await entitiesDb.createEntity(parsed.data);
      if (clientId) refs.set(clientId, entity.id);
      results.entities.push({ index, clientId, ok: true, id: entity.id });
    } catch (err) {
      results.entities.push({
        index,
        clientId,
        ok: false,
        error: (err as Error).message,
      });
    }
  }

  for (const [index, raw] of (payload.sources ?? []).entries()) {
    const clientId = clientIdOf(raw);
    try {
      const resolved = resolveRefs(raw, [], refs);
      const parsed = sourceSchema.safeParse(resolved);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid source");
      }
      const source = await sourcesDb.createSource(parsed.data);
      if (clientId) refs.set(clientId, source.id);
      results.sources.push({ index, clientId, ok: true, id: source.id });
    } catch (err) {
      results.sources.push({
        index,
        clientId,
        ok: false,
        error: (err as Error).message,
      });
    }
  }

  for (const [index, raw] of (payload.edges ?? []).entries()) {
    const clientId = clientIdOf(raw);
    try {
      const resolved = resolveRefs(
        raw,
        ["sourceEntityId", "targetEntityId"],
        refs,
      );
      const parsed = edgeSchema.safeParse(resolved);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid edge");
      }
      const edge = await edgesDb.createEdge(parsed.data);
      if (clientId) refs.set(clientId, edge.id);
      results.edges.push({ index, clientId, ok: true, id: edge.id });
    } catch (err) {
      results.edges.push({
        index,
        clientId,
        ok: false,
        error: (err as Error).message,
      });
    }
  }

  for (const [index, raw] of (payload.claims ?? []).entries()) {
    const clientId = clientIdOf(raw);
    try {
      const resolved = resolveRefs(
        raw,
        ["speakerEntityId", "sourceId", "contradictsClaimId"],
        refs,
      );
      const parsed = claimSchema.safeParse(resolved);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid claim");
      }
      const claim = await claimsDb.createClaim(parsed.data);
      if (clientId) refs.set(clientId, claim.id);
      results.claims.push({ index, clientId, ok: true, id: claim.id });
    } catch (err) {
      results.claims.push({
        index,
        clientId,
        ok: false,
        error: (err as Error).message,
      });
    }
  }

  for (const [index, raw] of (payload.elections ?? []).entries()) {
    const clientId = clientIdOf(raw);
    try {
      const resolved = resolveRefs(
        raw,
        ["priorElectionId", "parentElectionId"],
        refs,
      );
      const parsed = electionSchema.safeParse(resolved);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid election");
      }
      const externalId =
        typeof raw.externalId === "string" && raw.externalId
          ? raw.externalId
          : null;
      const election = externalId
        ? await electionsDb.upsertElectionByExternalId(externalId, parsed.data)
        : await electionsDb.createElection(parsed.data);
      if (clientId) refs.set(clientId, election.id);
      results.elections.push({ index, clientId, ok: true, id: election.id });
    } catch (err) {
      results.elections.push({
        index,
        clientId,
        ok: false,
        error: (err as Error).message,
      });
    }
  }

  for (const [index, raw] of (payload.candidacies ?? []).entries()) {
    const clientId = clientIdOf(raw);
    try {
      const resolved = resolveRefs(
        raw,
        ["electionId", "candidateEntityId"],
        refs,
      );
      const parsed = candidacySchema.safeParse(resolved);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid candidacy");
      }
      const externalId =
        typeof raw.externalId === "string" && raw.externalId
          ? raw.externalId
          : null;
      const candidacy = externalId
        ? await candidaciesDb.upsertCandidacyByExternalId(externalId, parsed.data)
        : await candidaciesDb.createCandidacy(parsed.data);
      if (clientId) refs.set(clientId, candidacy.id);
      results.candidacies.push({ index, clientId, ok: true, id: candidacy.id });
    } catch (err) {
      results.candidacies.push({
        index,
        clientId,
        ok: false,
        error: (err as Error).message,
      });
    }
  }

  for (const [index, raw] of (payload.electionResults ?? []).entries()) {
    const clientId = clientIdOf(raw);
    try {
      const resolved = resolveRefs(raw, ["electionId", "candidacyId"], refs);
      const parsed = electionResultSchema.safeParse(resolved);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid election result");
      }
      const externalId =
        typeof raw.externalId === "string" && raw.externalId
          ? raw.externalId
          : null;
      const row = externalId
        ? await electionResultsDb.upsertElectionResultByExternalId(externalId, parsed.data)
        : await electionResultsDb.createElectionResult(parsed.data);
      if (clientId && row) refs.set(clientId, row.id);
      results.electionResults.push({ index, clientId, ok: true, id: row?.id });
    } catch (err) {
      results.electionResults.push({
        index,
        clientId,
        ok: false,
        error: (err as Error).message,
      });
    }
  }

  for (const [index, raw] of (payload.raceRatings ?? []).entries()) {
    const clientId = clientIdOf(raw);
    try {
      const resolved = resolveRefs(raw, ["electionId"], refs);
      const parsed = raceRatingSchema.safeParse(resolved);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid race rating");
      }
      const externalId =
        typeof raw.externalId === "string" && raw.externalId ? raw.externalId : null;
      const row = externalId
        ? await raceRatingsDb.upsertRaceRatingByExternalId(externalId, parsed.data)
        : await raceRatingsDb.createRaceRating(parsed.data);
      if (clientId && row) refs.set(clientId, row.id);
      results.raceRatings.push({ index, clientId, ok: true, id: row?.id });
    } catch (err) {
      results.raceRatings.push({ index, clientId, ok: false, error: (err as Error).message });
    }
  }

  const all = [
    ...results.entities,
    ...results.sources,
    ...results.edges,
    ...results.claims,
    ...results.elections,
    ...results.candidacies,
    ...results.electionResults,
    ...results.raceRatings,
  ];
  const created = all.filter((r) => r.ok).length;
  const failed = all.length - created;

  return { results, summary: { created, failed } };
}
