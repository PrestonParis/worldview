// Attribution line shown on every election view. Results are hand-entered or
// bulk-imported from public sources; a cycle being counted also names where
// its votes and calls come from.
export function DataSourceNote({ className = "", liveCount = false }: { className?: string; liveCount?: boolean }) {
  const electionLab = (
    <a href="https://electionlab.mit.edu/data" target="_blank" rel="noreferrer" className="underline underline-offset-2">
      MIT Election Lab
    </a>
  );
  return (
    <p className={`text-xs text-slate-400 dark:text-slate-500 ${className}`}>
      {liveCount ? (
        <>
          Votes and race calls from the Associated Press and The New York Times, checked against Wikipedia, which also
          supplies the candidate lists. Past results from {electionLab}, boundaries from the U.S. Census.
        </>
      ) : (
        <>
          Election results in Worldview are entered by hand or bulk-imported from public sources: {electionLab} for
          returns, U.S. Census for boundaries.
        </>
      )}
    </p>
  );
}
