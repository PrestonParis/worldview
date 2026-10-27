import { familyOf, type NodeFamily } from "../graph/lean";
import { degreeById, withoutStructuralEdges } from "../graph/scope";
import { ATTRIBUTE_RESULT_LIMIT, buildAttributes, stateAbbrOf, type AttributeFacets, type AttributeParams } from "../people/attributes";
import { entityPartyAndPlace, entityRole, publicEntityPath } from "../people/public";
import { listEdges } from "./edges";
import { listEntities } from "./entities";
import { listPersonTraits } from "./traits";

// The People page's attribute explorer: facet counts for a set of filters
// and the best-connected matches. Results are capped; search narrows.

export interface AttributeMatch {
  id: string;
  name: string;
  href: string;
  role: string;
  place: string;
  family: NodeFamily;
  imageUrl: string | null;
  ties: number;
}

export interface AttributeResult {
  total: number;
  facets: AttributeFacets;
  matches: AttributeMatch[];
}

// The whole graph is needed for every query, so warm instances reuse it for
// a few minutes. Edits show up once it expires.
const TTL_MS = 10 * 60 * 1000;
let graph: { at: number; data: ReturnType<typeof readGraph> } | null = null;

async function readGraph() {
  const [entities, edges, traits] = await Promise.all([listEntities(), listEdges(), listPersonTraits()]);
  // Direct ties only: seats and party cards would rank every legislature first.
  const degree = new Map(Object.entries(degreeById(withoutStructuralEdges(edges))));
  return { entities, degree, traits };
}

function loadGraph() {
  if (!graph || Date.now() - graph.at > TTL_MS) {
    const data = readGraph();
    graph = { at: Date.now(), data };
    data.catch(() => { graph = null; });
  }
  return graph.data;
}

const PARTY_SHORT: Record<string, string> = { D: "Democrat", R: "Republican", I: "Independent" };

export async function queryAttributes(params: AttributeParams): Promise<AttributeResult> {
  const { entities, degree, traits } = await loadGraph();
  const { rows, facets } = buildAttributes(entities, degree, params, traits);
  return {
    total: rows.length,
    facets,
    matches: rows.slice(0, ATTRIBUTE_RESULT_LIMIT).map((entity) => {
      const { party, place } = entityPartyAndPlace(entity);
      return {
        id: entity.id,
        name: entity.name,
        href: publicEntityPath(entity),
        role: entityRole(entity),
        place: [PARTY_SHORT[party] ?? party, stateAbbrOf(entity) ?? place].filter(Boolean).join(" · "),
        family: familyOf(entity),
        imageUrl: entity.imageUrl ?? null,
        ties: degree.get(entity.id) ?? 0,
      };
    }),
  };
}
