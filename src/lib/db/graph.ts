// Higher-level reads over the People & Power graph: the organization
// directory and profiles, and the current administration. Each query reads
// only the entities and edges it needs.

import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "./client";
import { entities, entityEdges } from "./schema";
import { getEntitiesByIds, getEntity } from "./entities";
import { relationshipCategoryOf } from "@/lib/relationships";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";

export interface OrgDirectoryRow {
  entity: Entity;
  connectionCount: number;
  /** connected entity counts by their type, e.g. { politician: 40, pundit: 3 } */
  connectedByType: Record<string, number>;
}

const ORG_TYPES = ["organization", "company"];

/**
 * Every organization and company, with how many entities connect to it and
 * a breakdown of those by type. Sorted most-connected first — the entry
 * point for the Organization Graph.
 */
export async function listOrgDirectory(): Promise<OrgDirectoryRow[]> {
  const counts = await db.execute<{ org_id: string; type: string; n: number }>(sql`
    with links as (
      select source_entity_id as org_id, target_entity_id as other_id from entity_edges
      union
      select target_entity_id, source_entity_id from entity_edges
    )
    select l.org_id, o.type, count(distinct l.other_id)::int as n
    from links l
    join entities org on org.id = l.org_id and org.type in ('organization', 'company')
    join entities o on o.id = l.other_id
    group by l.org_id, o.type`);

  const byOrg = new Map<string, Record<string, number>>();
  for (const row of counts.rows) {
    const types = byOrg.get(row.org_id) ?? {};
    types[row.type] = row.n;
    byOrg.set(row.org_id, types);
  }

  const orgs = await getEntitiesByIds(
    (await db.select({ id: entities.id }).from(entities).where(inArray(entities.type, ORG_TYPES))).map((r) => r.id),
  );
  const rows = orgs.map((entity) => {
    const connectedByType = byOrg.get(entity.id) ?? {};
    const connectionCount = Object.values(connectedByType).reduce((sum, n) => sum + n, 0);
    return { entity, connectionCount, connectedByType };
  });

  rows.sort((a, b) => b.connectionCount - a.connectionCount || a.entity.name.localeCompare(b.entity.name));
  return rows;
}

export interface OrgConnection {
  entity: Entity;
  edge: Edge;
  category: string | null;
  /** true when the edge is source→org (the counterpart points at the org). */
  incoming: boolean;
}

export interface OrgProfile {
  entity: Entity;
  connectionsByCategory: { category: string; connections: OrgConnection[] }[];
  total: number;
}

const CATEGORY_ORDER = [
  "institutional",
  "employment",
  "affiliation",
  "political",
  "media",
  "corporate",
  "personal",
  "other",
];

function toEdge(row: typeof entityEdges.$inferSelect): Edge {
  return {
    ...row,
    sourceRecordId: row.sourceRecordId ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** One organization with everyone connected to it, grouped by relationship category. */
export async function getOrgProfile(orgId: string): Promise<OrgProfile | null> {
  const org = await getEntity(orgId);
  if (!org || !ORG_TYPES.includes(org.type)) return null;

  const edges = (
    await db
      .select()
      .from(entityEdges)
      .where(or(eq(entityEdges.sourceEntityId, orgId), eq(entityEdges.targetEntityId, orgId)))
  ).map(toEdge);
  const others = new Map(
    (await getEntitiesByIds(edges.map((e) => (e.targetEntityId === orgId ? e.sourceEntityId : e.targetEntityId)))).map(
      (e) => [e.id, e],
    ),
  );

  const connections: OrgConnection[] = [];
  for (const edge of edges) {
    const incoming = edge.targetEntityId === orgId;
    const other = others.get(incoming ? edge.sourceEntityId : edge.targetEntityId);
    if (!other) continue;
    connections.push({ entity: other, edge, category: relationshipCategoryOf(edge.relType ?? ""), incoming });
  }

  const grouped = new Map<string, OrgConnection[]>();
  for (const c of connections) {
    const key = c.category ?? "other";
    const list = grouped.get(key);
    if (list) list.push(c);
    else grouped.set(key, [c]);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.entity.name.localeCompare(b.entity.name));
  }

  const connectionsByCategory = CATEGORY_ORDER.filter((c) => grouped.has(c)).map((category) => ({
    category,
    connections: grouped.get(category)!,
  }));

  return { entity: org, connectionsByCategory, total: connections.length };
}

export interface AdministrationRole {
  person: Entity;
  title: string;
  priorSector: string | null;
  department: Entity | null;
}

export interface Administration {
  president: Entity;
  office: Entity | null;
  roles: AdministrationRole[];
}

function parsePriorSector(notes: string): string | null {
  try {
    const v = JSON.parse(notes || "{}");
    return typeof v?.priorSector === "string" ? v.priorSector : null;
  } catch {
    return null;
  }
}

/**
 * The current administration, from the `appointed` edges out of the
 * President node (written by scripts/import-administration.mjs). Returns
 * null when none has been imported.
 */
export async function getAdministration(): Promise<Administration | null> {
  // The President is whoever has an outgoing `holds-office` edge to an
  // entity named "President of the United States".
  const [officeEdge] = await db
    .select({ presidentId: entityEdges.sourceEntityId, officeId: entityEdges.targetEntityId })
    .from(entityEdges)
    .innerJoin(entities, eq(entities.id, entityEdges.targetEntityId))
    .where(and(eq(entityEdges.relType, "holds-office"), eq(entities.name, "President of the United States")))
    .limit(1);
  if (!officeEdge) return null;

  const appointed = (
    await db
      .select()
      .from(entityEdges)
      .where(and(eq(entityEdges.relType, "appointed"), eq(entityEdges.sourceEntityId, officeEdge.presidentId)))
  ).map(toEdge);
  const personIds = appointed.map((e) => e.targetEntityId);
  const servesIn = personIds.length
    ? await db
        .select({ personId: entityEdges.sourceEntityId, deptId: entityEdges.targetEntityId })
        .from(entityEdges)
        .where(and(eq(entityEdges.relType, "serves-in"), inArray(entityEdges.sourceEntityId, personIds)))
    : [];
  const deptByPerson = new Map(servesIn.map((r) => [r.personId, r.deptId]));

  const byId = new Map(
    (
      await getEntitiesByIds([officeEdge.presidentId, officeEdge.officeId, ...personIds, ...deptByPerson.values()])
    ).map((e) => [e.id, e]),
  );
  const president = byId.get(officeEdge.presidentId);
  if (!president) return null;

  const roles: AdministrationRole[] = appointed
    .map((e) => {
      const person = byId.get(e.targetEntityId);
      if (!person) return null;
      const deptId = deptByPerson.get(person.id);
      return {
        person,
        title: e.role || e.label,
        priorSector: parsePriorSector(e.notes ?? ""),
        department: deptId ? byId.get(deptId) ?? null : null,
      };
    })
    .filter((r): r is AdministrationRole => r !== null)
    .sort((a, b) => a.title.localeCompare(b.title));

  return { president, office: byId.get(officeEdge.officeId) ?? null, roles };
}
