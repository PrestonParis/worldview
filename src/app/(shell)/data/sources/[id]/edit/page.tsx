import { requireContributorPage } from "@/lib/auth/guard";
import { notFound } from "next/navigation";
import { getSource } from "@/lib/db/sources";
import { SourceForm } from "@/components/forms/source-form";

export default async function EditSourcePage({
  params,
}: PageProps<"/data/sources/[id]/edit">) {
  const { id } = await params;
  await requireContributorPage(`/data/sources/${id}/edit`);
  const source = await getSource(id);
  if (!source) notFound();

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium">Edit {source.title}</h2>
      <SourceForm id={source.id} defaultValues={source} />
    </div>
  );
}
