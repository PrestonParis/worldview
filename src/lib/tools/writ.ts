import type { WritDocket } from "../db/writ";

export const WRIT_KINDS = ["bill", "member", "race"] as const;
export type WritKind = (typeof WRIT_KINDS)[number];

export function writDocketHref(kind: WritKind, id: string): string {
  return `/writ/${kind}/${id}`;
}

export function writDocketTitle(docket: WritDocket): string {
  if (docket.kind === "bill") return docket.bill.billNumber;
  if (docket.kind === "member") return docket.entity.name;
  return `${docket.election.jurisdiction} ${docket.election.office} ${docket.cycle}`;
}
