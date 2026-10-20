import type { Metadata } from "next";
import { QuizLanding, type LandingSearchParams } from "@/components/quiz/quiz-landing";
import { CATALOG } from "@/lib/quiz/catalog";

export const metadata: Metadata = {
  title: "Worldview Atlas: Find your place on the map | Worldview",
  description: `An adaptive political quiz across ${CATALOG.axes} dimensions and ${CATALOG.issues} issues that places you among ${CATALOG.traditions} political traditions, plus specialist assessments and a library of political philosophies.`,
};

export const dynamic = "force-dynamic";

export default async function AtlasPage({ searchParams }: { searchParams: Promise<LandingSearchParams> }) {
  return <QuizLanding searchParams={await searchParams} />;
}
