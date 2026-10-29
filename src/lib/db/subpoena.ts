import { getDossierEntityIds, listCaseFileEntities, listProfiledEntities, searchEntities } from "./entities";
import type { Entity } from "../validation/entity";

export interface SubpoenaDirectory {
  /** Full dossiers, most relevant first (empty for a search). */
  caseFiles: Entity[];
  /** Search results, or the discovery lists per type, each in relevance order. */
  entities: Entity[];
  /** Ids among `entities` that have a full dossier. */
  dossierIds: string[];
}

export async function getFeaturedSubpoenaEntities(query = ""): Promise<SubpoenaDirectory> {
  if (query.trim()) {
    const entities = await searchEntities(query, 24, true);
    const dossierIds = await getDossierEntityIds(entities.map((entity) => entity.id));
    return { caseFiles: [], entities, dossierIds: [...dossierIds] };
  }
  const [caseFiles, ...groups] = await Promise.all([
    listCaseFileEntities(12),
    listProfiledEntities("donor", 20),
    listProfiledEntities("politician", 20),
    listProfiledEntities("judge", 4),
    listProfiledEntities("pundit", 8),
    listProfiledEntities("journalist", 8),
    listProfiledEntities("lobbyist", 4),
    listProfiledEntities("organization", 8),
    listProfiledEntities("company", 8),
  ]);
  // Case files lead the page, so the per-type lists skip them. Same-name
  // duplicates (a committee imported as both organization and company) keep
  // only the more relevant row.
  const caseFileIds = new Set(caseFiles.map((entity) => entity.id));
  const seen = new Set(caseFiles.map((entity) => entity.name.toLowerCase()));
  const entities = groups.flat().filter((entity) => {
    const name = entity.name.toLowerCase();
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
  return { caseFiles, entities, dossierIds: [...caseFileIds] };
}
