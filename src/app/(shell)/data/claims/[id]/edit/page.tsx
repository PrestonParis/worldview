import { requireContributorPage } from "@/lib/auth/guard";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { claims as claimsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { listClaims } from "@/lib/db/claims";
import { listSources } from "@/lib/db/sources";
import { listEntities } from "@/lib/db/entities";
import { ClaimForm } from "@/components/forms/claim-form";

export default async function EditClaimPage({
  params,
}: PageProps<"/data/claims/[id]/edit">) {
  const { id } = await params;
  await requireContributorPage(`/data/claims/${id}/edit`);
  const [row, entities, sources, claims] = await Promise.all([
    db.query.claims.findFirst({ where: eq(claimsTable.id, id) }),
    listEntities(),
    listSources(),
    listClaims(),
  ]);
  if (!row) notFound();

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium">Edit claim</h2>
      <ClaimForm
        id={id}
        defaultValues={{
          speakerEntityId: row.speakerEntityId,
          date: row.date.toISOString().slice(0, 10),
          venue: row.venue ?? "",
          quote: row.quote,
          topic: row.topic ?? "",
          positionClassification: row.positionClassification ?? "",
          confidence: row.confidence != null ? String(row.confidence) : "",
          contradictsClaimId: row.contradictsClaimId ?? "",
          sourceId: row.sourceId ?? "",
        }}
        entities={entities}
        sources={sources}
        claims={claims}
      />
    </div>
  );
}
