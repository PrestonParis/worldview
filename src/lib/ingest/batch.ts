import { entitySchema } from "../validation/entity";
import { sourceSchema } from "../validation/source";
import { edgeSchema } from "../validation/edge";
import { claimSchema } from "../validation/claim";
import * as entitiesDb from "../neo4j/entities";
import * as edgesDb from "../neo4j/edges";
import * as sourcesDb from "../db/sources";
import * as claimsDb from "../db/claims";

/**
 * Batch ingestion for the data-collection pipeline. A caller submits any
 * combination of entities/sources/edges/claims in one request. Items are
 * processed in that order (entities, sources, edges, claims) so that a later
 * item can point at a record created earlier in the *same* batch — give the
 * earlier item a `clientId` and reference it from the later item as
 * `"$ref:<clientId>"` instead of a real id. Records that already exist just
 * use their real id/uuid as normal.
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

  const all = [
    ...results.entities,
    ...results.sources,
    ...results.edges,
    ...results.claims,
  ];
  const created = all.filter((r) => r.ok).length;
  const failed = all.length - created;

  return { results, summary: { created, failed } };
}
