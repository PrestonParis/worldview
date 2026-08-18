import Link from "next/link";

// This section always reads live data (Neo4j + Postgres) — never prerender it statically.
export const dynamic = "force-dynamic";

const tabs = [
  { href: "/data/entities", label: "Entities" },
  { href: "/data/edges", label: "Relationships" },
  { href: "/data/claims", label: "Claims" },
  { href: "/data/sources", label: "Sources" },
  { href: "/data/bills", label: "Bills" },
];

export default function DataLayout({ children }: LayoutProps<"/data">) {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Manage Data</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        The five primitives every page draws from. Entities and relationships live in
        Neo4j; claims, sources, and bills (with their votes) live in Postgres.
      </p>

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
