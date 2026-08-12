import Link from "next/link";
import { toolPages, dataAdminPage } from "@/lib/nav";
import { countEntities, listRecentEntities } from "@/lib/neo4j/entities";
import { countEdges } from "@/lib/neo4j/edges";
import { countClaims, listRecentClaims } from "@/lib/db/claims";
import { countSources } from "@/lib/db/sources";
import { entityColors } from "@/lib/entity-colors";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [entityCount, edgeCount, claimCount, sourceCount, recentEntities, recentClaims] =
    await Promise.all([
      countEntities(),
      countEdges(),
      countClaims(),
      countSources(),
      listRecentEntities(5),
      listRecentClaims(5),
    ]);

  const stats = [
    { label: "Entities", value: entityCount, href: "/data/entities" },
    { label: "Relationships", value: edgeCount, href: "/data/edges" },
    { label: "Claims", value: claimCount, href: "/data/claims" },
    { label: "Sources", value: sourceCount, href: "/data/sources" },
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
      <p className="mt-1 max-w-2xl text-slate-500 dark:text-slate-400">
        This is where a project — a specific video, a specific question — pulls together
        whatever it needs from the ten pages below. For now, start by putting people,
        relationships, claims, and sources into the graph.
      </p>

      <Link
        href={dataAdminPage.href}
        className="mt-6 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Manage data →
      </Link>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.href}
            href={stat.href}
            className="rounded-lg border border-slate-200 p-4 transition-colors hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
          >
            <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Recently added entities
          </h2>
          <ul className="mt-3 flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
            {recentEntities.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-2.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full border-2"
                  style={{
                    background: entityColors[e.type].bg,
                    borderColor: entityColors[e.type].border,
                  }}
                />
                <Link
                  href={`/data/entities/${e.id}/edit`}
                  className="truncate text-sm text-slate-700 hover:underline dark:text-slate-300"
                >
                  {e.name}
                </Link>
              </li>
            ))}
            {recentEntities.length === 0 ? (
              <p className="py-2.5 text-sm text-slate-400">Nothing yet.</p>
            ) : null}
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Recently added claims
          </h2>
          <ul className="mt-3 flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
            {recentClaims.map((c) => (
              <li key={c.id} className="py-2.5">
                <Link
                  href={`/data/claims/${c.id}/edit`}
                  className="block truncate text-sm text-slate-700 hover:underline dark:text-slate-300"
                >
                  &ldquo;{c.quote}&rdquo;
                </Link>
              </li>
            ))}
            {recentClaims.length === 0 ? (
              <p className="py-2.5 text-sm text-slate-400">Nothing yet.</p>
            ) : null}
          </ul>
        </div>
      </div>

      <h2 className="mt-10 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Pages
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {toolPages.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="rounded-lg border border-slate-200 p-4 transition-colors hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
          >
            <p className="font-medium text-slate-900 dark:text-slate-100">{page.label}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{page.bundles}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
