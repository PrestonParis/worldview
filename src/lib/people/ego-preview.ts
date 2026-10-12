// A small, static ego network for the People & Power landing page: one
// subject and its direct (non-institutional) ties, each labelled with what
// the tie is. The full interactive network lives at /people?view=network.

import { familyOf, type NodeFamily } from "@/lib/graph/lean";
import { withoutStructuralEdges } from "@/lib/graph/scope";
import { relationshipCategoryOf, relationshipTypeBySlug, type RelationshipCategory } from "@/lib/relationships";
import { publicEntityPath } from "./public";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";

export interface EgoNode {
  id: string;
  name: string;
  href: string;
  family: NodeFamily;
  /** How this node relates to the subject, read from the subject: "appointed", "hosts". */
  relation: string;
  category: RelationshipCategory | null;
  x: number;
  y: number;
}

export interface EgoPreview {
  root: { id: string; name: string; href: string; family: NodeFamily; imageUrl: string | null };
  nodes: EgoNode[];
  total: number;
}

export const EGO_RX = 230;
export const EGO_RY = 165;

export function buildEgoPreview(
  root: Entity,
  entities: Map<string, Entity>,
  edges: Edge[],
  limit = 14,
): EgoPreview {
  const ties = withoutStructuralEdges(edges).filter(
    (e) => (e.sourceEntityId === root.id || e.targetEntityId === root.id) && e.sourceEntityId !== e.targetEntityId,
  );
  const byOther = new Map<string, Edge>();
  for (const edge of ties) {
    const other = edge.sourceEntityId === root.id ? edge.targetEntityId : edge.sourceEntityId;
    if (entities.has(other) && !byOther.has(other)) byOther.set(other, edge);
  }

  const picked = [...byOther.entries()]
    .map(([id, edge]) => {
      const entity = entities.get(id)!;
      const type = relationshipTypeBySlug[edge.relType ?? ""];
      const outgoing = edge.sourceEntityId === root.id;
      const relation = (type ? (outgoing ? type.verb : type.inverse) : edge.label) || edge.label;
      return { entity, relation, category: relationshipCategoryOf(edge.relType ?? "") };
    })
    // Group like with like around the ring.
    .sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.entity.name.localeCompare(b.entity.name))
    .slice(0, limit);

  return {
    root: {
      id: root.id,
      name: root.name,
      href: publicEntityPath(root),
      family: familyOf(root),
      imageUrl: root.imageUrl || null,
    },
    nodes: picked.map(({ entity, relation, category }, i) => {
      const angle = (i / picked.length) * 2 * Math.PI - Math.PI / 2;
      return {
        id: entity.id,
        name: entity.name,
        href: publicEntityPath(entity),
        family: familyOf(entity),
        relation,
        category,
        x: Math.cos(angle) * EGO_RX,
        y: Math.sin(angle) * EGO_RY,
      };
    }),
    total: byOther.size,
  };
}
