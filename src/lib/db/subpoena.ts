import { getEntitiesByIds, listProfiledEntities, searchEntities } from "./entities";
import { getEntityContributionSummary } from "./contributions";
import { listLobbyingForEntity } from "./lobbying";
import { listEdgesForEntity } from "./edges";
import { getSourcesByIds } from "./sources";
import type { Entity } from "../validation/entity";
import type { EntityContributionSummary } from "../money";
import type { LobbyingRegistration } from "../validation/lobbying";
import type { Edge } from "../validation/edge";
import type { Source } from "../validation/source";

export interface SubpoenaDossier {
  entity: Entity;
  moneySummary: EntityContributionSummary;
  lobbying: LobbyingRegistration[];
  edges: Edge[];
  relatedEntities: Record<string, Entity>;
  sources: Record<string, Source>;
}

export async function loadSubpoenaDossier(entityId: string): Promise<SubpoenaDossier | null> {
  const [entities] = await Promise.all([getEntitiesByIds([entityId])]);
  const entity = entities[0];
  if (!entity) return null;

  const [moneySummary, lobbying, edges] = await Promise.all([
    getEntityContributionSummary(entity.id),
    listLobbyingForEntity(entity.id),
    listEdgesForEntity(entity.id),
  ]);

  const relatedIds = [
    ...moneySummary.topDonors.map((d) => d.entityId),
    ...moneySummary.topRecipients.map((r) => r.entityId),
    ...lobbying.flatMap((l) => [l.clientEntityId, l.registrantEntityId]),
    ...edges.flatMap((e) => [e.sourceEntityId, e.targetEntityId]),
  ].filter((id) => id !== entity.id);

  const [relatedList, sourceList] = await Promise.all([
    getEntitiesByIds(relatedIds),
    getSourcesByIds(edges.map((edge) => edge.sourceRecordId ?? "")).catch(() => []),
  ]);
  const relatedEntities: Record<string, Entity> = {};
  for (const rel of relatedList) {
    relatedEntities[rel.id] = rel;
  }
  const sources: Record<string, Source> = {};
  for (const source of sourceList) sources[source.id] = source;

  return {
    entity,
    moneySummary,
    lobbying,
    edges,
    relatedEntities,
    sources,
  };
}

export async function getFeaturedSubpoenaEntities(query = ""): Promise<Entity[]> {
  if (query.trim()) return searchEntities(query, 12);
  const groups = await Promise.all([
    listProfiledEntities("donor", 36),
    listProfiledEntities("politician", 12),
    listProfiledEntities("pundit", 8),
    listProfiledEntities("journalist", 8),
    listProfiledEntities("lobbyist", 6),
    listProfiledEntities("organization", 10),
    listProfiledEntities("company", 8),
  ]);
  return [...new Map(groups.flat().map((entity) => [entity.id, entity])).values()];
}
