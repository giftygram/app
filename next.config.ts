import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// /track is embedded on-domain for customers via an iframe on
// giftygram.ae/pages/track (Shopify's App Proxy is the "real" fix — it would
// serve this at the same URL server-side, with no iframe — but it's
// currently broken on Shopify's end for this store; see the giftygram.ae
// Page's Liquid template for the iframe itself). assetPrefix,
// absoluteImageLoader, and the allowedOrigins below make no difference to
// the iframe (its browsing context is already app.giftygram.ae), but they're
// exactly what App Proxy needs once Shopify's bug is fixed, so they stay.
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
  async headers() {
    return [
      {
        // Only giftygram.ae is allowed to iframe these pages — keeps the
        // ops subdomain from being embeddable by anyone else.
        source: "/track",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://giftygram.ae https://www.giftygram.ae",
          },
        ],
      },
      {
        source: "/track/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://giftygram.ae https://www.giftygram.ae",
          },
        ],
      },
    ];
  },
});

export default configFn;
