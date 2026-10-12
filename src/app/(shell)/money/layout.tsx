import { Suspense } from "react";
import { MoneyTabs } from "@/components/money/money-tabs";

// Every /money view reads live Postgres + Neo4j; never prerender.
export const dynamic = "force-dynamic";

export default function MoneyLayout({ children }: LayoutProps<"/money">) {
  return (
    <div className="flex h-full flex-col">
      <Suspense fallback={<div className="h-11 border-b border-slate-200 dark:border-slate-800" />}>
        <MoneyTabs />
      </Suspense>
      <div className="mt-8 flex-1">{children}</div>
    </div>
  );
}
