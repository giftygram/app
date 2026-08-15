"use client";

// Catches errors thrown by the root layout itself — anywhere else in the
// tree, app/error.tsx handles it instead. This replaces <html>/<body>
// entirely, so it deliberately avoids depending on globals.css tokens.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center px-4 py-10 font-sans bg-white text-black">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-lg font-semibold mb-1">Something went wrong</h1>
          <p className="text-sm text-gray-500 mb-6">
            {error.message || "An unexpected error occurred. Please reload the page."}
          </p>
          <button
            onClick={() => reset()}
            className="rounded-xl bg-black text-white font-semibold px-5 py-2.5 text-sm hover:opacity-90 transition"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
