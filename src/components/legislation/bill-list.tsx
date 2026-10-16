import Link from "next/link";
import { listPolicyAreas, searchBills } from "@/lib/db/bills";
import { listRollCallCountsByBill } from "@/lib/db/rollCalls";
import { findMemberIdsByName, getEntityNames } from "@/lib/db/entities";
import { billStatuses } from "@/lib/validation/bill";
import { EmptyState } from "@/components/empty-state";
import { DataFreshness } from "./data-freshness";
import { formatBillStatus, StatusPill } from "./bill-status";
import type { PageContent } from "@/lib/pages-content";

const PAGE_SIZE = 50;

export interface BillListParams {
  q?: string;
  status?: string;
  chamber?: string;
  policy?: string;
  page?: string;
}

const formatDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";

const field =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

// Server-rendered, paginated bill list. Filters are a plain GET form, so the
// URL is shareable and the page ships one page of bills, not the Congress.
// Callers (page.tsx files) must also export `dynamic = "force-dynamic"`.
export async function BillList({ content, params }: { content: PageContent; params: BillListParams }) {
  const q = params.q?.trim() ?? "";
  const status = billStatuses.includes(params.status as (typeof billStatuses)[number]) ? params.status : undefined;
  const chamber = params.chamber === "House" || params.chamber === "Senate" ? params.chamber : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const [sponsorIds, policyAreas] = await Promise.all([findMemberIdsByName(q), listPolicyAreas()]);
  const policy = policyAreas.some((p) => p.name === params.policy) ? params.policy : undefined;
  const [{ bills, total }, rollCallCounts] = await Promise.all([
    searchBills({ q, status, chamber, policyArea: policy, sponsorIds, page, pageSize: PAGE_SIZE }),
    listRollCallCountsByBill(),
  ]);
  const sponsors = await getEntityNames([...new Set(bills.map((b) => b.sponsorEntityId).filter((id): id is string => !!id))]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(q || status || chamber || policy);

  const pageHref = (n: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (chamber) sp.set("chamber", chamber);
    if (policy) sp.set("policy", policy);
    if (n > 1) sp.set("page", String(n));
    const s = sp.toString();
    return `/legislation/bills${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/legislation" className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        ← Legislation &amp; Courts
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{content.title}</h1>
      <DataFreshness sources={["congress-bills", "congress-votes"]} className="mt-2" />

      <form action="/legislation/bills" className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Title, bill number, or sponsor"
          aria-label="Search bills"
          className={`${field} min-w-0 flex-1 basis-64`}
        />
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className={field}>
          <option value="">All statuses</option>
          {billStatuses.map((s) => (
            <option key={s} value={s}>
              {formatBillStatus(s)}
            </option>
          ))}
        </select>
        <select name="chamber" defaultValue={chamber ?? ""} aria-label="Chamber" className={field}>
          <option value="">Both chambers</option>
          <option value="House">House</option>
          <option value="Senate">Senate</option>
        </select>
        <select name="policy" defaultValue={policy ?? ""} aria-label="Policy area" className={`${field} max-w-60`}>
          <option value="">All policy areas</option>
          {policyAreas.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} ({p.count.toLocaleString("en-US")})
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
          Search
        </button>
        {filtered && (
          <Link href="/legislation/bills" className="text-sm text-slate-500 underline underline-offset-2 dark:text-slate-400">
            Clear
          </Link>
        )}
      </form>

      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        {total.toLocaleString("en-US")} {total === 1 ? "bill" : "bills"}
        {pages > 1 && ` · page ${page} of ${pages.toLocaleString("en-US")}`}
      </p>

      {total === 0 && !filtered ? (
        <div className="mt-6">
          <EmptyState
            message="No bills recorded yet. Add one by hand in"
            cta={{ href: "/data/bills", label: "Manage Data" }}
          />
        </div>
      ) : bills.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No bills match this search.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
          {bills.map((b) => {
            const rollCalls = rollCallCounts.get(b.id) ?? 0;
            return (
              <li key={b.id}>
                <Link href={`/legislation/${b.id}`} className="block py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="tabular-nums">{b.billNumber}</span>
                    <StatusPill status={b.status} />
                    {b.policyArea && <span>{b.policyArea}</span>}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-slate-900 dark:text-slate-100">{b.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {[
                      (b.sponsorEntityId && sponsors.get(b.sponsorEntityId)) || "Unknown sponsor",
                      b.chamber,
                      `Introduced ${formatDate(b.introducedDate)}`,
                      rollCalls ? `${rollCalls} roll call${rollCalls === 1 ? "" : "s"}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {b.latestActionText && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                      {formatDate(b.latestActionDate)}: {b.latestActionText}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="font-medium text-slate-900 underline underline-offset-2 dark:text-white">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          {page < pages && (
            <Link href={pageHref(page + 1)} className="font-medium text-slate-900 underline underline-offset-2 dark:text-white">
              Older →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
