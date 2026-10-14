// Pure client/server-safe helpers for telling real ties apart from the
// seats, committee slots and party cards that make up most of the edges.

import type { Edge } from "@/lib/validation/edge";

// Seats, committee slots and party cards: ~11k of the ~13k edges, and they
// say where someone sits rather than who they're tied to.
const STRUCTURAL_REL_TYPES = new Set<string>([
  "serves-in",
  "sits-on-committee",
  "chairs",
  "governor-of",
  "holds-office",
  "party-member",
]);

export function isStructuralEdge(e: Edge): boolean {
  return (
    STRUCTURAL_REL_TYPES.has(e.relType ?? "") ||
    // Subcommittee → committee links are typed member-of (there's no
    // dedicated slug) but are just as much plumbing as committee seats.
    e.label === "subcommittee of"
  );
}

export function withoutStructuralEdges(edges: Edge[]): Edge[] {
  return edges.filter((e) => !isStructuralEdge(e));
}

/** Degree of every entity over the given edges. */
export function degreeById(edges: Edge[]): Record<string, number> {
  const deg: Record<string, number> = {};
  for (const e of edges) {
    deg[e.sourceEntityId] = (deg[e.sourceEntityId] ?? 0) + 1;
    deg[e.targetEntityId] = (deg[e.targetEntityId] ?? 0) + 1;
  }
  return deg;
}
