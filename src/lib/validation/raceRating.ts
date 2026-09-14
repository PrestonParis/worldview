import { z } from "zod";

export const raceRatings = [
  "safe_d",
  "likely_d",
  "lean_d",
  "tossup",
  "lean_r",
  "likely_r",
  "safe_r",
  "safe_i",
] as const;

export type Rating = (typeof raceRatings)[number];

export const raceRatingSchema = z.object({
  id: z.uuid().optional(),
  electionId: z.uuid(),
  source: z.string().min(1, "Source is required").max(60),
  rating: z.enum(raceRatings),
  asOf: z.string().min(1, "asOf date is required"),
  url: z.string().max(500).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type RaceRatingInput = z.infer<typeof raceRatingSchema>;

export interface RaceRating extends Omit<RaceRatingInput, "url" | "notes"> {
  id: string;
  url: string;
  notes: string;
  externalId: string;
  createdAt: string;
}

// Signed lean, D-positive: safe_d = +3 … tossup = 0 … safe_r = -3.
// `safe_i` (Sanders/King-type seats) is its own thing — 0 lean, its own party.
export function ratingLean(rating: Rating): number {
  const scale: Record<Rating, number> = {
    safe_d: 3,
    likely_d: 2,
    lean_d: 1,
    tossup: 0,
    lean_r: -1,
    likely_r: -2,
    safe_r: -3,
    safe_i: 0,
  };
  return scale[rating];
}

// Which party a rating implies wins, for seat math. Tossups return "tossup".
export function ratingWinner(rating: Rating): "D" | "R" | "I" | "tossup" {
  if (rating === "tossup") return "tossup";
  if (rating === "safe_i") return "I";
  return ratingLean(rating) > 0 ? "D" : "R";
}

const LABELS: Record<Rating, string> = {
  safe_d: "Safe D",
  likely_d: "Likely D",
  lean_d: "Lean D",
  tossup: "Toss-up",
  lean_r: "Lean R",
  likely_r: "Likely R",
  safe_r: "Safe R",
  safe_i: "Safe I",
};

export function ratingLabel(rating: Rating): string {
  return LABELS[rating];
}

// Parse a handicapper's free-text rating ("Leans Republican", "Toss Up",
// "Safe D", "Likely Dem") into the enum, or null if it doesn't look like one.
export function parseRating(raw: string): Rating | null {
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, " ");
  if (/toss ?up/.test(s)) return "tossup";
  const party = /\b(d|dem|democrat|democratic)\b/.test(s)
    ? "d"
    : /\b(r|rep|republican|gop)\b/.test(s)
      ? "r"
      : /\b(i|ind|independent)\b/.test(s)
        ? "i"
        : null;
  if (!party) return null;
  if (party === "i") return "safe_i";
  const strength = /\bsafe|solid\b/.test(s)
    ? "safe"
    : /\blikely\b/.test(s)
      ? "likely"
      : /\blean/.test(s)
        ? "lean"
        : "safe"; // a bare "R"/"D" from a chamber-projection table = safe
  return `${strength}_${party}` as Rating;
}
