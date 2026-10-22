import { ExternalLink } from "lucide-react";
import { formatPartialDate, type SourceRecord } from "@/lib/people/profile-model";
import type { AttributeGroup, PanelFact } from "@/lib/people/profile-view";

// The profile's attributes as an infobox: grouped label/value rows, each with
// small links to the sources behind it.
export function AttributesPanel({ groups, updated }: { groups: AttributeGroup[]; updated?: string }) {
  if (!groups.length) return null;
  return (
    <section aria-label="Attributes" className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.id}>
            <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{group.label}</h2>
            <dl className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {group.rows.map((row) => (
                <div key={row.key} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-2 text-sm">
                  <dt className="text-slate-500 dark:text-slate-400">{row.label}</dt>
                  <dd className="min-w-0">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{row.value}</span>
                    <SourceLinks row={row} />
                    {row.detail ? <span className="mt-0.5 block leading-5 text-slate-500 dark:text-slate-400">{row.detail}</span> : null}
                    {row.asOf ? <span className="block text-slate-500">As of {formatPartialDate(row.asOf)}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      {updated ? <p className="mt-4 text-xs text-slate-500">Reviewed {formatPartialDate(updated)}</p> : null}
    </section>
  );
}

function SourceLinks({ row }: { row: PanelFact }) {
  const links: { title: string; url: string }[] = [
    ...row.sources.filter((s: SourceRecord) => s.url).map((s) => ({ title: `${s.title} (${s.publisher})`, url: s.url })),
    ...(row.link ? [{ title: row.link.label, url: row.link.url }] : []),
  ];
  if (!links.length) return null;
  // One mark per row; the hover title lists every source behind it.
  const title = links.map((l) => l.title).join("\n");
  return (
    <a
      href={links[0].url}
      target="_blank"
      rel="noreferrer"
      title={title}
      aria-label={`Sources: ${links.map((l) => l.title).join("; ")}`}
      className="ml-1 inline-flex align-middle text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300"
    >
      <ExternalLink aria-hidden className="h-3 w-3" />
    </a>
  );
}
