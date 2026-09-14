import { z } from "zod";

export const lobbyingAmountKinds = ["income", "expenses"] as const;

export const lobbyingIssueSchema = z.object({
  id: z.uuid().optional(),
  issueCode: z.string().max(16).optional().or(z.literal("")),
  issueLabel: z.string().max(200).optional().or(z.literal("")),
  billId: z.uuid().optional().or(z.literal("")),
  description: z.string().max(4000).optional().or(z.literal("")),
});

export const lobbyingRegistrationSchema = z.object({
  id: z.uuid().optional(),
  clientEntityId: z.uuid("Pick the client"),
  registrantEntityId: z.uuid("Pick the lobbying firm"),
  year: z
    .string()
    .min(1, "Year is required")
    .refine((v) => /^\d{4}$/.test(v), { message: "Four-digit year" }),
  period: z.string().max(64).optional().or(z.literal("")),
  amount: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || Number(v) >= 0, { message: "Amount can't be negative" }),
  amountKind: z.enum(lobbyingAmountKinds).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  // Edited as a block on the form; the importer writes them directly.
  issues: z.array(lobbyingIssueSchema).optional(),
});

export type LobbyingRegistrationInput = z.infer<typeof lobbyingRegistrationSchema>;
export type LobbyingIssueInput = z.infer<typeof lobbyingIssueSchema>;

export interface LobbyingIssue extends Omit<LobbyingIssueInput, "billId"> {
  id: string;
  billId: string; // "" when not linked
}

export interface LobbyingRegistration
  extends Omit<LobbyingRegistrationInput, "year" | "amount" | "issues"> {
  id: string;
  year: number;
  amount: number | null;
  externalId: string;
  issues: LobbyingIssue[];
  createdAt: string;
  updatedAt: string;
}
