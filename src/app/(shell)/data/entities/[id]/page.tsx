import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntity } from "@/lib/neo4j/entities";
import { parseHighlights } from "@/lib/validation/entity";
import { entityColors } from "@/lib/entity-colors";
import { buttonVariants } from "@/components/ui/button";

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export default async function EntityProfilePage({
  params,
}: PageProps<"/data/entities/[id]">) {
  const { id } = await params;
  const entity = await getEntity(id);
  if (!entity) notFound();

  const colors = entityColors[entity.type];
  const highlights = parseHighlights(entity.highlights);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-start gap-5">
        {entity.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URLs, not app assets
          <img
            src={entity.imageUrl}
            alt={entity.name}
            className="h-24 w-24 shrink-0 rounded-full border-2 object-cover"
            style={{ borderColor: colors.border }}
          />
        ) : (
          <div
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 text-2xl font-semibold"
            style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
          >
            {initialsOf(entity.name)}
          </div>
        )}

        <div className="min-w-0 flex-1 pt-1">
          <span
            className="inline-block rounded-full border px-2 py-0.5 text-xs font-medium"
            style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
          >
            {entity.type.replace("_", " ")}
          </span>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {entity.name}
          </h1>
        </div>

        <Link href={`/data/entities/${entity.id}/edit`} className={buttonVariants.ghost}>
          Edit
        </Link>
      </div>

      {entity.description ? (
        <p className="whitespace-pre-line text-slate-700 dark:text-slate-300">{entity.description}</p>
      ) : null}

      {highlights.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Highlights
          </h2>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-slate-700 dark:text-slate-300">
            {highlights.map((highlight, i) => (
              <li key={i}>{highlight}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!entity.description && highlights.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No description or highlights yet.{" "}
          <Link href={`/data/entities/${entity.id}/edit`} className="underline underline-offset-2">
            Add some
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
