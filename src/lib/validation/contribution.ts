import { z } from "zod";

export const contributionTypes = [
  "individual",
  "pac",
  "super_pac",
  "party",
  "committee",
  "other",
] as const;

export type ContributionType = (typeof contributionTypes)[number];

export const contributionSchema = z.object({
  id: z.uuid().optional(),
  donorEntityId: z.uuid("Pick the donor"),
  recipientEntityId: z.uuid("Pick the recipient"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => Number(v) > 0, { message: "Amount must be greater than 0" }),
  currency: z.string().max(10).optional().or(z.literal("")),
  date: z.string().min(1, "Date is required"),
  sourceRecordId: z.uuid().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  // Phase 2 classification / geography. All optional — imported rows and the
  // hand-entry form may leave any of them blank. Geography is per-filing
  // (the donor's address on that contribution); industry is a coarse slug
  // (see src/lib/money/industries.ts).
  contributionType: z.enum(contributionTypes).optional().or(z.literal("")),
  donorState: z.string().max(64).optional().or(z.literal("")),
  donorCity: z.string().max(120).optional().or(z.literal("")),
  donorZip: z.string().max(16).optional().or(z.literal("")),
  donorIndustry: z.string().max(64).optional().or(z.literal("")),
  employer: z.string().max(200).optional().or(z.literal("")),
  occupation: z.string().max(200).optional().or(z.literal("")),
});

export type ContributionInput = z.infer<typeof contributionSchema>;

export interface Contribution extends Omit<ContributionInput, "amount"> {
  id: string;
  amount: number;
  // Idempotency key for imported rows (e.g. FEC's schedule_a `sub_id`) —
  // "" for anything entered by hand; never set through this app's own
  // create/update form (see contributionSchema — it's deliberately absent
  // there, written only by import scripts via a direct SQL insert).
  externalId: string;
  createdAt: string;
  updatedAt: string;
}
