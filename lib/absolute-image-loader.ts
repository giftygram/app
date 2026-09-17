// next/image's default loader emits paths relative to whichever origin
// served the HTML. Broken when a page is fetched through Shopify's App
// Proxy (giftygram.ae/apps/track) — the browser would request
// giftygram.ae/_next/image, a path Shopify never proxies. This loader pins
// every image request straight at the app's own domain instead, so it works
// identically whether the page is loaded directly or through the proxy.
export function absoluteImageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  const params = new URLSearchParams({ url: src, w: String(width), q: String(quality ?? 75) });
  return `https://app.giftygram.ae/_next/image?${params.toString()}`;
}
