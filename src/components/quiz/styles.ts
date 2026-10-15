// Shared surface and control classes for the quiz landing page and runner,
// so the two can't drift apart. Data colours (agree/disagree, family hues)
// stay in the components that draw data.

// A raised surface: white on the light page, translucent slate on dark.
export const card =
  "rounded-2xl bg-white shadow-sm ring-1 ring-slate-950/7 dark:bg-slate-900/60 dark:shadow-none dark:ring-white/6";

// Small sentence-case label above a value or block.
export const label = "text-sm text-slate-500 dark:text-slate-400";

// Keyboard hint chip.
export const kbd =
  "inline-flex min-w-5 items-center justify-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600 ring-1 ring-slate-950/6 dark:bg-slate-800 dark:text-slate-300 dark:ring-white/10";

// Segmented control (tabs, importance, round size). Same look as the
// immigration explorer's view switcher.
export const segmented = "inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900";
export const segmentedItem = (active: boolean) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white"
      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
  }`;

// Primary action: the site's slate-950 button, sized for a hero.
export const primaryButton =
  "group inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200";

// Quiet secondary action.
export const ghostButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-950/5 hover:text-slate-950 disabled:pointer-events-none disabled:opacity-40 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white";
