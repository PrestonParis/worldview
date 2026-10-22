import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { getEntityByPublicSlug, getMergedInto } from "../db/entities";
import { loadProfileBundle, type ProfileBundle } from "../db/profile-records";
import { availableTabs, tabHref, type ProfileTabId } from "./profile-modules";
import { PROFILE_BASE, publicEntitySlug } from "./public";

// Resolves /subpoena/[slug]/<tab>: follows merges and non-canonical slugs to
// the same tab on the canonical URL, and 404s a tab the profile has no data
// for, so no module ever renders empty.

const findEntity = cache(async (slug: string) => {
  const entity = await getEntityByPublicSlug(slug);
  if (entity) return { entity, merged: null };
  const merged = await getMergedInto(slug.match(/-([0-9a-f]{8})$/i)?.[1] ?? "");
  return { entity: null, merged };
});

export interface ProfileRoute {
  bundle: ProfileBundle;
  base: string;
  tabs: Set<ProfileTabId>;
}

export async function loadProfileRoute(slug: string, tab: ProfileTabId): Promise<ProfileRoute> {
  const { entity, merged } = await findEntity(slug);
  if (!entity) {
    if (merged) permanentRedirect(tabHref(`${PROFILE_BASE}/${publicEntitySlug(merged)}`, tab));
    notFound();
  }
  const canonical = publicEntitySlug(entity);
  if (slug !== canonical) permanentRedirect(tabHref(`${PROFILE_BASE}/${canonical}`, tab));
  const bundle = await loadProfileBundle(entity);
  const tabs = availableTabs(bundle);
  if (!tabs.has(tab)) notFound();
  return { bundle, base: `${PROFILE_BASE}/${canonical}`, tabs };
}

/** For the layout: the same lookup without tab checks or redirects. */
export async function loadProfileShell(slug: string): Promise<ProfileRoute | null> {
  const { entity } = await findEntity(slug);
  if (!entity) return null;
  const bundle = await loadProfileBundle(entity);
  return { bundle, base: `${PROFILE_BASE}/${publicEntitySlug(entity)}`, tabs: availableTabs(bundle) };
}
