import { z } from "zod";

export const votePositions = ["yea", "nay", "present", "absent"] as const;

// The hand-entry path (the VotesEditor on /data/bills/[id]/edit): a
// bill-level tally row, no roll call.
export const voteSchema = z.object({
  id: z.uuid().optional(),
  billId: z.uuid(),
  voterEntityId: z.uuid("Pick who voted"),
  position: z.enum(votePositions),
});

export type VoteInput = z.infer<typeof voteSchema>;

// One member's position in a specific roll call, as written by the
// congress-votes importer.
export const rollCallVoteSchema = z.object({
  rollCallId: z.uuid(),
  billId: z.uuid().nullable().optional(),
  voterEntityId: z.uuid(),
  position: z.enum(votePositions),
  party: z.string().max(60).optional().default(""),
});

export type RollCallVoteInput = z.infer<typeof rollCallVoteSchema>;

export interface Vote {
  id: string;
  billId: string | null;
  rollCallId: string | null;
  voterEntityId: string;
  position: (typeof votePositions)[number];
  party: string | null;
  createdAt: string;
}

export type VoteTally = Record<(typeof votePositions)[number], number>;

export function emptyTally(): VoteTally {
  return { yea: 0, nay: 0, present: 0, absent: 0 };
}
