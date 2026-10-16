import { z } from "zod";

// Roll calls are import-only for now (no /data editor until a later
// phase), so there's one schema — what the congress-votes importer
// upserts, keyed on `externalId`.
export const rollCallImportSchema = z.object({
  externalId: z.string().min(1),
  billId: z.uuid().nullable().optional(),
  // "us" for Congress, or a state's postal code; state roll calls have no congress.
  jurisdiction: z.string().min(2).max(10).optional().default("us"),
  congress: z.number().int().positive().nullable(),
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
  jurisdiction: string;
  congress: number | null;
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
