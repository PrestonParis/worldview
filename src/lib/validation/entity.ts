import { z } from "zod";

export const entityTypes = [
  "person",
  "organization",
  "bill",
  "election",
  "country",
  "company",
] as const;

export type EntityType = (typeof entityTypes)[number];

export const entitySchema = z.object({
  id: z.uuid().optional(),
  type: z.enum(entityTypes),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  metadata: z.string().max(4000).optional().or(z.literal("")),
});

export type EntityInput = z.infer<typeof entitySchema>;

export interface Entity extends EntityInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}
