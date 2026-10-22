import type { Metadata } from "next";
import Link from "next/link";
import { listOrgDirectory } from "@/lib/db/graph";
import { entityColorFor } from "@/lib/entity-colors";
import { publicEntityPath } from "@/lib/people/public";

export const metadata: Metadata = {
  title: "Organizations | Worldview",
  description: "Organizations and companies in the Worldview graph and the people connected to them.",
};

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

const TYPE_LABEL: Record<string, string> = {
  politician: "politicians",
  pundit: "pundits",
  journalist: "journalists",
  organization: "orgs",
  company: "companies",
};

export default async function OrgDirectoryPage() {
  const rows = await listOrgDirectory();
  const connected = rows.filter((r) => r.connectionCount > 0);
  const unconnected = rows.length - connected.length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ranked by how many people connect to them.
          </p>
        </div>
        <Link href="/people" className="shrink-0 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
          ← Full graph
        </Link>
      </div>

      <ul className="mt-6 flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {connected.map(({ entity, connectionCount, connectedByType }) => {
          const c = entityColorFor(entity.type);
          return (
            <li key={entity.id} className="py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={publicEntityPath(entity)}
                    className="font-medium text-slate-900 hover:underline dark:text-slate-100"
                  >
                    {entity.name}
                  </Link>
                  {entity.description ? (
                    <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                      {entity.description}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Object.entries(connectedByType)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, n]) => (
                        <span
                          key={type}
                          className="rounded-full px-2 py-0.5 text-xs"
                          style={{ background: entityColorFor(type).bg, color: entityColorFor(type).text }}
                        >
                          {n} {TYPE_LABEL[type] ?? type}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className="inline-block rounded-full border-2 px-2.5 py-1 text-sm font-semibold tabular-nums"
                    style={{ background: c.bg, borderColor: c.border, color: c.text }}
                  >
                    {connectionCount}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {connected.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          No connected organizations yet.
        </p>
      ) : null}
      {unconnected > 0 ? (
        <p className="mt-4 text-xs text-slate-400">
          {unconnected} organization{unconnected === 1 ? "" : "s"} with no relationships yet, not shown.
        </p>
      ) : null}
    </div>
  );
}
