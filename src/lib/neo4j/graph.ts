// Higher-level reads over the entity graph, built on listEntities() /
// listEdges() rather than bespoke Cypher — the whole graph is ~2k nodes,
// so pulling it once and shaping in memory is fine and keeps this off the
// entity-CRUD module.

import { listEntities } from "./entities";
import { listEdges } from "./edges";
import { relationshipCategoryOf } from "@/lib/relationships";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";

export interface OrgDirectoryRow {
  entity: Entity;
  connectionCount: number;
  /** connected entity counts by their type, e.g. { politician: 40, pundit: 3 } */
  connectedByType: Record<string, number>;
}

/**
 * Every organization and company, with how many entities connect to it and
 * a breakdown of those by type. Sorted most-connected first — the entry
 * point for the Organization Graph.
 */
export async function listOrgDirectory(): Promise<OrgDirectoryRow[]> {
  const [entities, edges] = await Promise.all([listEntities(), listEdges()]);
  const byId = new Map(entities.map((e) => [e.id, e]));

  const rows = entities
    .filter((e) => e.type === "organization" || e.type === "company")
    .map((entity) => {
      const neighbours = new Set<string>();
      for (const edge of edges) {
        if (edge.sourceEntityId === entity.id) neighbours.add(edge.targetEntityId);
        else if (edge.targetEntityId === entity.id) neighbours.add(edge.sourceEntityId);
      }
      const connectedByType: Record<string, number> = {};
      for (const id of neighbours) {
        const t = byId.get(id)?.type;
        if (t) connectedByType[t] = (connectedByType[t] ?? 0) + 1;
      }
      return { entity, connectionCount: neighbours.size, connectedByType };
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

/** One organization with everyone connected to it, grouped by relationship category. */
export async function getOrgProfile(orgId: string): Promise<OrgProfile | null> {
  const [entities, edges] = await Promise.all([listEntities(), listEdges()]);
  const org = entities.find((e) => e.id === orgId);
  if (!org || (org.type !== "organization" && org.type !== "company")) return null;

  const byId = new Map(entities.map((e) => [e.id, e]));
  const connections: OrgConnection[] = [];
  for (const edge of edges) {
    let otherId: string | null = null;
    let incoming = false;
    if (edge.targetEntityId === orgId) {
      otherId = edge.sourceEntityId;
      incoming = true;
    } else if (edge.sourceEntityId === orgId) {
      otherId = edge.targetEntityId;
    }
    if (!otherId) continue;
    const other = byId.get(otherId);
    if (!other) continue;
    connections.push({
      entity: other,
      edge,
      category: relationshipCategoryOf(edge.relType ?? ""),
      incoming,
    });
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
