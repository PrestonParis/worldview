import { requireContributorPage } from "@/lib/auth/guard";
import { notFound } from "next/navigation";
import { getEntity } from "@/lib/neo4j/entities";
import { EntityForm } from "@/components/forms/entity-form";

export default async function EditEntityPage({
  params,
}: PageProps<"/data/entities/[id]/edit">) {
  const { id } = await params;
  await requireContributorPage(`/data/entities/${id}/edit`);
  const entity = await getEntity(id);
  if (!entity) notFound();

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium">Edit {entity.name}</h2>
      <EntityForm id={entity.id} defaultValues={entity} />
    </div>
  );
}
