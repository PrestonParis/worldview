// A compact chip naming a figure's period in a consistent shape — "FY 2024",
// "AUG 2026", "JUL 1, 2025" — so figures on different calendars read as
// different at a glance. `latest` adds "latest available" for sources that
// publish with a long lag; `title` explains the calendar on hover.
export interface PeriodTagProps {
  label: string;
  title?: string;
  latest?: boolean;
}

export function PeriodTag({ label, title, latest, className = "" }: PeriodTagProps & { className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 ${className}`}>
      <span
        title={title}
        className="rounded border border-slate-300 px-1.5 py-px font-mono text-[11px] font-medium tracking-wide text-slate-700 uppercase dark:border-slate-600 dark:text-slate-200"
      >
        {label}
      </span>
      {latest && <span>latest available</span>}
    </p>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Tag props for the period shapes stored in area_stats.
export const periodTags = {
  fiscalYear: (period: string): PeriodTagProps => {
    const y = Number(period.replace(/\D/g, ""));
    return { label: `FY ${y}`, title: `Federal fiscal year ${y}: October 1, ${y - 1} – September 30, ${y}` };
  },
  month: (period: string): PeriodTagProps => {
    const [y, m] = period.split("-").map(Number);
    return { label: `${MONTHS[m - 1]} ${y}`, title: `Calendar month: ${MONTHS[m - 1]} ${y}` };
  },
  trailing12: (lastMonth: string): PeriodTagProps => {
    const [y, m] = lastMonth.split("-").map(Number);
    const from = new Date(Date.UTC(y, m - 12, 1));
    return {
      label: `12 mo to ${MONTHS[m - 1]} ${y}`,
      title: `Trailing 12 months: ${MONTHS[from.getUTCMonth()]} ${from.getUTCFullYear()} – ${MONTHS[m - 1]} ${y}`,
    };
  },
  july: (year: string): PeriodTagProps => ({
    label: `Year to Jul 1, ${year}`,
    title: `Census estimate for the 12 months July 1, ${Number(year) - 1} – June 30, ${year}`,
  }),
  january: (year: string): PeriodTagProps => ({ label: `Jan 1, ${year}`, title: `Point-in-time estimate as of January 1, ${year}` }),
  survey: (year: string): PeriodTagProps => ({
    label: `${year} survey`,
    title: `American Community Survey, collected across calendar year ${year}`,
  }),
  midYear: (year: string): PeriodTagProps => ({ label: `Mid-${year}`, title: `UN estimate as of July 1, ${year}` }),
};
