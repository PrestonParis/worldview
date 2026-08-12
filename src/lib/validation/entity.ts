import { z } from "zod";

export const entityTypes = [
  "person",
  "organization",
  "bill",
  "court_case",
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
  imageUrl: z.url("Enter a valid URL").optional().or(z.literal("")),
  // One highlight per line — kept as raw text like `metadata`, split with
  // `parseHighlights` wherever it's displayed as a list.
  highlights: z.string().max(2000).optional().or(z.literal("")),
  metadata: z.string().max(4000).optional().or(z.literal("")),
});

export type EntityInput = z.infer<typeof entitySchema>;

export interface Entity extends EntityInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export function parseHighlights(highlights: string | undefined): string[] {
  return (highlights ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
