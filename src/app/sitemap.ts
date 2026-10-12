import type { MetadataRoute } from "next";
import { toolPages } from "@/lib/nav";
import { SITE_URL } from "@/lib/site";

const EXTRA = ["/legislation/bills", "/money/candidates", "/money/donors", "/money/outside-spending", "/money/lobbying", "/money/contributions", "/money/industries", "/money/map", "/people/orgs", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", ...toolPages.map((page) => page.href), ...EXTRA].map((path) => ({ url: `${SITE_URL}${path}` }));
}
