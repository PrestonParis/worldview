import type { ChartSource } from "@/components/charts/chart-card";
import type { DatasetWithCoverage } from "@/components/data/dataset-list";
import { formatPeriod } from "@/lib/format";

// What a page's chart says it draws on: a catalog dataset, and optionally
// the original producer when the dataset republishes others' figures (FRED,
// Our World in Data). `label` is the fallback when the dataset isn't loaded.
export interface SourceSpec {
  label: string;
  href: string; // /datasets/<slug>
  by?: string;
}

const accessed = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : null;

/** A dataset as a citation: author, title, years covered, date accessed. */
export function citation(ds: DatasetWithCoverage, by?: string): ChartSource {
  const c = ds.coverage;
  const span = c?.firstPeriod
    ? c.firstPeriod === c.lastPeriod
      ? formatPeriod(c.firstPeriod)
      : `${formatPeriod(c.firstPeriod)}–${formatPeriod(c.lastPeriod ?? "")}`
    : null;
  const date = accessed(c?.lastUpdated ?? null);
  return {
    href: `/datasets/${ds.slug}`,
    label: (
      <>
        {by ?? ds.publisher}. <cite>{ds.title}</cite>.{span && ` ${span}.`}
        {date && ` Accessed ${date}.`}
      </>
    ),
  };
}

/** Turns a page's source specs into citations, keyed the same way. */
export function citeSources<K extends string>(specs: Record<K, SourceSpec>, datasets: DatasetWithCoverage[]): Record<K, ChartSource> {
  const bySlug = new Map(datasets.map((ds) => [ds.slug, ds]));
  return Object.fromEntries(
    Object.entries<SourceSpec>(specs).map(([key, spec]) => {
      const ds = bySlug.get(spec.href.replace(/^\/datasets\//, ""));
      return [key, ds ? citation(ds, spec.by) : { label: spec.label, href: spec.href }];
    }),
  ) as Record<K, ChartSource>;
}

/** Citations for the given catalog slugs, skipping any not loaded. */
export function citeFrom(datasets: DatasetWithCoverage[], ...slugs: string[]): ChartSource[] {
  return slugs.flatMap((slug) => {
    const ds = datasets.find((x) => x.slug === slug);
    return ds ? [citation(ds)] : [];
  });
}
