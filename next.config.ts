import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// /track is also served on-domain for customers via Shopify's App Proxy at
// giftygram.ae/apps/track (transparently proxied to this same route tree —
// see lib/absolute-image-loader.ts and components/track-search-form.tsx for
// the other half of making that work). assetPrefix pins _next/static chunk
// URLs to this app's own domain regardless of which origin served the HTML,
// and giftygram.ae needs to be an allowed Server Action origin since the
// approve/reject buttons on the order page POST back through the proxy.
const configFn = (phase: string): NextConfig => ({
  assetPrefix: phase === PHASE_DEVELOPMENT_SERVER ? undefined : "https://app.giftygram.ae",
  experimental: {
    serverActions: {
      // Bouquet/delivery photos come straight from a phone camera, which
      // regularly exceeds Next's 1MB default Server Action body limit.
      bodySizeLimit: "10mb",
      allowedOrigins: ["giftygram.ae", "www.giftygram.ae"],
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
});

export default configFn;
