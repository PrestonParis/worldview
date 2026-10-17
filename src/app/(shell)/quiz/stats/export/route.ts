import { NextResponse, type NextRequest } from "next/server";
import { currentUserIsOwner } from "@/lib/auth/guard";
import { loadQuizAnalyticsData } from "@/lib/db/quizAnalytics";
import { analyzeQuiz, itemsExport, toCsv, RESPONSE_COLUMNS, SESSION_COLUMNS } from "@/lib/quiz/analytics";
import { analyticsOptions, parseFilters } from "../filters";

// Owner-only downloads for /quiz/stats, the same files as
// `npm run quiz:stats -- --export`. Respondents are numbered, not linked.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await currentUserIsOwner())) return new NextResponse(null, { status: 404 });
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const file = params.file;
  const now = new Date();
  const { sessions, openers } = await loadQuizAnalyticsData();
  const a = analyzeQuiz(sessions, openers, { ...analyticsOptions(parseFilters(params), now), withResponses: file === "responses.csv" });
  const stamp = now.toISOString().slice(0, 10);
  const send = (body: string, type: string, name: string) =>
    new NextResponse(body, {
      headers: { "content-type": type, "content-disposition": `attachment; filename="quiz-${stamp}-${name}"`, "cache-control": "no-store" },
    });

  if (file === "responses.csv") return send(toCsv(a.responses ?? [], RESPONSE_COLUMNS), "text/csv; charset=utf-8", "responses.csv");
  if (file === "sessions.csv") return send(toCsv(a.sessions, SESSION_COLUMNS), "text/csv; charset=utf-8", "sessions.csv");
  if (file === "items.json") return send(JSON.stringify(itemsExport(a), null, 2), "application/json", "items.json");
  return new NextResponse(null, { status: 404 });
}
