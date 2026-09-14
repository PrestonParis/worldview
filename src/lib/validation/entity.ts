import { z } from "zod";

export const entityTypes = [
  "politician",
  "pundit",
  "journalist",
  "organization",
  "company",
  "lobbyist",
  "donor",
] as const;

export type EntityType = (typeof entityTypes)[number];

export const entitySchema = z.object({
  id: z.uuid().optional(),
  type: z.enum(entityTypes),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  biography: z.string().max(12000).optional().or(z.literal("")),
  imageUrl: z.url("Enter a valid URL").optional().or(z.literal("")),
  websiteUrl: z.url("Enter a valid URL").optional().or(z.literal("")),
  xUrl: z.url("Enter a valid URL").optional().or(z.literal("")),
  facebookUrl: z.url("Enter a valid URL").optional().or(z.literal("")),
  instagramUrl: z.url("Enter a valid URL").optional().or(z.literal("")),
  youtubeUrl: z.url("Enter a valid URL").optional().or(z.literal("")),
  linkedinUrl: z.url("Enter a valid URL").optional().or(z.literal("")),
  // One highlight per line — kept as raw text like `metadata`, split with
  // `parseHighlights` wherever it's displayed as a list.
  highlights: z.string().max(2000).optional().or(z.literal("")),
  metadata: z.string().max(4000).optional().or(z.literal("")),
  // Stable external crosswalk key for a legislator — the Congress
  // "Bioguide" id (e.g. "P000197"). First-class, indexed, and
  // unique-constrained in Neo4j so importers can resolve a member by id
  // instead of fuzzy name matching. Empty for every non-member entity;
  // never written as "" (a uniqueness constraint treats "" as a real
  // value), so `createEntity`/`updateEntity` pass null when it's blank.
  bioguideId: z.string().max(20).optional().or(z.literal("")),
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
