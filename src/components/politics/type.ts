// Worldview's analytical type scale and shared interaction tokens, used by
// the quiz results, Atlas entries and the compare workspace. One size per
// role; secondary text stays at slate-600/400 or darker for contrast.

export const pageTitle =
  "text-4xl leading-[1.05] font-bold tracking-tight text-balance text-slate-950 sm:text-5xl dark:text-white";
export const sectionTitle =
  "text-2xl leading-tight font-semibold tracking-tight text-balance text-slate-950 dark:text-white";
export const subhead = "text-lg leading-snug font-semibold tracking-tight text-slate-950 dark:text-white";
export const leadText = "text-base leading-7 text-slate-800 sm:text-[17px] sm:leading-[1.7] dark:text-slate-200";
export const labelText = "text-sm font-medium text-slate-800 dark:text-slate-200";
export const metaText = "text-[13px] leading-5 text-slate-600 dark:text-slate-400";
export const chartLabel = "text-xs leading-4 font-medium text-slate-600 dark:text-slate-400";

export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-white dark:focus-visible:ring-offset-slate-950";

export const panel = "rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950";

export const chip =
  "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[13px] font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
export const linkChip = `${chip} transition-colors hover:border-slate-400 hover:text-slate-950 dark:hover:border-slate-500 dark:hover:text-white ${focusRing}`;
