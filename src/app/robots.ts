import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/data", "/account", "/api/", "/login", "/register", "/auth/", "/geography", "/quiz/stats"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
