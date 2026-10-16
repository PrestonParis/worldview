import Link from "next/link";
import { DataFreshness } from "@/components/legislation/data-freshness";
import { getCurrentUser } from "@/lib/auth/session";
import { isEditor } from "@/lib/auth/guard";

// This section always reads live data — never prerender it statically.
export const dynamic = "force-dynamic";

const tabs = [
  { href: "/data/entities", label: "Entities" },
  { href: "/data/edges", label: "Relationships" },
  { href: "/data/claims", label: "Claims" },
  { href: "/data/sources", label: "Sources" },
  { href: "/data/bills", label: "Bills" },
  { href: "/data/contributions", label: "Contributions" },
  { href: "/data/lobbying", label: "Lobbying" },
  { href: "/data/elections", label: "Elections" },
];

export default async function DataLayout({ children }: LayoutProps<"/data">) {
  const user = await getCurrentUser();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Manage Data</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        The primitives every page draws from: entities and their relationships,
        claims, sources, bills (with their votes), contributions, lobbying filings,
        and elections (with their candidacies).
      </p>
      <DataFreshness sources={["congress-bills", "congress-votes"]} className="mt-3" />
      {!user ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/login?next=/data" className="font-medium text-slate-700 underline underline-offset-2 dark:text-slate-200">
            Sign in
          </Link>{" "}
          with an editor account to add or edit records.
        </p>
      ) : !isEditor(user) ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Your account can view these records. Editing is limited to editors.
        </p>
      ) : null}

      <nav className="mt-6 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-t-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">{children}</div>
    </div>
  );
}
