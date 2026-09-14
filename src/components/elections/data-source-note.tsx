// Attribution line shown on every election view. Results are hand-entered or
// bulk-imported from public sources; Phase 2 wires the MIT Election Lab
// importer, Phase 3 the Census boundary files.
export function DataSourceNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-slate-400 dark:text-slate-500 ${className}`}>
      Election results in Worldview are entered by hand or bulk-imported from
      public sources:{" "}
      <a
        href="https://electionlab.mit.edu/data"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        MIT Election Lab
      </a>{" "}
      for returns, U.S. Census for boundaries.
    </p>
  );
}
