import { z } from "zod";

const answersSchema = z.record(z.string(), z.number().min(-1).max(1));
const matchesSchema = z.array(z.object({ id: z.string(), score: z.number().min(0).max(100) })).max(20);
const sourceQuizSlugSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/)
  .optional();

export const economicProfileSchema = z.object({
  version: z.literal(1),
  completedAt: z.iso.datetime(),
  answers: answersSchema,
  dimensions: answersSchema,
  matches: matchesSchema,
  sourceQuizSlug: sourceQuizSlugSchema,
});

export const specialistProfileSchema = z.object({
  version: z.literal(1),
  assessment: z.enum(["authority", "foreign-policy"]),
  completedAt: z.iso.datetime(),
  answers: answersSchema,
  dimensions: answersSchema,
  matches: matchesSchema,
  sourceQuizSlug: sourceQuizSlugSchema,
});

export const savedPhilosophiesSchema = z.array(z.string()).max(500);
