// Record datasets: catalog entries (scripts/lib/catalog.mjs) whose rows live
// in their own tables — bills, court cases, filings — rather than in
// `area_stats`. This maps each slug to the tables it fills, so the catalog
// can count its coverage, preview its latest rows, and point to the page
// that presents it.
//
// Every SQL fragment here is a static string from this file, never input.

import { sql } from "drizzle-orm";
import { db } from "./client";

interface RecordTable {
  label: string; // "Cases", "Justice votes"
  from: string; // table plus any filter to this dataset's rows
  year: string; // integer year expression, for the coverage span
  updated?: string; // timestamp expression, for "last refreshed"
}

interface RecordPreview {
  title: string;
  columns: string[];
  query: string; // one aliased column per entry in `columns`, in order
}

interface RecordDataset {
  tables: RecordTable[];
  preview?: RecordPreview;
  explore?: { href: string; label: string };
}

export const RECORD_DATASETS: Record<string, RecordDataset> = {
  "congress-bills": {
    tables: [
      { label: "Bills", from: "bills where external_id is not null", year: "extract(year from introduced_date)", updated: "updated_at" },
      { label: "Actions", from: "bill_actions", year: "extract(year from date)" },
      { label: "Cosponsorships", from: "bill_cosponsors", year: "null" },
    ],
    preview: {
      title: "Latest bills",
      columns: ["Bill", "Title", "Latest action"],
      query: `select bill_number as a, title as b, coalesce(to_char(latest_action_date, 'Mon DD, YYYY'), '') as c
              from bills where external_id is not null order by latest_action_date desc nulls last limit 8`,
    },
    explore: { href: "/legislation", label: "Explore legislation" },
  },
  "congress-votes": {
    tables: [
      { label: "Roll calls", from: "roll_calls where external_id is not null", year: "extract(year from date)", updated: "updated_at" },
      { label: "Member votes", from: "votes where roll_call_id is not null", year: "null" },
    ],
    preview: {
      title: "Latest roll calls",
      columns: ["Date", "Chamber", "Question", "Result"],
      query: `select to_char(date, 'Mon DD, YYYY') as a, chamber as b, coalesce(question, '') as c, coalesce(result, '') as d
              from roll_calls where external_id is not null order by date desc limit 8`,
    },
    explore: { href: "/legislation", label: "Explore legislation" },
  },
  voteview: {
    tables: [{ label: "Member scores", from: "member_ideology", year: "1787 + 2 * congress", updated: "updated_at" }],
    preview: {
      title: "Most recent Congress",
      columns: ["Member", "Chamber", "State", "Liberal–conservative score"],
      query: `select bioname as a, chamber as b, coalesce(state_abbrev, '') as c, coalesce(to_char(nominate_dim1, 'FM990.000'), '') as d
              from member_ideology where congress = (select max(congress) from member_ideology)
              order by nominate_dim1 desc nulls last limit 8`,
    },
  },
  scdb: {
    tables: [
      { label: "Cases", from: "court_cases", year: "term", updated: "updated_at" },
      { label: "Justice votes", from: "case_votes", year: "null" },
    ],
    preview: {
      title: "Latest decisions",
      columns: ["Decided", "Case", "Citation", "Direction", "Vote"],
      query: `select coalesce(to_char(decision_date, 'Mon DD, YYYY'), '') as a, case_name as b, coalesce(us_cite, '') as c,
                     coalesce(decision_direction, '') as d, concat_ws('–', majority_votes, minority_votes) as e
              from court_cases order by decision_date desc nulls last limit 8`,
    },
  },
  "federal-register": {
    tables: [
      { label: "Presidential documents", from: "executive_documents where doc_type = 'Presidential Document'", year: "extract(year from publication_date)", updated: "updated_at" },
      { label: "Rules", from: "executive_documents where doc_type = 'Rule'", year: "extract(year from publication_date)", updated: "updated_at" },
      { label: "Proposed rules", from: "executive_documents where doc_type = 'Proposed Rule'", year: "extract(year from publication_date)", updated: "updated_at" },
    ],
    preview: {
      title: "Latest documents",
      columns: ["Published", "Type", "Title"],
      query: `select to_char(publication_date, 'Mon DD, YYYY') as a, coalesce(subtype, doc_type) as b, title as c
              from executive_documents order by publication_date desc, document_number desc limit 8`,
    },
  },
  fec: {
    tables: [
      { label: "Candidate totals", from: "candidate_finance", year: "cycle", updated: "updated_at" },
      { label: "Contributions", from: "contributions where external_id is not null", year: "extract(year from date)", updated: "updated_at" },
    ],
    explore: { href: "/money", label: "Explore money in politics" },
  },
  "fec-ie": {
    tables: [{ label: "Expenditures", from: "independent_expenditures", year: "extract(year from expenditure_date)", updated: "updated_at" }],
    preview: {
      title: "Largest expenditures",
      columns: ["Date", "Spender", "Candidate", "For / against", "Amount"],
      query: `select coalesce(to_char(expenditure_date, 'Mon DD, YYYY'), '') as a, coalesce(committee_name, '') as b, coalesce(candidate_name, '') as c,
                     case support_oppose when 'S' then 'Support' when 'O' then 'Oppose' else coalesce(support_oppose, '') end as d,
                     to_char(amount, 'FM$999,999,999,990') as e
              from independent_expenditures order by amount desc limit 8`,
    },
  },
  lda: {
    tables: [
      { label: "Filings", from: "lobbying_registrations where external_id is not null", year: "year", updated: "updated_at" },
      { label: "Issues lobbied", from: "lobbying_issues", year: "null" },
    ],
    explore: { href: "/money/lobbying", label: "Explore lobbying" },
  },
  "medsl-elections": {
    tables: [
      { label: "Elections", from: "elections where external_id like 'medsl:%'", year: "extract(year from election_date)", updated: "updated_at" },
      { label: "Candidacies", from: "candidacies where external_id like 'medsl:%'", year: "null" },
    ],
    preview: {
      title: "Latest elections",
      columns: ["Date", "Election", "Total votes"],
      query: `select to_char(election_date, 'Mon DD, YYYY') as a, name as b, coalesce(to_char(total_votes, 'FM999,999,999,990'), '') as c
              from elections where external_id like 'medsl:%' order by election_date desc, name limit 8`,
    },
    explore: { href: "/elections", label: "Explore elections" },
  },
  "county-results": {
    tables: [{ label: "County results", from: "election_results where external_id like 'tonmcg:%'", year: "split_part(external_id, ':', 2)::int" }],
    explore: { href: "/elections", label: "Explore elections" },
  },
  "race-ratings": {
    tables: [{ label: "Ratings", from: "race_ratings where source <> 'inferred'", year: "extract(year from as_of)" }],
    preview: {
      title: "Latest ratings",
      columns: ["As of", "Race", "Rating"],
      query: `select to_char(r.as_of, 'Mon DD, YYYY') as a, e.name as b, initcap(replace(r.rating::text, '_', ' ')) as c
              from race_ratings r join elections e on e.id = r.election_id
              where r.source <> 'inferred' order by r.as_of desc, e.name limit 8`,
    },
  },
};

