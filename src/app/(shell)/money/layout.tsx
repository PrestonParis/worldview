import Link from "next/link";

// Every /money view reads live Postgres + Neo4j; never prerender.
export const dynamic = "force-dynamic";

// Tabs are added here as each Money & Influence phase ships (Map, Lobbying,
// Revolving Door still to come; see docs/money-influence-plan.md).
const tabs = [
  { href: "/money", label: "Network" },
  { href: "/money/industries", label: "Industries" },
  { href: "/money/map", label: "Map" },
  { href: "/money/lobbying", label: "Lobbying" },
];

export default function MoneyLayout({ children }: LayoutProps<"/money">) {
  return (
    <div className="flex h-full flex-col">
      <nav className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
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
      <div className="mt-4 flex-1">{children}</div>
    </div>
  );
}
