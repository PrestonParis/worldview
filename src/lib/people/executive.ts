// The executive half of the People & Power landscape: the President, the
// Vice President, and every cabinet and cabinet-level post, shaped for the
// org-chart map from getAdministration() (src/lib/db/graph.ts).

import { familyOf, type NodeFamily } from "../graph/lean";
import { publicEntityPath } from "./public";
import type { Administration, AdministrationRole } from "../db/graph";
import type { Entity } from "../validation/entity";

export const SECTOR_LABEL: Record<string, string> = {
  elected: "Former elected official",
  industry: "From industry",
  "think-tank": "From a think tank",
  media: "From media",
  government: "Career government",
  military: "From the military",
  campaign: "Campaign staff",
  activist: "Activist / advocacy",
  academia: "From academia",
};

export interface ExecutiveCard {
  id: string;
  name: string;
  href: string;
  imageUrl: string | null;
  family: NodeFamily;
  title: string;
  org: { name: string; href: string } | null;
  since: string;
  until: string;
  priorSector: string | null;
}

export interface ExecutiveMapData {
  president: ExecutiveCard;
  vp: ExecutiveCard | null;
  /** White House posts: Chief of Staff, OMB, USTR. */
  eop: ExecutiveCard[];
  /** The executive departments, in line-of-succession order. */
  departments: ExecutiveCard[];
  /** Cabinet-level agencies and officials outside the departments. */
  agencies: ExecutiveCard[];
  former: ExecutiveCard[];
  /** Prior sector → appointees serving now, most common first. */
  sectors: [string, number][];
}

function card(person: Entity, title: string, role?: AdministrationRole): ExecutiveCard {
  return {
    id: role ? `${person.id}:${title}` : person.id,
    name: person.name,
    href: publicEntityPath(person),
    imageUrl: person.imageUrl || null,
    family: familyOf(person),
    title,
    org: role?.department ? { name: role.department.name, href: publicEntityPath(role.department) } : null,
    since: role?.since ?? "",
    until: role?.until ?? "",
    priorSector: role?.priorSector ?? null,
  };
}

export function toExecutiveMap(admin: Administration): ExecutiveMapData {
  const of = (group: AdministrationRole["group"]) =>
    admin.roles.filter((r) => r.group === group).map((r) => card(r.person, r.title, r));
  const sectors = new Map<string, number>();
  for (const r of admin.roles) if (r.priorSector) sectors.set(r.priorSector, (sectors.get(r.priorSector) ?? 0) + 1);
  return {
    president: card(admin.president, admin.office?.name ?? "President"),
    vp: of("vp")[0] ?? null,
    eop: of("eop"),
    departments: of("department"),
    // Posts imported before groups existed land with the agencies.
    agencies: admin.roles.filter((r) => r.group === "agency" || r.group === null).map((r) => card(r.person, r.title, r)),
    former: admin.former.map((r) => card(r.person, r.title, r)),
    sectors: [...sectors].sort((a, b) => b[1] - a[1]),
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2025-02-13" or "2026-04" → "Feb 2025" / "Apr 2026".
export function monthYear(date: string): string {
  const [y, m] = date.split("-");
  const month = MONTHS[Number(m) - 1];
  return y ? (month ? `${month} ${y}` : y) : "";
}
