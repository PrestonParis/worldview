import type { MetadataRoute } from "next";
import { toolPages } from "@/lib/nav";
import { STATES_51 } from "@/lib/geo/states";
import { SITE_URL } from "@/lib/site";
import { stateSlug } from "@/lib/states/slug";

const EXTRA = ["/legislation/bills", "/money/candidates", "/money/donors", "/money/outside-spending", "/money/lobbying", "/money/contributions", "/money/industries", "/money/map", "/people/orgs", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const states = STATES_51.map((s) => `/states/${stateSlug(s.name)}`);
  return ["/", ...toolPages.map((page) => page.href), ...EXTRA, ...states].map((path) => ({ url: `${SITE_URL}${path}` }));
}
