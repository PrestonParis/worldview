import { getDriver } from "./client";

// Members of Congress (entities carrying a Bioguide id) whose name contains
// `query`, case-insensitive — for "bills sponsored by …" searches.
export async function findMemberIdsByName(query: string, limit = 50): Promise<string[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (e:Entity) WHERE e.bioguideId IS NOT NULL AND toLower(e.name) CONTAINS $q
       RETURN e.id AS id LIMIT toInteger($limit)`,
      { q, limit },
    );
    return result.records.map((r) => String(r.get("id")));
  } finally {
    await session.close();
  }
}
