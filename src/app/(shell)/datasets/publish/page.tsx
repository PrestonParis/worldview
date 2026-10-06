import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Publish data | Worldview",
  description: "How research institutions, agencies, and newsrooms publish datasets on Worldview.",
};

const STEPS = [
  ["Request access", "Tell us who you are, what the dataset measures, and how it was produced. Partners are universities, research centers, think tanks, government offices, and newsrooms."],
  ["Get approved", "We review the institution and the methodology. Approved partners receive an API key and one or more dataset slots, named after the institution."],
  ["Push your data", "Send observations to the partner API from a script or pipeline. Values can be updated at any time by sending them again."],
  ["Go live", "We review the first upload with you; once published, the dataset appears in the catalog with your institution's name, your method notes, and an open API for readers."],
];

const EXAMPLE = `curl -X POST https://<worldview-host>/api/data/v1/datasets/<partner>-<dataset>/observations \\
  -H "Authorization: Bearer wvp_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "metrics": {
      "removals": { "label": "Removals", "unit": "people",
                    "description": "Removals carried out by ICE, by state of apprehension." }
    },
    "observations": [
      { "metric": "removals", "geoLevel": "nation", "geoid": "US", "period": "FY2025", "value": 123456 },
      { "metric": "removals", "geoLevel": "state",  "geoid": "48", "period": "FY2025", "value": 4567,
        "metadata": { "moe": 89 } }
    ]
  }'`;

const FIELDS = [
  ["metric", "Lowercase name, e.g. removals or asylum_grant_rate. Define each new metric's label and unit in \"metrics\" the first time you send it."],
  ["geoLevel / geoid", "nation → US · state → 2-digit FIPS (48) · county → 5-digit FIPS (48201) · cd → state FIPS + district (4807) · place, tract → Census GEOIDs. Other levels (e.g. immigration_court) take your own codes."],
  ["period", "2025, 2025-08, 2025-08-15, 2025-Q3, or FY2025 (federal fiscal year, starting October 1)."],
  ["value", "A number, or null for a suppressed or unavailable cell."],
  ["metadata", "Optional object stored with the value — margins of error, footnotes, sample sizes."],
];

export default function PublishPage() {
  const contact = process.env.DATA_PARTNERS_CONTACT;
  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <header>
        <Link href="/datasets" className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          ← Datasets
        </Link>
        <p className="mt-6 text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">Data partners</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">Publish your data on Worldview</h1>
        <p className="mt-3 text-base leading-7 text-slate-500 dark:text-slate-400">
          Institutions with permission can publish datasets directly to the platform. Your data sits beside federal sources
          on the same maps and charts, credited to you, with your methodology attached.
        </p>
        {contact && (
          <a href={`mailto:${contact}?subject=Worldview data partnership`} className="mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900">
            Request access
          </a>
        )}
      </header>

      <ol className="grid gap-4 sm:grid-cols-2">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-400">Step {i + 1}</p>
            <p className="mt-1 font-semibold text-slate-950 dark:text-white">{title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p>
          </li>
        ))}
      </ol>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-950 dark:text-white">The partner API</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          One request writes up to 10,000 values. Sending a value again for the same metric, place, and period replaces it.
          Invalid rows are rejected with the reason, and nothing from that request is written.
        </p>
        <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{EXAMPLE}</pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Fields</h2>
        <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {FIELDS.map(([k, v]) => (
            <div key={k} className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr]">
              <dt className="font-mono text-xs text-slate-900 dark:text-white">{k}</dt>
              <dd className="text-sm text-slate-600 dark:text-slate-300">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
