import type { Metadata } from "next";
import { QuizLanding, type LandingSearchParams } from "@/components/quiz/quiz-landing";
import { CATALOG } from "@/lib/quiz/catalog";

export const metadata: Metadata = {
  title: "Worldview Atlas: Find your place on the map | Worldview",
  description: `An adaptive political quiz across ${CATALOG.axes} dimensions and ${CATALOG.issues} issues that places you among ${CATALOG.traditions} political traditions.`,
  alternates: { canonical: "/atlas" },
};

export const dynamic = "force-dynamic";

// Same page as /atlas; kept for existing links and the quiz's own routes.
export default async function QuizPage({ searchParams }: { searchParams: Promise<LandingSearchParams> }) {
  return <QuizLanding searchParams={await searchParams} />;
}
