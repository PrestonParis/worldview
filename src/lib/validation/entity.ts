import { z } from "zod";

export const entityTypes = [
  "politician",
  "judge",
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
  // Curated profiles may carry structured, claim-level facts and biography
  // sections with citations. Keep this as JSON text for backwards
  // compatibility, but allow enough room for a genuinely useful dossier.
  metadata: z.string().max(24000).optional().or(z.literal("")),
  // Stable external crosswalk key for a legislator — the Congress
  // "Bioguide" id (e.g. "P000197"), stored in entity_identifiers, where it
  // is unique, so importers can resolve a member by id instead of fuzzy
  // name matching. Empty for every non-member entity.
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
