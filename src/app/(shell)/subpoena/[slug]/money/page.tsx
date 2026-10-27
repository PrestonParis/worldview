import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Info, Wallet } from "lucide-react";
import { TimeSeriesChart, type Series } from "@/components/charts/time-series-chart";
import { EntityLobbying } from "@/components/money/entity-lobbying";
import { ContributionExplorer, type ExplorerRow } from "@/components/people/profile/contribution-explorer";
import { Evidence } from "@/components/people/profile/evidence";
import { SectionHeading } from "@/components/people/profile/module-card";
import { getEntityByPublicSlug } from "@/lib/db/entities";
import { recipientKindLabels, recipientKindNotes, type RecipientKind } from "@/lib/money/recipient-kinds";
import {
  formatPartialDate,
  formatUsd,
  formatUsdShort,
  spanLabel,
  summarizeGiving,
  type FlowRecord,
} from "@/lib/people/profile-model";
import { loadProfileRoute } from "@/lib/people/profile-route";
import { directTies, nameOf, sourcesFor, sourcesByKey } from "@/lib/people/profile-view";

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entity = await getEntityByPublicSlug((await params).slug);
  return { title: entity ? `${entity.name}: political money | Worldview` : "Profile not found | Worldview" };
}

// The three groups the cycle chart stacks. Unlimited outside-spending money
// is kept apart from capped gifts to campaigns and parties.
const GROUPS: { id: string; label: string; slot: 1 | 2 | 3; kinds: RecipientKind[] }[] = [
  { id: "outside", label: "Super PACs and hybrid PACs", slot: 1, kinds: ["super_pac", "hybrid_pac"] },
  { id: "party", label: "Parties and joint fundraising", slot: 2, kinds: ["party", "joint_fundraising"] },
  { id: "direct", label: "Candidates and PACs", slot: 3, kinds: ["candidate", "pac", "other"] },
];

const CORPORATE = new Set([
  "co-founded",
  "founded",
  "board-member-of",
  "invested-in",
  "works-for",
  "former-role",
  "chairs",
]);

