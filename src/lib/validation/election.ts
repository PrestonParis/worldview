import { z } from "zod";

export const electionLevels = ["federal", "state", "local"] as const;
export const electionTypes = ["general", "primary", "runoff", "special"] as const;
export const electionStatuses = [
  "scheduled",
  "provisional",
  "certified",
] as const;

const optionalCount = z
  .string()
  .max(15)
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || (Number.isFinite(Number(v)) && Number(v) >= 0), {
    message: "Must be a non-negative number",
  });

export const electionSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().min(1, "Name is required").max(300),
  office: z.string().min(1, "Office is required").max(120),
  jurisdiction: z.string().min(1, "Jurisdiction is required").max(120),
  level: z.enum(electionLevels),
  electionType: z.enum(electionTypes),
  status: z.enum(electionStatuses),
  electionDate: z.string().min(1, "Election date is required"),
  totalVotes: optionalCount,
  // Self-references — the picker offers other elections or "none".
  priorElectionId: z.uuid().optional().or(z.literal("")),
  parentElectionId: z.uuid().optional().or(z.literal("")),
  notes: z.string().max(4000).optional().or(z.literal("")),
});

export type ElectionInput = z.infer<typeof electionSchema>;

export interface Election extends Omit<ElectionInput, "totalVotes"> {
  id: string;
  totalVotes: number | null;
  // "" for hand-entered rows; set only by import scripts / ingest.
  externalId: string;
  // Election year, denormalized from electionDate. Set by every importer.
  cycle: number | null;
  openSeat: boolean;
  // U.S. Senate class (1/2/3); null for other offices.
  seatClass: number | null;
  createdAt: string;
  updatedAt: string;
}
