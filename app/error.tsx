"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-brand-soft flex items-center justify-center text-2xl">
          ⚠️
        </div>
        <h1 className="text-lg font-semibold text-foreground mb-1">Something went wrong</h1>
        <p className="text-sm text-muted mb-6 text-balance">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={() => reset()}
          className="rounded-xl bg-brand text-brand-ink font-semibold px-5 py-2.5 text-sm hover:opacity-90 transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