export interface RecordTableCoverage {
  label: string;
  rows: number;
}

export interface RecordCoverage {
  rows: number;
  firstYear: number | null;
  lastYear: number | null;
  lastUpdated: string | null;
  tables: RecordTableCoverage[];
}

// Row counts and year span per record dataset, one round trip per table.
export async function recordCoverage(slugs: string[]): Promise<Record<string, RecordCoverage>> {
  const entries = await Promise.all(
    slugs
      .filter((slug) => RECORD_DATASETS[slug])
      .map(async (slug) => {
        const tables = await Promise.all(
          RECORD_DATASETS[slug].tables.map(async (t) => {
            const { rows } = await db.execute(
              sql.raw(
                `select count(*)::int as rows, min((${t.year})::int) as first, max((${t.year})::int) as last,
                        ${t.updated ? `max(${t.updated})::text` : "null"} as updated
                 from ${t.from}`,
              ),
            );
            const r = rows[0] as { rows: number; first: number | null; last: number | null; updated: string | null };
            return { label: t.label, ...r };
          }),
        );
        const years = tables.flatMap((t) => [t.first, t.last]).filter((y): y is number => y !== null);
        const updated = tables.map((t) => t.updated).filter((u): u is string => !!u).sort().at(-1);
        const coverage: RecordCoverage = {
          rows: tables.reduce((n, t) => n + t.rows, 0),
          firstYear: years.length ? Math.min(...years) : null,
          lastYear: years.length ? Math.max(...years) : null,
          lastUpdated: updated ? new Date(updated).toISOString() : null,
          tables: tables.map(({ label, rows }) => ({ label, rows })),
        };
        return [slug, coverage] as const;
      }),
  );
  return Object.fromEntries(entries);
}

// The dataset's latest rows, as display strings.
export async function recordPreview(slug: string): Promise<{ title: string; columns: string[]; rows: string[][] } | null> {
  const preview = RECORD_DATASETS[slug]?.preview;
  if (!preview) return null;
  const { rows } = await db.execute(sql.raw(preview.query));
  return {
    title: preview.title,
    columns: preview.columns,
    rows: rows.map((r) => Object.values(r as Record<string, unknown>).map((v) => (v == null ? "" : String(v)))),
  };
}
