"use client";

import { EntitySearch } from "./entity-search";
import { useRouter } from "next/navigation";

export function PeopleSearch({
  large = false,
}: {
  large?: boolean;
}) {
  const router = useRouter();
  return (
    <div className={large ? "[&>div]:w-full [&_input]:h-14 [&_input]:rounded-xl [&_input]:text-base" : ""}>
      <EntitySearch
        placeholder="Search people, organizations, committees and groups"
        onSelect={(entity) => router.push(entity.href)}
      />
    </div>
  );
}

