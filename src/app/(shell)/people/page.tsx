import { GraphPage } from "@/components/graph/graph-page";
import { pagesContent } from "@/lib/pages-content";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: PageProps<"/people">) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  return (
    <GraphPage
      content={pagesContent["people"]}
      params={{
        root: first(params.root),
        depth: first(params.depth),
        type: first(params.type),
        hubs: first(params.hubs),
        rel: first(params.rel),
      }}
    />
  );
}
