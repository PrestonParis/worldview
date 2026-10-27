import type { Metadata } from "next";
import Link from "next/link";
import { PhilosophyExplorer } from "@/components/atlas/philosophy-explorer";
import { philosophyProfiles } from "@/lib/atlas/philosophies";

export const metadata: Metadata = { title: "Explore political philosophies · Worldview Atlas", description: "Browse political, economic, social, religious, and governing traditions in the Worldview Atlas." };

export default function PhilosophiesPage() {
  return <div className="mx-auto max-w-6xl pb-12"><header className="max-w-3xl"><Link href="/atlas" className="text-sm text-slate-500 hover:text-slate-950 dark:hover:text-white">← Atlas</Link><p className="mt-8 text-xs font-semibold tracking-[.16em] text-slate-400 uppercase">Reference library</p><h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-6xl">Explore political philosophies</h1><p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">Every tradition Atlas can match you to: where it began, who founded it, what they wrote, and where it took power.</p></header><div className="mt-10"><PhilosophyExplorer profiles={philosophyProfiles} /></div></div>;
}
