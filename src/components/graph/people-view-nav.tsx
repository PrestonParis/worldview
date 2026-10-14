import Link from "next/link";

export type PeopleView = "explore" | "directory";

export function PeopleViewNav({ active }: { active: PeopleView }) {
  const views: { key: PeopleView; label: string }[] = [
    { key: "explore", label: "Explore" },
    { key: "directory", label: "Directory" },
  ];

  return (
    <nav aria-label="People and Power views" className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      {views.map((view) => (
        <Link
          key={view.key}
          href={view.key === "explore" ? "/people" : `/people?view=${view.key}`}
          aria-current={active === view.key ? "page" : undefined}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            active === view.key
              ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
              : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          {view.label}
        </Link>
      ))}
    </nav>
  );
}

