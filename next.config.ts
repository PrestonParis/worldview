import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Saved map documents may contain one client-validated image/logo up to
  // 4 MB. Base64 expands it by roughly one third, so leave enough room for
  // the rest of the project JSON while keeping a firm request ceiling.
  experimental: {
    serverActions: {
      bodySizeLimit: "7mb",
    },
    // Prerendering opens a Postgres pool per build worker, and the Supabase
    // session pooler caps clients (shared with live traffic) at 15.
    cpus: 2,
  },
  // /people is one cached page; its old ?view= variants now live on their
  // own routes (the query string carries over).
  async redirects() {
    return [
      { source: "/people", has: [{ type: "query", key: "view", value: "directory" }], destination: "/people/directory", permanent: true },
      { source: "/people", has: [{ type: "query", key: "view", value: "network" }], destination: "/people/network", permanent: true },
      { source: "/people", has: [{ type: "query", key: "root" }], destination: "/people/network", permanent: true },
    ];
  },
};

export default nextConfig;
