// Loads everything the quiz analytics read (src/lib/quiz/analytics.ts): live
// sessions, archived responses, and landing-page opener events. Raw SQL that
// checks what exists first, so it also works against a database that hasn't
// run 2026-10-15-quiz-analytics.sql yet.

import { sql } from "drizzle-orm";
import { db } from "./client";
import type { AnalyticsSession, OpenerEventRow } from "../quiz/analytics";
import type { QuizAnswer, RefineTargets } from "../quiz/engine";
import { validQuizMode, type DeferredQuestion, type QuizCheckpointRecord } from "../quiz/modes";
import type { OpenerAnswer } from "../quiz/openers";

type Row = Record<string, unknown>;

async function rows(query: ReturnType<typeof sql>): Promise<Row[]> {
  return (await db.execute(query)).rows as Row[];
}

const date = (v: unknown) => (v instanceof Date ? v : new Date(String(v)));

function toSession(r: Row, source: "live" | "archive"): AnalyticsSession {
  return {
    key: String(r.id),
    source,
    slug: (r.slug as string | undefined) ?? null,
    claimed: Boolean(r.owner_id),
    isTest: Boolean(r.is_test),
    bankVersion: String(r.bank_version),
    engineVersion: String(r.engine_version),
    targetMode: validQuizMode(r.target_mode, "deep"),
    highestCompletedMode: r.highest_completed_mode ? validQuizMode(r.highest_completed_mode, "quick") : null,
    entryVariant: String(r.entry_variant ?? "general"),
    entryTopic: (r.entry_topic as string | null) ?? null,
    answers: (r.answers as QuizAnswer[]) ?? [],
    refine: (r.refine as RefineTargets) ?? {},
    deferred: (r.deferred as DeferredQuestion[]) ?? [],
    checkpointHistory: (r.checkpoint_history as QuizCheckpointRecord[]) ?? [],
    createdAt: date(r.created_at),
    updatedAt: date(r.updated_at),
    completedAt: r.completed_at ? date(r.completed_at) : null,
  };
}

export async function loadQuizAnalyticsData(): Promise<{ sessions: AnalyticsSession[]; openers: OpenerEventRow[] }> {
  const [shape] = await rows(sql`select
    to_regclass('public.quiz_responses') is not null as responses,
    to_regclass('public.quiz_opener_events') is not null as openers,
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'quiz_sessions' and column_name = 'is_test') as is_test`);

  // Never the edit-token hash.
  const columns = sql.raw(`bank_version, engine_version, target_mode, highest_completed_mode, status, entry_variant,
    entry_topic, answers, refine, deferred, checkpoint_history, created_at, updated_at, completed_at`);
  const live = await rows(
    sql`select id, slug, owner_id, ${shape.is_test ? sql.raw("is_test") : sql.raw("false as is_test")}, ${columns} from quiz_sessions`,
  );
  const archived = shape.responses ? await rows(sql`select id, is_test, ${columns} from quiz_responses`) : [];
  const openers = shape.openers ? await rows(sql`select created_at, answers, started, mode from quiz_opener_events`) : [];

  return {
    sessions: [...live.map((r) => toSession(r, "live")), ...archived.map((r) => toSession(r, "archive"))],
    openers: openers.map((r) => ({
      createdAt: date(r.created_at),
      answers: (r.answers as OpenerAnswer[]) ?? [],
      started: Boolean(r.started),
      mode: r.mode ? validQuizMode(r.mode) : null,
    })),
  };
}
