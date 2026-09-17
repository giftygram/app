"use client";

import Image from "next/image";
import { absoluteImageLoader } from "@/lib/absolute-image-loader";

export function TrackLogo() {
  return (
    <Image
      loader={absoluteImageLoader}
      src="/flower-icon.png"
      alt=""
      width={512}
      height={512}
      className="mx-auto mb-3 h-12 w-12 rounded-full bg-brand-soft object-cover"
    />
  );
}
