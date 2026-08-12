import { z } from "zod";

export const edgeSchema = z
  .object({
    id: z.uuid().optional(),
    sourceEntityId: z.uuid("Pick a source entity"),
    targetEntityId: z.uuid("Pick a target entity"),
    label: z.string().min(1, "Relationship label is required").max(120),
    validFrom: z.string().optional().or(z.literal("")),
    validTo: z.string().optional().or(z.literal("")),
    notes: z.string().max(2000).optional().or(z.literal("")),
    sourceRecordId: z.uuid().optional().or(z.literal("")),
  })
  .refine((v) => v.sourceEntityId !== v.targetEntityId, {
    message: "An entity can't be related to itself",
    path: ["targetEntityId"],
  });

export type EdgeInput = z.infer<typeof edgeSchema>;

export interface Edge extends EdgeInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}
