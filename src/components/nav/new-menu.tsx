"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

const ITEMS = [
  { label: "Person", href: "/data/entities?add=1&type=person" },
  { label: "Organization", href: "/data/entities?add=1&type=organization" },
  { label: "Claim", href: "/data/claims?add=1" },
  { label: "Relationship", href: "/data/edges?add=1" },
  { label: "Source", href: "/data/sources?add=1" },
];

export function NewMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        <Plus size={15} />
        New
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-30 mt-2 w-44 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800">
            <Link
              href="/data"
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Manage all data →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
