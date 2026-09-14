import { z } from "zod";

// The Bill Explorer child records (cosponsors, actions, committees, related
// bills, text versions). Hand-entry through /data/bills/[id]/edit uses the
// *Schema; the Congress.gov importer builds the same shapes and replaces a
// bill's rows wholesale.

export const billCosponsorSchema = z.object({
  billId: z.uuid(),
  entityId: z.uuid("Pick the cosponsor"),
  date: z.string().optional().or(z.literal("")),
  isOriginal: z.boolean().optional().default(false),
});
export type BillCosponsorInput = z.infer<typeof billCosponsorSchema>;

export const billActionSchema = z.object({
  billId: z.uuid(),
  date: z.string().min(1, "Date is required"),
  chamber: z.string().max(60).optional().or(z.literal("")),
  text: z.string().min(1, "Text is required").max(2000),
  actionType: z.string().max(120).optional().or(z.literal("")),
});
export type BillActionInput = z.infer<typeof billActionSchema>;

export const billCommitteeSchema = z.object({
  billId: z.uuid(),
  name: z.string().min(1, "Name is required").max(200),
  chamber: z.string().max(60).optional().or(z.literal("")),
  activity: z.string().max(200).optional().or(z.literal("")),
});
export type BillCommitteeInput = z.infer<typeof billCommitteeSchema>;

export const billRelationSchema = z.object({
  billId: z.uuid(),
  relatedExternalId: z.string().max(60).optional().or(z.literal("")),
  relatedBillId: z.uuid().nullable().optional(),
  relatedBillNumber: z.string().max(60).optional().or(z.literal("")),
  relatedTitle: z.string().max(600).optional().or(z.literal("")),
  relationshipType: z.string().max(120).optional().or(z.literal("")),
});
export type BillRelationInput = z.infer<typeof billRelationSchema>;

export const billTextVersionSchema = z.object({
  billId: z.uuid(),
  versionType: z.string().max(120).optional().or(z.literal("")),
  date: z.string().optional().or(z.literal("")),
  format: z.string().max(60).optional().or(z.literal("")),
  url: z.url("Enter a valid URL"),
});
export type BillTextVersionInput = z.infer<typeof billTextVersionSchema>;

export interface BillCosponsor {
  id: string;
  billId: string;
  entityId: string;
  date: string;
  isOriginal: boolean;
  createdAt: string;
}

export interface BillAction {
  id: string;
  billId: string;
  date: string;
  chamber: string;
  text: string;
  actionType: string;
  createdAt: string;
}

export interface BillCommittee {
  id: string;
  billId: string;
  name: string;
  chamber: string;
  activity: string;
  createdAt: string;
}

export interface BillRelation {
  id: string;
  billId: string;
  relatedExternalId: string;
  relatedBillId: string | null;
  relatedBillNumber: string;
  relatedTitle: string;
  relationshipType: string;
  createdAt: string;
}

export interface BillTextVersion {
  id: string;
  billId: string;
  versionType: string;
  date: string;
  format: string;
  url: string;
  createdAt: string;
}
