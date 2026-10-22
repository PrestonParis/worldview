import { listProfiledEntities, searchEntities } from "./entities";
import type { Entity } from "../validation/entity";

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
