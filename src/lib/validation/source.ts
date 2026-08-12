import { z } from "zod";

export const sourceTypes = [
  "primary",
  "secondary",
  "transcript",
  "article",
  "filing",
  "video",
  "official_statement",
] as const;

export const sourceSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().min(1, "Title is required").max(300),
  url: z.url().optional().or(z.literal("")),
  publisher: z.string().max(200).optional().or(z.literal("")),
  sourceType: z.enum(sourceTypes),
  publishedAt: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type SourceInput = z.infer<typeof sourceSchema>;

export interface Source extends SourceInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}
