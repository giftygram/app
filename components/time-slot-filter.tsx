"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// The checkout's delivery-time picker only ever produces these five fixed
// three-hour windows — hardcoded rather than derived from the data so a
// stray/placeholder value (e.g. an abandoned "Please select a time...")
// never shows up as a real filter option.
const TIME_SLOTS = [
  "9:00 AM - 12:00 PM",
  "12:00 PM - 3:00 PM",
  "3:00 PM - 6:00 PM",
  "6:00 PM - 9:00 PM",
  "9:00 PM - 12:00 AM",
];

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
