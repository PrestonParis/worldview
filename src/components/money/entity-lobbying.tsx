import Link from "next/link";
import { formatAmount } from "@/lib/money";
import type { LobbyingRegistration } from "@/lib/validation/lobbying";
import type { Entity } from "@/lib/validation/entity";

function summarize(regs: LobbyingRegistration[], counterpartyOf: (r: LobbyingRegistration) => string) {
  const by = new Map<string, { total: number; filings: number; years: Set<number> }>();
  for (const r of regs) {
    const k = counterpartyOf(r);
    const cur = by.get(k) ?? { total: 0, filings: 0, years: new Set<number>() };
    cur.total += r.amount ?? 0;
    cur.filings += 1;
    cur.years.add(r.year);
    by.set(k, cur);
  }
  return [...by.entries()]
    .map(([entityId, v]) => ({ entityId, ...v }))
    .sort((a, b) => b.total - a.total || b.filings - a.filings);
}

function Row({
  rows,
  entitiesById,
}: {
  rows: ReturnType<typeof summarize>;
  entitiesById: Map<string, Entity>;
}) {
  return (
    <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map((row) => {
        const e = entitiesById.get(row.entityId);
        const years = [...row.years].sort();
        return (
          <li key={row.entityId} className="flex items-center justify-between gap-4 py-2 text-sm">
            <Link
              href={e ? `/data/entities/${e.id}` : "#"}
              className="min-w-0 truncate font-medium text-slate-800 hover:underline dark:text-slate-200"
            >
              {e?.name ?? "Unknown entity"}
            </Link>
            <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-400">
              {row.total > 0 ? formatAmount(row.total, "USD") : `${row.filings} filing${row.filings === 1 ? "" : "s"}`}
              <span className="ml-2 text-xs text-slate-400">
                {years[0]}
                {years.length > 1 ? `–${years[years.length - 1]}` : ""}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function EntityLobbying({
  registrations,
  entityId,
  entitiesById,
}: {
  registrations: LobbyingRegistration[];
  entityId: string;
  entitiesById: Map<string, Entity>;
}) {
  if (registrations.length === 0) return null;
  const asClient = registrations.filter((r) => r.clientEntityId === entityId);
  const asFirm = registrations.filter((r) => r.registrantEntityId === entityId);

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Lobbying</h2>
      <div className="mt-2 grid gap-6 sm:grid-cols-2">
        {asClient.length > 0 ? (
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Firms hired
            </h3>
            <Row rows={summarize(asClient, (r) => r.registrantEntityId)} entitiesById={entitiesById} />
          </div>
        ) : null}
        {asFirm.length > 0 ? (
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Clients represented
            </h3>
            <Row rows={summarize(asFirm, (r) => r.clientEntityId)} entitiesById={entitiesById} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
