type DatasetRow = {
  slug: string;
  title: string;
  publisher: string;
  sourceUrl: string | null;
  cadence: string | null;
  coverage: {
    rows: number;
    metrics: number;
    geoLevels: string[];
    firstPeriod: string | null;
    lastPeriod: string | null;
  } | null;
};

const NOTES = [
  { title: "Counts differ by source", body: "Guttmacher counts every U.S. clinician-provided abortion. CDC compiles voluntary state reports; California, Maryland and New Hampshire do not report, so CDC totals run lower." },
  { title: "Week dating", body: "The timeline counts weeks from the last menstrual period. A few state laws count from fertilization; those limits are plotted as recorded." },
  { title: "Travel cells", body: "Guttmacher does not publish state-to-state flows under 100 abortions, so residents who left can sum below the true number." },
  { title: "Not yet imported", body: "State exceptions, court orders and effective-date histories; national monthly demographics; clinic locations." },
] as const;

// The datasets behind /abortion, with their coverage, and the specifics of
// how they're measured.
export function AbortionSources({ datasets }: { datasets: DatasetRow[] }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        {datasets.map((dataset) => (
          <article key={dataset.slug} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <h4 className="font-semibold text-slate-950 dark:text-white">
              <a href={`/datasets/${dataset.slug}`} className="hover:underline">{dataset.title}</a>
            </h4>
            <p className="mt-1 text-xs text-slate-500">{dataset.publisher}{dataset.cadence ? ` · ${dataset.cadence}` : ""}</p>
            {dataset.coverage && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {dataset.coverage.rows.toLocaleString()} observations · {dataset.coverage.metrics} measures · {dataset.coverage.firstPeriod ?? "?"}–{dataset.coverage.lastPeriod ?? "?"} · {dataset.coverage.geoLevels.join(", ")}
              </p>
            )}
            {dataset.sourceUrl && <a href={dataset.sourceUrl} className="mt-2 inline-block text-xs font-medium text-sky-700 underline underline-offset-2 dark:text-sky-300">Primary source</a>}
          </article>
        ))}
      </div>
      <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {NOTES.map((note) => (
          <div key={note.title} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
            <dt className="text-sm font-semibold text-slate-950 dark:text-white">{note.title}</dt>
            <dd className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">{note.body}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
