import Link from "next/link";
import { formatAmount } from "@/lib/money";
import type {
  CounterpartyTotal,
  CurrencyTotal,
  EntityContributionSummary,
} from "@/lib/money";
import type { Entity } from "@/lib/validation/entity";
import { publicEntityPath } from "@/lib/people/public";

function totalsLine(totals: CurrencyTotal[]): string {
  return totals
    .map((t) => `${formatAmount(t.total, t.currency)} · ${t.count} gift${t.count === 1 ? "" : "s"}`)
    .join("  ·  ");
}

function Counterparties({
  rows,
  entitiesById,
  emptyLabel,
}: {
  rows: CounterpartyTotal[];
  entitiesById: Map<string, Entity>;
  emptyLabel: string;
}) {
  if (rows.length === 0) return <p className="mt-2 text-sm text-slate-400">{emptyLabel}</p>;
  return (
    <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map((row) => {
        const other = entitiesById.get(row.entityId);
        return (
          <li key={`${row.entityId}:${row.currency}`} className="flex items-center justify-between gap-4 py-2 text-sm">
            <Link
              href={other ? publicEntityPath(other) : "#"}
              className="min-w-0 truncate font-medium text-slate-800 hover:underline dark:text-slate-200"
            >
              {other?.name ?? "Unknown entity"}
            </Link>
            <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-400">
              {formatAmount(row.total, row.currency)}
              <span className="ml-2 text-xs text-slate-400">
                {row.count} gift{row.count === 1 ? "" : "s"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// The structured-money view for an entity profile, driven by the
// `contributions` table (real FEC amounts/dates). Hand-entered donor edges
// render separately, below this, as an unverified overlay.
export function EntityMoneySummary({
  summary,
  entitiesById,
}: {
  summary: EntityContributionSummary;
  entitiesById: Map<string, Entity>;
}) {
  const hasRaised = summary.raised.length > 0;
  const hasGiven = summary.given.length > 0;
  if (!hasRaised && !hasGiven) return null;

  return (
    <div className="mt-3 grid gap-6 sm:grid-cols-2">
      {hasRaised ? (
        <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Raised</h3>
          <p className="mt-1 text-sm tabular-nums text-slate-600 dark:text-slate-400">
            {totalsLine(summary.raised)}
          </p>
          <p className="mt-3 text-xs font-medium tracking-wide text-slate-400 uppercase">Top donors</p>
          <Counterparties
            rows={summary.topDonors}
            entitiesById={entitiesById}
            emptyLabel="No itemized donors."
          />
        </section>
      ) : null}

      {hasGiven ? (
        <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Given</h3>
          <p className="mt-1 text-sm tabular-nums text-slate-600 dark:text-slate-400">
            {totalsLine(summary.given)}
          </p>
          <p className="mt-3 text-xs font-medium tracking-wide text-slate-400 uppercase">Top recipients</p>
          <Counterparties
            rows={summary.topRecipients}
            entitiesById={entitiesById}
            emptyLabel="No itemized recipients."
          />
        </section>
      ) : null}
    </div>
  );
}
