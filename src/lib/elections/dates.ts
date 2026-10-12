const DAY_MS = 24 * 60 * 60 * 1000;

/** Federal general elections are held on the Tuesday after the first Monday in November. */
export function federalGeneralElectionDate(year: number): string {
  const first = new Date(Date.UTC(year, 10, 1));
  const firstMondayOffset = (8 - first.getUTCDay()) % 7;
  const electionDay = 2 + firstMondayOffset;
  return `${year}-11-${String(electionDay).padStart(2, "0")}`;
}

export function dateOnly(value: string | Date): string {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

export function validateFederalElectionDate(input: {
  level: string;
  electionType: string;
  electionDate: string;
}): string | null {
  if (input.level !== "federal" || input.electionType !== "general") return null;
  const year = Number(dateOnly(input.electionDate).slice(0, 4));
  if (!Number.isInteger(year) || year % 2 !== 0) return "Federal general elections must use an even-numbered election year";
  const expected = federalGeneralElectionDate(year);
  return dateOnly(input.electionDate) === expected ? null : `Federal general election date must be ${expected}`;
}

export function daysUntilElection(electionDate: string, now = new Date()): number {
  const [year, month, day] = electionDate.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((target - today) / DAY_MS);
}
