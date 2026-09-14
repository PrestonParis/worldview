import Link from "next/link";
import { getAdministration } from "@/lib/neo4j/graph";
import { entityColorFor } from "@/lib/entity-colors";

export const dynamic = "force-dynamic";

const SECTOR_LABEL: Record<string, string> = {
  elected: "Former elected official",
  industry: "From industry",
  "think-tank": "From a think tank",
  media: "From media",
  government: "Career government",
  military: "From the military",
  campaign: "Campaign staff",
  activist: "Activist / advocacy",
  academia: "From academia",
};

export default async function AdministrationPage() {
  const admin = await getAdministration();

  if (!admin) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          No administration imported yet. Run{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
            node scripts/import-administration.mjs
          </code>
          .
        </p>
      </div>
    );
  }

  const { president, roles } = admin;
  const bySector = roles.reduce<Record<string, number>>((acc, r) => {
    if (r.priorSector) acc[r.priorSector] = (acc[r.priorSector] ?? 0) + 1;
    return acc;
  }, {});
  const c = entityColorFor(president.type);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            The executive branch under{" "}
            <Link href={`/data/entities/${president.id}`} className="font-medium text-slate-700 hover:underline dark:text-slate-300">
              {president.name}
            </Link>{" "}
            ({roles.length} appointees).
          </p>
        </div>
        <Link
          href={`/people?root=${president.id}&depth=1`}
          className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
        >
          View in graph →
        </Link>
      </div>

      {Object.keys(bySector).length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {Object.entries(bySector)
            .sort((a, b) => b[1] - a[1])
            .map(([sector, n]) => (
              <span
                key={sector}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {n} {SECTOR_LABEL[sector] ?? sector}
              </span>
            ))}
        </div>
      ) : null}

      <ul className="mt-6 flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {roles.map((r) => (
          <li key={r.person.id} className="flex items-start gap-3 py-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full border-2"
              style={{ background: c.bg, borderColor: c.border }}
            />
            <div className="min-w-0 flex-1">
              <Link
                href={`/data/entities/${r.person.id}`}
                className="font-medium text-slate-900 hover:underline dark:text-slate-100"
              >
                {r.person.name}
              </Link>
              <p className="text-sm text-slate-500 dark:text-slate-400">{r.title}</p>
            </div>
            <div className="shrink-0 text-right text-xs text-slate-400">
              {r.department ? (
                <Link href={`/people/orgs/${r.department.id}`} className="hover:text-slate-600 dark:hover:text-slate-300">
                  {r.department.name}
                </Link>
              ) : null}
              {r.priorSector ? (
                <p className="mt-0.5">{SECTOR_LABEL[r.priorSector] ?? r.priorSector}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
