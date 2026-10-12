"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Settings, Sun, type LucideIcon } from "lucide-react";
import { setThemePref, useThemePref, type ThemePref } from "@/lib/theme";

const THEMES: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const theme = useThemePref();

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <Settings size={16} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Settings"
          className="absolute top-full right-0 z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">Appearance</p>
          <div role="radiogroup" aria-label="Theme" className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {THEMES.map(({ value, label, icon: Icon }) => {
              const active = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setThemePref(value)}
                  className={`flex flex-col items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  }`}
                >
                  <Icon size={15} aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
