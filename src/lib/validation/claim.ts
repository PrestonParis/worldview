import { z } from "zod";

export const claimSchema = z.object({
  id: z.uuid().optional(),
  speakerEntityId: z.uuid("Pick who said this"),
  date: z.string().min(1, "Date is required"),
  venue: z.string().max(200).optional().or(z.literal("")),
  quote: z.string().min(1, "Quote is required").max(4000),
  topic: z.string().max(200).optional().or(z.literal("")),
  positionClassification: z.string().max(200).optional().or(z.literal("")),
  confidence: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || (Number(v) >= 0 && Number(v) <= 100), {
      message: "Confidence must be between 0 and 100",
    }),
  contradictsClaimId: z.uuid().optional().or(z.literal("")),
  sourceId: z.uuid().optional().or(z.literal("")),
});

export type ClaimInput = z.infer<typeof claimSchema>;

export interface Claim extends Omit<ClaimInput, "confidence"> {
  id: string;
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
}
