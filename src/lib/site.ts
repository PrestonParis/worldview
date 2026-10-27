// Canonical origin for sitemap, robots, and absolute metadata URLs. Vercel sets
// VERCEL_PROJECT_PRODUCTION_URL on every deployment.
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://www.worldviewpolitics.com";

export const SLOGAN = "The Replacement is Real";
