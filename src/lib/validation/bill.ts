import { z } from "zod";

export const billStatuses = [
  "introduced",
  "in_committee",
  "passed_chamber",
  "passed_both_chambers",
  "enacted",
  "vetoed",
  "failed",
] as const;

// The hand-entry form path (/data/bills). Sponsor is required here even
// though the column is nullable — the importer is the only writer that
// leaves it unset.
export const billSchema = z.object({
  id: z.uuid().optional(),
  billNumber: z.string().min(1, "Bill number is required").max(50),
  title: z.string().min(1, "Title is required").max(300),
  summary: z.string().max(4000).optional().or(z.literal("")),
  status: z.enum(billStatuses),
  chamber: z.string().max(100).optional().or(z.literal("")),
  introducedDate: z.string().min(1, "Introduced date is required"),
  sponsorEntityId: z.uuid("Pick the sponsor"),
});

export type BillInput = z.infer<typeof billSchema>;

// What the Congress.gov importer upserts, keyed on `externalId`. Sponsor is
// optional; the extra structured fields the form doesn't collect are here.
export const billImportSchema = z.object({
  externalId: z.string().min(1),
  congress: z.number().int().positive(),
  billNumber: z.string().min(1).max(50),
  title: z.string().min(1).max(600),
  summary: z.string().optional().default(""),
  status: z.enum(billStatuses),
  chamber: z.string().max(100).optional().default(""),
  introducedDate: z.string().min(1),
  sponsorEntityId: z.uuid().nullable().optional(),
  policyArea: z.string().optional().default(""),
  subjects: z.string().optional().default(""),
  latestActionDate: z.string().optional().default(""),
  latestActionText: z.string().optional().default(""),
  sourceId: z.uuid().nullable().optional(),
});

export type BillImportInput = z.infer<typeof billImportSchema>;

export interface Bill extends Omit<BillInput, "sponsorEntityId"> {
  id: string;
  sponsorEntityId: string | null;
  congress: number | null;
  externalId: string | null;
  policyArea: string;
  // One subject term per line, the `entities.highlights` convention.
  subjects: string;
  latestActionDate: string;
  latestActionText: string;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
