import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getOrgProfile } from "@/lib/db/graph";
import { entityColorFor } from "@/lib/entity-colors";
import { relationshipCategoryColors } from "@/lib/relationships";
import { publicEntityPath } from "@/lib/people/public";

// Rebuilt at most hourly; crawlers and visitors share the cached render.
export const revalidate = 3600;

// Nothing prebuilt; each page is rendered on first request, then cached.
export async function generateStaticParams() {
  return [];
}

const CATEGORY_LABEL: Record<string, string> = {
  institutional: "Institutional",
  employment: "Staff & advisers",
  affiliation: "Members & affiliates",
  political: "Political",
  media: "Media",
  corporate: "Money & corporate",
  personal: "Personal",
  other: "Other",
};

export default async function OrgProfilePage({ params }: PageProps<"/people/orgs/[id]">) {
  const { id } = await params;
  const profile = await getOrgProfile(id);
  if (!profile) notFound();

  const { entity, connectionsByCategory, total } = profile;
  const c = entityColorFor(entity.type);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/people/orgs"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Organizations
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <span
            className="inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize"
            style={{ background: c.bg, borderColor: c.border, color: c.text }}
          >
            {entity.type}
          </span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{entity.name}</h1>
          {entity.description ? (
            <p className="mt-1 text-slate-600 dark:text-slate-300">{entity.description}</p>
          ) : null}
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {total} connection{total === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href={`/people?root=${entity.id}&depth=1`}
          className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
        >
          View in graph →
        </Link>
      </div>

      <div className="mt-8 space-y-8">
        {connectionsByCategory.map(({ category, connections }) => (
          <section key={category}>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: relationshipCategoryColors[category as never] ?? "#94A3B8" }}
              />
              <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {CATEGORY_LABEL[category] ?? category}
                <span className="ml-2 font-normal text-slate-400">{connections.length}</span>
              </h2>
            </div>
            <ul className="mt-3 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {connections.map(({ entity: other, edge, incoming }) => (
                <li key={edge.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full border-2"
                    style={{
                      background: entityColorFor(other.type).bg,
                      borderColor: entityColorFor(other.type).border,
                    }}
                  />
                  <Link
                    href={publicEntityPath(other)}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 hover:underline dark:text-slate-200"
                  >
                    {other.name}
                  </Link>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                    {incoming ? <ArrowRight className="h-3 w-3" /> : <ArrowLeft className="h-3 w-3" />}
                    <span className="lowercase">{edge.role || edge.label}</span>
                    {edge.validFrom ? <span className="tabular-nums">· {edge.validFrom.slice(0, 4)}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
