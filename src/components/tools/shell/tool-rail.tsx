"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { ArrowUpRight, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { RecentItems } from "./recent";
import { readStoredJson, writeStoredJson } from "@/lib/browser/storage";
import type { RailGroup, RailLink } from "@/lib/tools/shell";
import type { SuiteToolId } from "@/lib/tools/views";

function isActive(pathname: string, link: RailLink): boolean {
  return link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
}

function RailLinks({ tool, groups, recentLabel }: { tool: SuiteToolId; groups: RailGroup[]; recentLabel?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Tool navigation" className="space-y-5">
      {groups.map((group, i) => (
        <div key={group.label}>
          <p className="px-3 text-xs font-semibold text-slate-400">{group.label}</p>
          <ul className="mt-1 space-y-0.5">
            {group.links.map((link) => {
              const active = !link.leaves && isActive(pathname, link);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-slate-950 font-medium text-white dark:bg-white dark:text-slate-950"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {link.label}
                    {link.leaves ? <ArrowUpRight aria-label="Opens outside the tool" className="h-3.5 w-3.5 text-slate-400" /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          {i === 0 && recentLabel ? (
            <div className="mt-5">
              <RecentItems tool={tool} label={recentLabel} />
            </div>
          ) : null}
        </div>
      ))}
    </nav>
  );
}

const COLLAPSED_KEY = (tool: SuiteToolId) => `worldview-tool-rail-collapsed-${tool}`;
const COLLAPSED_EVENT = "worldview-tool-rail";

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COLLAPSED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Desktop: a sticky left rail that folds to a slim strip. It starts folded on
// pages no rail link covers (case files, dockets), which need the width; a
// viewer's own fold or unfold is remembered per tool. Mobile: the same links
// in a sheet under the tool bar, closed again after navigating.
export function ToolRail(props: { tool: SuiteToolId; name: string; groups: RailGroup[]; recentLabel?: string }) {
  const pathname = usePathname();
  const sheet = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (sheet.current) sheet.current.open = false;
  }, [pathname]);

  const covered = props.groups.some((g) => g.links.some((link) => !link.leaves && isActive(pathname, link)));
  const stored = useSyncExternalStore(
    subscribeCollapsed,
    () => {
      const value = readStoredJson("local", COLLAPSED_KEY(props.tool));
      return typeof value === "boolean" ? value : null;
    },
    () => null,
  );
  const collapsed = stored ?? !covered;
  const toggle = () => {
    writeStoredJson("local", COLLAPSED_KEY(props.tool), !collapsed);
    window.dispatchEvent(new Event(COLLAPSED_EVENT));
  };
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <>
      <aside className={`hidden transition-[width] duration-200 lg:block ${collapsed ? "w-10" : "w-56"}`}>
        <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pb-6">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Show ${props.name} menu` : `Hide ${props.name} menu`}
            title={collapsed ? `Show ${props.name} menu` : `Hide ${props.name} menu`}
            className={`mb-3 flex h-9 items-center gap-2 rounded-lg text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white ${
              collapsed ? "w-9 justify-center" : "w-full px-3"
            }`}
          >
            <ToggleIcon aria-hidden className="h-4 w-4 shrink-0" />
            {collapsed ? null : <span>Hide menu</span>}
          </button>
          {collapsed ? null : (
            <div className="pr-2">
              <RailLinks {...props} />
            </div>
          )}
        </div>
      </aside>
      <details ref={sheet} className="group rounded-2xl border border-slate-200 bg-white lg:hidden dark:border-slate-800 dark:bg-slate-950">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200">
          <Menu aria-hidden className="h-4 w-4" /> Browse {props.name}
        </summary>
        <div className="border-t border-slate-100 p-2 dark:border-slate-800">
          <RailLinks {...props} />
        </div>
      </details>
    </>
  );
}
