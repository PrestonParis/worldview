import { EntitySectionsPage } from "@/components/entities/entity-sections-page";
import { pagesContent } from "@/lib/pages-content";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <EntitySectionsPage
      content={pagesContent["elections"]}
      sections={[{ type: "election", heading: "Elections" }]}
      emptyMessage="No elections yet — add one as an entity (type: election) in"
    />
  );
}
