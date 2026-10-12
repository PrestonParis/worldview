import type { Metadata } from "next";
import { BillList } from "@/components/legislation/bill-list";
import { pagesContent } from "@/lib/pages-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bills | Worldview" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return (
    <BillList
      content={{ ...pagesContent["legislation"], title: "Bills" }}
      params={{ q: one(sp.q), status: one(sp.status), chamber: one(sp.chamber), policy: one(sp.policy), page: one(sp.page) }}
    />
  );
}
