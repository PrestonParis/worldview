import type { ReactNode } from "react";
import { RecordVisit } from "@/components/tools/shell/recent";
import { ToolBreadcrumb } from "@/components/tools/shell/tool-shell";
import { ProfileHero } from "@/components/people/profile/profile-hero";
import { ProfileNav } from "@/components/people/profile/profile-nav";
import { profileTabs, tabHref } from "@/lib/people/profile-modules";
import { loadProfileShell } from "@/lib/people/profile-route";
import { heroRoles, keyFacts, updatedOn } from "@/lib/people/profile-view";

export const revalidate = 604800;

// Nothing prebuilt; each case file and tab is rendered on first request, then
// cached. Declared on the layout so every tab below it is cached too.
export async function generateStaticParams() {
  return [];
}

const ORG_TYPES = new Set(["organization", "company"]);

// A Subpoena case file: breadcrumb, hero and tab navigation, shared by every
// tab. Each tab is its own cached route below this layout.
export default async function ProfileLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shell = await loadProfileShell(slug);
  // Merged and unknown slugs are redirected or 404ed by the page.
  if (!shell) return children;
  const { bundle, base, tabs } = shell;
  const { entity } = bundle;

  return (
    <article className="mx-auto max-w-6xl pb-16">
      <ToolBreadcrumb
        items={[
          { label: "Subpoena", href: "/subpoena" },
          { label: ORG_TYPES.has(entity.type) ? "Organizations" : "People" },
          { label: entity.name },
        ]}
      />
      <RecordVisit tool="subpoena" href={base} label={entity.name} />
      <ProfileHero
        entity={entity}
        summary={bundle.editorial?.summary || bundle.legacy?.dek || entity.description || ""}
        roles={heroRoles(bundle)}
        facts={keyFacts(bundle, base)}
        updated={updatedOn(bundle)}
      />
      <ProfileNav
        base={base}
        tabs={profileTabs.filter((t) => tabs.has(t.id)).map((t) => ({ id: t.id, label: t.label, href: tabHref(base, t.id) }))}
      />
      <div className="mt-8">{children}</div>
    </article>
  );
}
