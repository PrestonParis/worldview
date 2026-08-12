"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { toolPages, dataAdminPage } from "@/lib/nav";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
        active
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-slate-200 px-4 py-6 dark:border-slate-800">
      <Link href="/" className="px-3 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        Worldview
      </Link>

      <nav className="flex flex-col gap-1">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Pages
        </p>
        {toolPages.map((page) => (
          <NavLink key={page.href} href={page.href} label={page.label} />
        ))}
      </nav>

      <nav className="flex flex-col gap-1">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Data
        </p>
        <NavLink href={dataAdminPage.href} label={dataAdminPage.label} />
      </nav>
    </aside>
  );
}
