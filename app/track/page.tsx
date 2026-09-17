import { TrackLogo } from "@/components/track-logo";
import { TrackSearchForm } from "@/components/track-search-form";

// The direct link (/track/k3f9m2xq8p) is what most customers land on from
// their email — this bare page is the fallback for the rare visitor who
// pastes in the tracking code from the email body instead of clicking the
// button. Also reachable on-domain via Shopify's App Proxy at
// giftygram.ae/apps/track (see components/track-search-form.tsx for the
// client-side navigation half of making that transparent).
export default async function TrackLandingPage() {
  return (
    <main className="flex-1 flex justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <TrackLogo />
          <h1 className="text-lg font-semibold text-foreground">GiftyGram Flowers</h1>
          <p className="text-sm text-muted mt-1">Enter your tracking code to see your delivery status</p>
        </div>

        <TrackSearchForm />
      </div>
    </main>
  );
}
