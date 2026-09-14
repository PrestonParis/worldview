import { z } from "zod";

// Roll calls are import-only for now (no /data editor until a later
// phase), so there's one schema — what the congress-votes importer
// upserts, keyed on `externalId`.
export const rollCallImportSchema = z.object({
  externalId: z.string().min(1),
  billId: z.uuid().nullable().optional(),
  congress: z.number().int().positive(),
  chamber: z.string().min(1).max(60),
  session: z.number().int().positive().nullable().optional(),
  rollNumber: z.number().int().nonnegative(),
  question: z.string().optional().default(""),
  voteType: z.string().optional().default(""),
  result: z.string().optional().default(""),
  date: z.string().min(1),
  sourceId: z.uuid().nullable().optional(),
});

export type RollCallImportInput = z.infer<typeof rollCallImportSchema>;

export interface RollCall {
  id: string;
  billId: string | null;
  congress: number;
  chamber: string;
  session: number | null;
  rollNumber: number;
  question: string;
  voteType: string;
  result: string;
  date: string;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}
