import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Bouquet/delivery photos come straight from a phone camera, which
      // regularly exceeds Next's 1MB default Server Action body limit.
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Reference images fetched from Shopify's product catalog — see
        // fetchProductImageUrl in lib/shopify.ts.
        protocol: "https",
        hostname: "cdn.shopify.com",
      },
    ],
  },
};

export default nextConfig;
