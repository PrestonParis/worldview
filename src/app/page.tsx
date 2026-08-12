import Link from "next/link";
import { toolPages, dataAdminPage } from "@/lib/nav";

export default function Home() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        This is where a project — a specific video, a specific question — pulls together
        whatever it needs from the ten pages below. For now, start by putting people,
        relationships, claims, and sources into the graph.
      </p>

      <Link
        href={dataAdminPage.href}
        className="mt-6 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Manage data →
      </Link>

      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {toolPages.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="rounded-lg border border-slate-200 p-4 transition-colors hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
          >
            <p className="font-medium text-slate-900 dark:text-slate-100">{page.label}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{page.bundles}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
