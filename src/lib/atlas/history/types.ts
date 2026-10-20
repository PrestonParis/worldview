// The historical record for each tradition: where it came from, who made it,
// what they wrote, what happened, and where it was put into practice.

export interface PrimaryText {
  title: string;
  author: string;
  year: string;
  href?: string;
}

export interface TraditionHistory {
  origins: { when: string; where: string; founders: string[] };
  figures: string[];
  texts: PrimaryText[];
  timeline: { year: string; event: string }[];
  // Regimes, parties, and movements that put it into practice.
  practice: { name: string; detail: string }[];
}

type TextRow = [title: string, author: string, year: string, href?: string];

// Compact authoring form: tuples for the list fields.
export function h(x: {
  when: string;
  where: string;
  founders: string[];
  figures: string[];
  texts: TextRow[];
  timeline: [year: string, event: string][];
  practice: [name: string, detail: string][];
}): TraditionHistory {
  return {
    origins: { when: x.when, where: x.where, founders: x.founders },
    figures: x.figures,
    texts: x.texts.map(([title, author, year, href]) => (href ? { title, author, year, href } : { title, author, year })),
    timeline: x.timeline.map(([year, event]) => ({ year, event })),
    practice: x.practice.map(([name, detail]) => ({ name, detail })),
  };
}