export default async function MoneyPage({ params }: Props) {
  const { slug } = await params;
  const { bundle } = await loadProfileRoute(slug, "money");
  const { entity } = bundle;
  const giving = summarizeGiving(bundle.given);
  const { lobbying } = bundle;

  // Every cycle from first to last, so a cycle with no giving reads as a
  // gap rather than disappearing.
  const cycles: number[] = [];
  for (let c = giving.byCycle[0]?.cycle ?? 0; c && c <= (giving.byCycle.at(-1)?.cycle ?? 0); c += 2) cycles.push(c);
  const byCycle = new Map(giving.byCycle.map((c) => [c.cycle, c]));
  const series: Series[] = GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    slot: g.slot,
    points: cycles.map((c) => ({
      x: c,
      label: `${c - 1}–${String(c).slice(2)}`,
      value: g.kinds.reduce((t, k) => t + (byCycle.get(c)?.byKind[k] ?? 0), 0),
    })),
  }));
  const fecSources = sourcesFor(bundle, [...new Set(bundle.given.map((g) => g.sourceId))]);
  const explorerRows: ExplorerRow[] = bundle.given.map((g) => ({
    ...g,
    recipientName: nameOf(bundle, g.recipientEntityId),
    recipientHref: bundle.entities.get(g.recipientEntityId)?.href ?? "#",
  }));
  const interests = directTies(bundle).filter(
    (t) =>
      CORPORATE.has(t.edge.relType) && ["company", "organization"].includes(bundle.entities.get(t.otherId)?.type ?? ""),
  );
  const worth = bundle.facts.find((f) => f.key === "net-worth");
  const coverage = bundle.editorial?.coverage.money;
  const received = bundle.received.raised.find((r) => r.currency === "USD");
  const byKey = sourcesByKey(bundle);

  // Candidates backed with this person's money: direct gifts to the campaign,
  // and supporting spending by committees they funded that cycle.
  const backed = new Map<string, { direct: number; outside: number; cycles: Set<number> }>();
  const back = (id: string) =>
    backed.get(id) ?? backed.set(id, { direct: 0, outside: 0, cycles: new Set<number>() }).get(id)!;
  for (const g of bundle.given) {
    if (g.memo || g.kind !== "candidate") continue;
    const b = back(g.recipientEntityId);
    b.direct += g.amount;
    b.cycles.add(g.cycle);
  }
  for (const f of bundle.flows) {
    if (f.supportOppose !== "support" || !f.candidateEntityId) continue;
    const b = back(f.candidateEntityId);
    b.outside += f.total;
    b.cycles.add(f.cycle);
  }
  const candidates = [...backed.entries()]
    .filter(([id]) => bundle.entities.get(id)?.type === "politician")
    .sort((a, b) => b[1].outside + b[1].direct - (a[1].outside + a[1].direct))
    .slice(0, 12);

  return (
    <div className="space-y-14">
      <div>
        <SectionHeading
          tab="money"
          title="Political money"
          dek="Federal contributions reported to the FEC, by the kind of committee that received them."
        />
        {coverage ? (
          <p className="flex max-w-[68ch] gap-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            <Info aria-hidden className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
            {coverage}
          </p>
        ) : null}
      </div>

      {giving.count ? (
        <>
          <section aria-labelledby="cycles-heading">
            <h3 id="cycles-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
              Contributions by election cycle
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Two-year federal cycles, by the kind of committee that received the money.
            </p>
            <div className="mt-4 rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
              <TimeSeriesChart series={series} type="column" unit="usd" height={300} />
            </div>
            <Evidence sources={fecSources} sourcesByKey={byKey} label="filing source" />
          </section>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <section aria-labelledby="kinds-heading">
              <h3 id="kinds-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
                By recipient type
              </h3>
              <ul className="mt-4 space-y-4">
                {giving.byKind.map((k, i) => (
                  <li key={k.kind}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {recipientKindLabels[k.kind]}
                      </span>
                      <span className="font-semibold tabular-nums">{formatUsd(k.total)}</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="wv-grow h-2 rounded-full bg-(--viz-series-1)"
                        style={
                          {
                            width: `${Math.max(0.6, (k.total / giving.total) * 100)}%`,
                            "--i": i,
                          } as React.CSSProperties
                        }
                      />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {(k.total / giving.total).toLocaleString("en-US", { style: "percent", maximumFractionDigits: 1 })}{" "}
                      · {k.count} gifts · {recipientKindNotes[k.kind]}
                    </p>
                  </li>
                ))}
              </ul>
              {giving.byParty.length ? (
                <div className="mt-8">
                  <h4 className="font-semibold text-slate-950 dark:text-white">Party, where FEC records one</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Candidate campaigns and party committees only; super PACs file without a party.
                  </p>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {giving.byParty.map((p) => (
                      <li key={p.party} className="flex justify-between gap-3">
                        <span>{p.party}</span>
                        <span className="font-medium tabular-nums">{formatUsd(p.total, { compact: false })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <section aria-labelledby="recipients-heading">
              <h3 id="recipients-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
                Largest recipients
              </h3>
              <ol className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {giving.byRecipient.slice(0, 12).map((r) => {
                  const other = bundle.entities.get(r.entityId);
                  return (
                    <li key={r.entityId} className="flex items-center justify-between gap-4 py-2.5">
                      <div className="min-w-0">
                        <Link
                          href={other?.href ?? "#"}
                          className="font-medium text-slate-900 hover:text-indigo-700 dark:text-slate-100 dark:hover:text-indigo-300"
                        >
                          {other?.name ?? "Unknown committee"}
                        </Link>
                        <p className="text-sm text-slate-500">
                          {recipientKindLabels[r.kind].replace(/s$/, "")} · {r.count} gift{r.count === 1 ? "" : "s"} ·{" "}
                          {r.first.slice(0, 4) === r.last.slice(0, 4)
                            ? r.first.slice(0, 4)
                            : `${r.first.slice(0, 4)}–${r.last.slice(0, 4)}`}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">{formatUsdShort(r.total)}</span>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>

          {bundle.flows.length ? <Flows bundle={bundle} flows={bundle.flows} /> : null}

          {candidates.length ? (
            <section aria-labelledby="backed-heading">
              <h3 id="backed-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
                Candidates backed
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Direct gifts to the campaign, and supporting spending by committees funded that cycle.
              </p>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-medium">
                        Candidate
                      </th>
                      <th scope="col" className="px-4 py-2.5 font-medium">
                        Cycles
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">
                        Direct gifts
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">
                        Funded committees&rsquo; support
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {candidates.map(([id, b]) => {
                      const c = bundle.entities.get(id)!;
                      return (
                        <tr key={id}>
                          <td className="px-4 py-2.5">
                            <Link
                              href={c.href}
                              className="font-medium hover:text-indigo-700 dark:hover:text-indigo-300"
                            >
                              {c.name}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 tabular-nums">{[...b.cycles].sort().join(", ")}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {b.direct ? formatUsd(b.direct, { compact: false }) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                            {b.outside ? formatUsd(b.outside) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section aria-labelledby="records-heading">
            <h3 id="records-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
              Every contribution
            </h3>
            <p className="mt-1 mb-4 text-sm text-slate-500">The itemized lines behind every figure on this page.</p>
            <ContributionExplorer rows={explorerRows} />
          </section>
        </>
      ) : null}

      {received?.count ? (
        <section aria-labelledby="received-heading">
          <h3 id="received-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
            Contributions received
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {formatUsd(received.total)} in {received.count} recorded contributions. Largest donors:
          </p>
          <ol className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {bundle.received.topDonors.map((d) => {
              const other = bundle.entities.get(d.entityId);
              return (
                <li key={`${d.entityId}:${d.currency}`} className="flex justify-between gap-4 py-2 text-sm">
                  <Link
                    href={other?.href ?? "#"}
                    className="font-medium hover:text-indigo-700 dark:hover:text-indigo-300"
                  >
                    {other?.name ?? "Unknown donor"}
                  </Link>
                  <span className="tabular-nums">{formatUsd(d.total, { compact: false })}</span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {bundle.outside.length ? (
        <section aria-labelledby="outside-heading">
          <h3 id="outside-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
            Outside spending in {entity.name}&rsquo;s races
          </h3>
          <p className="mt-1 max-w-[68ch] text-sm leading-6 text-slate-500">
            Independent expenditures reported on FEC Schedule E, with each committee&rsquo;s largest itemized donors
            that cycle.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Committee
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Cycle
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    Spent
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Largest donors that cycle
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bundle.outside.map((o) => {
                  const committee = bundle.entities.get(o.committeeEntityId);
                  return (
                    <tr key={`${o.committeeId}:${o.cycle}:${o.supportOppose}`}>
                      <td className="px-4 py-2.5">
                        {committee ? (
                          <Link
                            href={committee.href}
                            className="font-medium hover:text-indigo-700 dark:hover:text-indigo-300"
                          >
                            {committee.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{o.committeeName || o.committeeId}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 tabular-nums">{o.cycle}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                        <span
                          className={
                            o.supportOppose === "support"
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-rose-700 dark:text-rose-400"
                          }
                        >
                          {o.supportOppose === "support" ? "For" : "Against"}
                        </span>{" "}
                        <span className="font-medium">{formatUsd(o.total)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                        {o.topDonors.length
                          ? o.topDonors.map((d, i) => {
                              const donor = bundle.entities.get(d.entityId);
                              return (
                                <span key={d.entityId}>
                                  {i ? ", " : ""}
                                  <Link
                                    href={donor?.href ?? "#"}
                                    className="hover:text-indigo-700 dark:hover:text-indigo-300"
                                  >
                                    {donor?.name ?? "Unknown"}
                                  </Link>{" "}
                                  ({formatUsdShort(d.total)})
                                </span>
                              );
                            })
                          : "Donor records not imported"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {interests.length || worth ? (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {interests.length ? (
            <section aria-labelledby="interests-heading">
              <h3 id="interests-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
                Companies and investments
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Business roles and holdings, kept apart from political spending.
              </p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {interests.map((t) => {
                  const other = bundle.entities.get(t.otherId);
                  return (
                    <li key={t.edge.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <Link
                        href={other?.href ?? "#"}
                        className="font-semibold text-slate-900 hover:text-indigo-700 dark:text-slate-100 dark:hover:text-indigo-300"
                      >
                        {other?.name}
                      </Link>
                      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                        {t.edge.role || t.verb}
                        {spanLabel(t.edge.validFrom, t.edge.validTo)
                          ? ` · ${spanLabel(t.edge.validFrom, t.edge.validTo)}`
                          : ""}
                      </p>
                      <Evidence sources={sourcesFor(bundle, t.edge.sourceIds)} sourcesByKey={byKey} />
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          {worth ? (
            <section
              aria-labelledby="worth-heading"
              className="self-start rounded-3xl border border-slate-200 p-5 dark:border-slate-800"
            >
              <h3 id="worth-heading" className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
                <Wallet aria-hidden className="h-4 w-4 text-slate-400" /> Personal wealth
              </h3>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{worth.value}</p>
              <p className="text-sm text-slate-500">
                {worth.detail}
                {worth.asOf ? `, ${formatPartialDate(worth.asOf)}` : ""}.
              </p>
              <Evidence sources={sourcesFor(bundle, worth.sourceIds)} sourcesByKey={byKey} />
            </section>
          ) : null}
        </div>
      ) : null}

      {lobbying.length ? (
        <EntityLobbying registrations={lobbying} entityId={entity.id} entitiesById={bundle.entities} />
      ) : null}
    </div>
  );
}

// What committees the subject funded then spent, cycle by cycle. A
// committee's spending is paid from all of its receipts, so the two sides
// are shown next to each other, not joined into one flow.
function Flows({
  bundle,
  flows,
}: {
  bundle: Awaited<ReturnType<typeof loadProfileRoute>>["bundle"];
  flows: FlowRecord[];
}) {
  const groups = new Map<string, FlowRecord[]>();
  for (const f of flows)
    groups.set(`${f.committeeId}:${f.cycle}`, [...(groups.get(`${f.committeeId}:${f.cycle}`) ?? []), f]);
  const given = (committeeId: string, cycle: number) =>
    bundle.given
      .filter((g) => !g.memo && g.committeeId === committeeId && g.cycle === cycle)
      .reduce((t, g) => t + g.amount, 0);
  const rows = [...groups.values()]
    .map((list) => ({ list: list.sort((a, b) => b.total - a.total), gift: given(list[0].committeeId, list[0].cycle) }))
    .sort((a, b) => b.gift - a.gift);
  const max = Math.max(...rows.flatMap((r) => [r.gift, ...r.list.map((f) => f.total)]));

  return (
    <section aria-labelledby="flows-heading">
      <h3 id="flows-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
        What funded committees spent
      </h3>
      <p className="mt-1 max-w-[68ch] text-sm leading-6 text-slate-500">
        Independent expenditures (FEC Schedule E) by committees {bundle.entity.name} gave to, in the same cycle.
      </p>
      <div className="mt-5 space-y-5">
        {rows.map(({ list, gift }) => {
          const first = list[0];
          const committee = bundle.entities.get(first.committeeEntityId);
          return (
            <div
              key={`${first.committeeId}:${first.cycle}`}
              className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 p-5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.3fr)] md:items-center dark:border-slate-800"
            >
              <div>
                <p className="text-sm text-slate-500">
                  {first.cycle} cycle · {bundle.entity.name} gave
                </p>
                <p className="text-xl font-semibold tabular-nums">{formatUsd(gift)}</p>
                <Link
                  href={committee?.href ?? "#"}
                  className="font-medium text-slate-900 hover:text-indigo-700 dark:text-slate-100 dark:hover:text-indigo-300"
                >
                  to {committee?.name ?? first.committeeId}
                </Link>
                <div
                  className="mt-2 h-2 rounded-full bg-(--viz-series-1)"
                  style={{ width: `${Math.max(2, (gift / max) * 100)}%` }}
                />
              </div>
              <ArrowRight aria-hidden className="hidden h-5 w-5 text-slate-400 md:block" />
              <ul className="space-y-2.5">
                {list.slice(0, 5).map((f) => {
                  const candidate = f.candidateEntityId ? bundle.entities.get(f.candidateEntityId) : null;
                  const name = candidate?.name ?? f.candidateName;
                  return (
                    <li key={`${f.candidateId}:${f.supportOppose}`}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span>
                          <span
                            className={
                              f.supportOppose === "support"
                                ? "font-semibold text-emerald-700 dark:text-emerald-400"
                                : "font-semibold text-rose-700 dark:text-rose-400"
                            }
                          >
                            {f.supportOppose === "support" ? "Supporting" : "Opposing"}
                          </span>{" "}
                          {candidate ? (
                            <Link
                              href={candidate.href}
                              className="font-medium hover:text-indigo-700 dark:hover:text-indigo-300"
                            >
                              {name}
                            </Link>
                          ) : (
                            name
                          )}
                        </span>
                        <span className="font-medium tabular-nums">{formatUsd(f.total)}</span>
                      </div>
                      <div
                        className={`mt-1 h-1.5 rounded-full ${f.supportOppose === "support" ? "bg-emerald-500/80" : "bg-rose-500/70"}`}
                        style={{ width: `${Math.max(1, (f.total / max) * 100)}%` }}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
