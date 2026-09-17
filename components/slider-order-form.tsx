"use client";

import { useState, useTransition } from "react";
import {
  orderSliderDeliveryAction,
  quoteSliderDeliveryAction,
  type SliderQuoteResult,
} from "@/app/actions/slider";

/**
 * "Order Slider" — price it, pick a vehicle, confirm, rider on the way.
 *
 * Three deliberate steps rather than one button: this spends real money from
 * the Slider wallet and sends a rider to a pin parsed out of a link someone
 * pasted, so the price and the destination both get shown before anything is
 * committed.
 */
type Step = "idle" | "choosing" | "sent";

export function SliderOrderForm({ orderId }: { orderId: string }) {
  const [step, setStep] = useState<Step>("idle");
  const [quote, setQuote] = useState<Extract<SliderQuoteResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function getQuote() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await quoteSliderDeliveryAction(orderId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setQuote(result);
      setStep("choosing");
    });
  }

  function dispatch(vehicleType: "bike" | "car", fare: number) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const outcome = await orderSliderDeliveryAction(orderId, vehicleType, fare);
      if (outcome.ok) {
        setStep("sent");
        return;
      }
      if (outcome.repriced) {
        // Re-quote so the buttons show the new price rather than asking them
        // to trust a number that just moved.
        setNotice(
          `Slider repriced this trip from AED ${outcome.oldFare.toFixed(2)} to AED ${outcome.newFare.toFixed(
            2
          )} — nothing was sent. Check the new price and confirm again.`
        );
        const refreshed = await quoteSliderDeliveryAction(orderId);
        if (refreshed.ok) setQuote(refreshed);
        return;
      }
      setError(outcome.error);
    });
  }

  if (step === "sent") {
    return (
      <p className="text-sm text-emerald-700">
        Rider requested. Slider&apos;s number and live status will appear here in a moment.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
          <p className="text-sm text-orange-900">{error}</p>
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">{notice}</p>
        </div>
      )}

      {step === "idle" && (
        <button
          type="button"
          onClick={getQuote}
          disabled={pending}
          className="w-full rounded-xl bg-brand text-brand-ink font-semibold py-3 text-sm hover:opacity-90 transition disabled:opacity-60"
        >
          {pending ? "Checking price…" : "Order Slider rider"}
        </button>
      )}

      {step === "choosing" && quote && (
        <>
          <div className="rounded-xl border border-line bg-background p-3 flex flex-col gap-1.5">
            <p className="text-sm text-foreground">{quote.address}</p>
            <p className="text-xs text-muted">
              {quote.distanceKm} km · about {quote.durationMinutes} min · rider calls{" "}
              {quote.recipientPhone}
            </p>
            <a
              href={quote.pinPreview}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand hover:underline"
            >
              Check the pin before sending →
            </a>
            {quote.pinIsApproximate && (
              <p className="text-xs text-amber-700">
                This pin came from the map view, not a dropped pin — worth checking it lands on
                the right building.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {quote.vehicles.map((vehicle) => {
              const available = vehicle.is_available && vehicle.delivery_fee !== null;
              return (
                <button
                  key={vehicle.vehicle_type}
                  type="button"
                  disabled={!available || pending}
                  onClick={() => dispatch(vehicle.vehicle_type, vehicle.delivery_fee ?? 0)}
                  className="w-full rounded-xl border border-line px-3.5 py-3 text-left hover:border-brand transition-colors disabled:opacity-50 disabled:hover:border-line"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold capitalize text-foreground">
                      {vehicle.vehicle_type}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {available ? `AED ${vehicle.delivery_fee?.toFixed(2)}` : "Unavailable"}
                    </span>
                  </span>
                  <span className="block text-xs text-muted mt-0.5">
                    {available
                      ? "Confirm to send — paid from the Slider wallet"
                      : vehicle.unavailable_reason}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setStep("idle");
              setQuote(null);
            }}
            disabled={pending}
            className="text-xs text-muted hover:text-foreground self-start"
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
