// The Congress half of the People & Power landscape: every member of the
// latest Congress placed by their Voteview DW-NOMINATE first dimension
// (roll-call voting, -1 liberal to +1 conservative), not by party.
// Degrades to null until scripts/import-voteview.mjs has run.

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { getEntitiesByIds } from "@/lib/neo4j/entities";
import { publicEntityPath } from "./public";

export type AtlasParty = "D" | "R" | "I";

export interface AtlasMember {
  key: string;
  name: string;
  party: AtlasParty;
  chamber: "House" | "Senate";
  /** "CA" or "CA-12". */
  seat: string;
  score: number;
  href: string | null;
  imageUrl: string | null;
}

export interface CongressAtlas {
  congress: number;
  members: AtlasMember[];
}

// Voteview's "PELOSI, Nancy" → "Nancy Pelosi", for members not yet linked
// to a graph entity.
function displayBioname(bioname: string): string {
  const [last, first] = bioname.split(",").map((part) => part.trim());
  if (!first) return bioname;
  const cased = last.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());
  return `${first.replace(/\s*\(.*?\)\s*/g, " ").trim()} ${cased}`;
}

export async function loadCongressAtlas(): Promise<CongressAtlas | null> {
  const { rows } = await db.execute(sql`
    select congress, chamber, icpsr, bioname, party_code, state_abbrev, district_code,
           nominate_dim1::float8 as score, entity_id
    from member_ideology
    where congress = (select max(congress) from member_ideology where chamber in ('House', 'Senate'))
      and chamber in ('House', 'Senate') and nominate_dim1 is not null`);
  const members = rows as {
    congress: number;
    chamber: "House" | "Senate";
    icpsr: number;
    bioname: string | null;
    party_code: number | null;
    state_abbrev: string | null;
    district_code: number | null;
    score: number;
    entity_id: string | null;
  }[];
  if (members.length === 0) return null;

  const entities = new Map(
    (await getEntitiesByIds(members.map((m) => m.entity_id ?? ""))).map((e) => [e.id, e]),
  );

  return {
    congress: members[0].congress,
    members: members.map((m) => {
      const entity = m.entity_id ? entities.get(m.entity_id) : undefined;
      const state = m.state_abbrev ?? "";
      const atLarge = !m.district_code || m.district_code === 0;
      return {
        key: `${m.chamber}-${m.icpsr}`,
        name: entity?.name ?? displayBioname(m.bioname ?? "Unknown member"),
        party: m.party_code === 100 ? "D" : m.party_code === 200 ? "R" : "I",
        chamber: m.chamber,
        seat: m.chamber === "Senate" || atLarge ? state : `${state}-${m.district_code}`,
        score: m.score,
        href: entity ? publicEntityPath(entity) : null,
        imageUrl: entity?.imageUrl || null,
      };
    }),
  };
}
