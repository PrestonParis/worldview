import type { Metadata } from "next";
import Link from "next/link";
import { listEntities, getEntity } from "@/lib/neo4j/entities";
import { listSharedVotes } from "@/lib/db/votingRecord";
import { agreementRate } from "@/lib/legislation/votingRecord";
import type { votePositions } from "@/lib/validation/vote";

export const metadata: Metadata = {
  title: "Compare members | Worldview",
  description: "Compare two members of Congress vote by vote.",
};

export const dynamic = "force-dynamic";

type Position = (typeof votePositions)[number];

const POSITION_LABEL: Record<string, string> = {
  yea: "Yea",
  nay: "Nay",
  present: "Present",
  absent: "Absent",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ComparePage({
  searchParams,
}: PageProps<"/legislation/compare">) {
  const sp = await searchParams;
  const a = typeof sp.a === "string" ? sp.a : "";
  const b = typeof sp.b === "string" ? sp.b : "";

  const politicians = (await listEntities({ type: "politician" })).filter((e) => e.bioguideId);

  let body: React.ReactNode = null;
  if (a && b && a !== b) {
    const [entityA, entityB, shared] = await Promise.all([
      getEntity(a),
      getEntity(b),
      listSharedVotes(a, b),
    ]);

    const positions = new Map<string, [Position, Position]>(
      shared.map((s) => [s.rollCallId, [s.positionA, s.positionB]]),
    );
    const summary = agreementRate(positions);
    const disagreements = shared.filter(
      (s) =>
        (s.positionA === "yea" || s.positionA === "nay") &&
        (s.positionB === "yea" || s.positionB === "nay") &&
        s.positionA !== s.positionB,
    );

    body = (
      <div className="mt-8">
        <h2 className="text-lg font-medium">
          {entityA?.name ?? "?"} vs {entityB?.name ?? "?"}
        </h2>
        <p className="mt-1 text-sm tabular-nums text-slate-600 dark:text-slate-400">
          Agreed on {summary.agreed} of {summary.shared} shared roll calls —{" "}
          <span className="font-semibold">
            {summary.shared === 0 ? "—" : `${Math.round(summary.rate * 100)}%`}
          </span>
        </p>

        <h3 className="mt-6 text-sm font-medium text-slate-800 dark:text-slate-200">
          Disagreements ({disagreements.length})
        </h3>
        {disagreements.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            {summary.shared === 0
              ? "No roll calls in common yet."
              : "They agreed on every shared roll call."}
          </p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
            {disagreements.map((s) => (
              <li key={s.rollCallId} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {s.billId ? (
                      <Link href={`/legislation/${s.billId}`} className="underline underline-offset-2">
                        {s.billNumber ?? "Bill"}
                      </Link>
                    ) : (
                      <span>{s.chamber} Roll Call {s.rollNumber}</span>
                    )}
                    {s.billTitle ? <span className="text-slate-500"> — {s.billTitle}</span> : null}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {s.question || `${s.chamber} Roll Call ${s.rollNumber}`} · {formatDate(s.date)}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-slate-700 dark:text-slate-300">
                  {POSITION_LABEL[s.positionA]} / {POSITION_LABEL[s.positionB]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/legislation"
        className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        ← Legislation
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Compare voting records</h1>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        {(["a", "b"] as const).map((name) => (
          <label key={name} className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            Member {name.toUpperCase()}
            <select
              name={name}
              defaultValue={name === "a" ? a : b}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="">Select…</option>
              {politicians.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          Compare
        </button>
      </form>

      {a && b && a === b ? (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">Pick two different members.</p>
      ) : null}

      {body}
    </div>
  );
}
