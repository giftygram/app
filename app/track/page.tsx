import Image from "next/image";
import { TrackSearchForm } from "@/components/track-search-form";

// The direct link (/track/#2798) is what most customers land on from their
// email or WhatsApp — this bare page is the fallback for the rare visitor
// who has no link at all, just their order number.
export default function TrackLandingPage() {
  return (
    <main className="flex-1 flex justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="/flower-icon.png"
            alt=""
            width={512}
            height={512}
            className="mx-auto mb-3 h-12 w-12 rounded-full bg-brand-soft object-cover"
          />
          <h1 className="text-lg font-semibold text-foreground">GiftyGram Flowers</h1>
          <p className="text-sm text-muted mt-1">Enter your order number to track your delivery</p>
        </div>

        <TrackSearchForm />
      </div>
    </main>
  );
}
