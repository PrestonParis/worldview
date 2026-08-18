import { z } from "zod";

export const votePositions = ["yea", "nay", "present", "absent"] as const;

export const voteSchema = z.object({
  id: z.uuid().optional(),
  billId: z.uuid(),
  voterEntityId: z.uuid("Pick who voted"),
  position: z.enum(votePositions),
});

export type VoteInput = z.infer<typeof voteSchema>;

export interface Vote extends VoteInput {
  id: string;
  createdAt: string;
}

export type VoteTally = Record<(typeof votePositions)[number], number>;
