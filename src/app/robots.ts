import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Query strings are filters, pages and sorts over pages crawlers already
// reach at their plain URL, and every combination is a fresh server render
// (in Oct 2026 crawlers walking /people's filters ran the site past Vercel's
// Hobby CPU allowance). src/proxy.ts turns away crawlers that ignore this.
const PRIVATE = ["/data", "/account", "/api/", "/login", "/register", "/reset-password", "/auth/", "/geography", "/quiz/stats", "/subpoena"];

// AI training crawlers; the project's Vercel firewall denies them as well.
// Search and answer engines that link back (Googlebot, Bingbot,
// OAI-SearchBot, ChatGPT-User, PerplexityBot) stay allowed.
const TRAINING_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "FacebookBot",
  "Bytespider",
  "Amazonbot",
  "cohere-ai",
  "Diffbot",
  "omgili",
  "Timpibot",
];

// SEO and backlink crawlers walk every long-tail page and send no visitors
// (in Oct 2026 AhrefsBot was 83% of requests); the firewall denies them too.
const SEO_CRAWLERS = [
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "PetalBot",
  "DataForSeoBot",
  "BLEXBot",
  "serpstatbot",
  "Barkrowler",
  "SeznamBot",
  "AwarioBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: [...TRAINING_CRAWLERS, ...SEO_CRAWLERS], disallow: "/" },
      { userAgent: "*", allow: "/", disallow: [...PRIVATE, "/*?"] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
