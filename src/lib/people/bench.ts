// Pure helpers for the Supreme Court view (src/components/people/court-bench.tsx),
// kept apart from the loader so the client bundle never pulls in the database.

// Bench seating as seen from the audience: the Chief Justice in the middle,
// the senior associate to the Chief's right (audience left), and so on
// outward, alternating sides.
export function benchOrder<T extends { seniority: number }>(justices: T[]): T[] {
  const sorted = [...justices].sort((a, b) => a.seniority - b.seniority);
  const left = sorted.filter((j) => j.seniority % 2 === 1).reverse();
  const right = sorted.filter((j) => j.seniority > 0 && j.seniority % 2 === 0);
  return [...left, ...sorted.filter((j) => j.seniority === 0), ...right];
}
