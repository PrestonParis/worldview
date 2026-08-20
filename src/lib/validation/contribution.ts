import { z } from "zod";

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
