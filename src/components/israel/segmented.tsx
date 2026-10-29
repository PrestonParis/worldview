"use client";

// A small pill toggle, styled like ChartCard's Chart/Table switch.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex max-w-full flex-wrap rounded-lg bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-900" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={`rounded-md px-2.5 py-1 ${
            v === value ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
