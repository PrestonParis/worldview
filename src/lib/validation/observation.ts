import { z } from "zod";

// What an approved data partner POSTs to
// /api/data/v1/datasets/{slug}/observations (docs/data-hosting.md). One
// observation = one area_stats row: a metric's value for a place and period.

export const MAX_OBSERVATIONS_PER_REQUEST = 10_000;

const slugPart = /^[a-z0-9][a-z0-9_]{0,63}$/;

// YYYY | YYYY-MM | YYYY-MM-DD | YYYY-Qn | FYYYYY
const periodPattern = /^(\d{4})(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?|-Q([1-4]))?$|^FY(\d{4})$/;
export const periodSchema = z
  .string()
  .regex(periodPattern, "period must be YYYY, YYYY-MM, YYYY-MM-DD, YYYY-Qn, or FYYYYY");

// Geography codes the platform joins on; anything else must use a
// partner-defined level (letters/underscores) with a free-form geoid.
const geoidPatterns: Record<string, RegExp> = {
  nation: /^US$/,
  state: /^\d{2}$/,
  county: /^\d{5}$/,
  cd: /^\d{4}$/,
  sldu: /^\d{2}[0-9A-Z]{3}$/,
  sldl: /^\d{2}[0-9A-Z]{3}$/,
  place: /^\d{7}$/,
  tract: /^\d{11}$/,
};

export const metricDefinitionSchema = z.object({
  label: z.string().min(1).max(160),
  unit: z.string().min(1).max(32),
  description: z.string().max(1000).optional(),
});

export const observationSchema = z
  .object({
    metric: z.string().regex(slugPart, "metric must be lowercase letters, digits, and underscores"),
    geoLevel: z.string().regex(/^[a-z][a-z_]{0,31}$/, "geoLevel must be lowercase letters and underscores"),
    geoid: z.string().min(1).max(64),
    geoName: z.string().max(200).optional(),
    period: periodSchema,
    value: z.number().finite().nullable(),
    unit: z.string().max(32).optional(),
    metadata: z
      .record(z.string().max(64), z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.null()]))
      .optional(),
  })
  .superRefine((o, ctx) => {
    const pattern = geoidPatterns[o.geoLevel];
    if (pattern && !pattern.test(o.geoid)) {
      ctx.addIssue({
        code: "custom",
        path: ["geoid"],
        message: `geoid "${o.geoid}" is not a valid ${o.geoLevel} code`,
      });
    }
  });

export const observationBatchSchema = z.object({
  metrics: z
    .record(z.string().regex(slugPart), metricDefinitionSchema)
    .refine((m) => Object.keys(m).length <= 200, "At most 200 metric definitions.")
    .optional(),
  observations: z.array(observationSchema).min(1).max(MAX_OBSERVATIONS_PER_REQUEST),
});

export type ObservationInput = z.infer<typeof observationSchema>;
export type ObservationBatch = z.infer<typeof observationBatchSchema>;

// First day of the period, for ordering and date filters. Federal fiscal
// years start October 1 of the previous calendar year.
export function periodStart(period: string): string {
  const m = periodPattern.exec(period);
  if (!m) throw new Error(`invalid period ${period}`);
  const [, year, month, day, quarter, fiscal] = m;
  if (fiscal) return `${Number(fiscal) - 1}-10-01`;
  if (quarter) return `${year}-${String((Number(quarter) - 1) * 3 + 1).padStart(2, "0")}-01`;
  return `${year}-${month ?? "01"}-${day ?? "01"}`;
}

// Last day of the period — the inclusive upper bound for `to` filters.
export function periodEnd(period: string): string {
  const m = periodPattern.exec(period);
  if (!m) throw new Error(`invalid period ${period}`);
  const [, year, month, day, quarter, fiscal] = m;
  if (fiscal) return `${fiscal}-09-30`;
  if (day) return `${year}-${month}-${day}`;
  const lastMonth = quarter ? Number(quarter) * 3 : month ? Number(month) : 12;
  const lastDay = new Date(Date.UTC(Number(year), lastMonth, 0)).getUTCDate();
  return `${year}-${String(lastMonth).padStart(2, "0")}-${lastDay}`;
}
