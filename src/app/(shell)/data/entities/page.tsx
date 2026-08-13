import Link from "next/link";
import { listEntities } from "@/lib/neo4j/entities";
import { EntityForm } from "@/components/forms/entity-form";
import { AddPanel } from "@/components/forms/add-panel";
import { DeleteButton } from "@/components/forms/delete-button";
import { deleteEntityAction } from "@/lib/actions/entities";
import { entityTypes, type EntityType } from "@/lib/validation/entity";

export default async function EntitiesPage({
  searchParams,
}: PageProps<"/data/entities">) {
  const [entities, params] = await Promise.all([listEntities(), searchParams]);
  const requestedType = Array.isArray(params.type) ? params.type[0] : params.type;
  const defaultType = entityTypes.includes(requestedType as EntityType)
    ? (requestedType as EntityType)
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <AddPanel label="+ Add entity" defaultOpen={params.add === "1"}>
        <EntityForm defaultValues={defaultType ? { type: defaultType } : undefined} />
      </AddPanel>

      <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {entities.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <Link
                href={`/data/entities/${e.id}`}
                className="block truncate font-medium text-slate-900 hover:underline dark:text-slate-100"
              >
                {e.name}
              </Link>
              <p className="text-xs text-slate-500 dark:text-slate-400">{e.type}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href={`/data/entities/${e.id}/edit`}
                className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Edit
              </Link>
              <DeleteButton id={e.id} label={e.name} action={deleteEntityAction} />
            </div>
          </li>
        ))}
        {entities.length === 0 ? (
          <p className="py-6 text-sm text-slate-500 dark:text-slate-400">
            No entities yet — add the first politician, pundit, journalist, organization, or company above.
          </p>
        ) : null}
      </ul>
    </div>
  );
}
