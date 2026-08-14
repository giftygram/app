import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GiftyGram Flowers — Operations",
  description: "Order tracking for GiftyGram Flowers",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale — customers need to pinch-zoom the bouquet photo.
  themeColor: "#f27a85",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col font-sans">{children}</body>
    </html>
  );
}
