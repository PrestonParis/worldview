import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Saved map documents may contain one client-validated image/logo up to
  // 4 MB. Base64 expands it by roughly one third, so leave enough room for
  // the rest of the project JSON while keeping a firm request ceiling.
  experimental: {
    serverActions: {
      bodySizeLimit: "7mb",
    },
  },
};

export default nextConfig;
