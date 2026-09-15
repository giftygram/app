"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DELIVERY_TIME_WINDOWS } from "@/lib/date";

// The checkout's delivery-time picker only ever produces these five fixed
// three-hour windows — shared with lib/date.ts's deliveryTimeSlotFor so a
// stray/placeholder value (e.g. an abandoned "Please select a time...")
// never shows up as a real filter option, and the two can't drift apart.
const TIME_SLOTS = DELIVERY_TIME_WINDOWS.map((w) => w.label);

export function TimeSlotFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <select
      value={value}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) {
          params.set("slot", e.target.value);
        } else {
          params.delete("slot");
        }
        router.push(`${pathname}?${params.toString()}`);
      }}
      className="rounded-xl border border-line bg-surface px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
    >
      <option value="">All time slots</option>
      {TIME_SLOTS.map((slot) => (
        <option key={slot} value={slot}>
          {slot}
        </option>
      ))}
    </select>
  );
}
