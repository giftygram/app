"use client";

import { useEffect, useRef, useState } from "react";
import {
  addMonths,
  buildMonthGrid,
  DUBAI_TZ,
  formatDubaiDateTime,
  fromDateParam,
  fromDubaiComponents,
  isSameDay,
  startOfDay,
  startOfMonth,
  toDateParam,
} from "@/lib/date";
import { cn } from "@/lib/cn";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Parses a `YYYY-MM-DDTHH:mm` value — the same format toDatetimeLocalValue produces. */
function parseValue(value: string | undefined) {
  if (!value) return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return { dateParam: m[1], hour24: Number(m[2]), minute: Number(m[3]) };
}

/**
 * Branded replacement for <input type="datetime-local"> — that renders the
 * browser/OS's own picker UI, which no amount of CSS can restyle. This
 * reuses the same calendar-grid look as the Orders page date nav, plus a
 * time selector, and writes into a hidden input so the surrounding <form>
 * and server action need no changes (same "YYYY-MM-DDTHH:mm" value shape).
 */
export function DateTimeField({
  label,
  name,
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
}) {
  const parsed = parseValue(defaultValue);
  const initialDay = parsed ? fromDateParam(parsed.dateParam) : null;

  const [open, setOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(initialDay);
  const [hour24, setHour24] = useState(parsed ? parsed.hour24 : 12);
  const [minute, setMinute] = useState(parsed ? parsed.minute : 0);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(initialDay ?? new Date()));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const today = startOfDay(new Date());

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const hiddenValue = selectedDay ? `${toDateParam(selectedDay)}T${pad(hour24)}:${pad(minute)}` : "";

  let displayLabel = "Choose date & time";
  if (selectedDay) {
    const [y, m, d] = toDateParam(selectedDay).split("-").map(Number);
    displayLabel = formatDubaiDateTime(fromDubaiComponents(y, m, d, hour24, minute));
  }

  const hour12 = ((hour24 + 11) % 12) + 1;
  const isPM = hour24 >= 12;

  function setHour12(h12: number, pm: boolean) {
    setHour24((h12 % 12) + (pm ? 12 : 0));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-rose"> *</span>}
      </span>

      <input type="hidden" name={name} value={hiddenValue} />

      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setViewMonth(startOfMonth(selectedDay ?? today));
          setOpen((v) => !v);
        }}
        className={cn(
          "text-left rounded-xl border bg-surface px-3.5 py-2.5 text-sm transition-colors",
          open ? "border-brand ring-2 ring-brand/20" : "border-line",
          !selectedDay && "text-muted"
        )}
      >
        {displayLabel}
      </button>

      {open && (
        <div className="relative">
          <div
            ref={popoverRef}
            className="absolute left-0 top-2 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-3 shadow-lg"
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setViewMonth((m) => addMonths(m, -1))}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors"
              >
                ‹
              </button>
              <p className="text-sm font-semibold text-foreground">
                {viewMonth.toLocaleDateString([], { month: "long", year: "numeric", timeZone: DUBAI_TZ })}
              </p>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7">
              {WEEKDAYS.map((w, i) => (
                <span key={i} className="flex h-7 items-center justify-center text-[11px] font-medium text-muted">
                  {w}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-0.5">
              {buildMonthGrid(viewMonth).map(({ date, inMonth }) => {
                const isSelected = selectedDay ? isSameDay(date, selectedDay) : false;
                const isToday = isSameDay(date, today);
                const dayNum = Number(toDateParam(date).split("-")[2]);
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => setSelectedDay(date)}
                    className={cn(
                      "h-9 w-9 mx-auto flex items-center justify-center rounded-full text-sm transition-colors",
                      isSelected
                        ? "bg-brand text-brand-ink font-semibold"
                        : isToday
                          ? "border border-brand text-brand font-semibold hover:bg-brand-soft"
                          : inMonth
                            ? "text-foreground hover:bg-background"
                            : "text-muted/40 hover:bg-background"
                    )}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-line flex items-center gap-2">
              <select
                value={hour12}
                onChange={(e) => setHour12(Number(e.target.value), isPM)}
                className="flex-1 rounded-lg border border-line bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {HOURS_12.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-muted">:</span>
              <select
                value={minute}
                onChange={(e) => setMinute(Number(e.target.value))}
                className="flex-1 rounded-lg border border-line bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {pad(m)}
                  </option>
                ))}
              </select>
              <div className="flex rounded-lg border border-line overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setHour12(hour12, false)}
                  className={cn(
                    "px-2.5 py-2 text-xs font-semibold transition-colors",
                    !isPM ? "bg-brand text-brand-ink" : "text-muted hover:text-foreground"
                  )}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => setHour12(hour12, true)}
                  className={cn(
                    "px-2.5 py-2 text-xs font-semibold transition-colors",
                    isPM ? "bg-brand text-brand-ink" : "text-muted hover:text-foreground"
                  )}
                >
                  PM
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {!required && (
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
                    className="text-sm font-medium text-muted hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDay(today);
                    setViewMonth(startOfMonth(today));
                  }}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  Today
                </button>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-brand text-brand-ink px-4 py-1.5 text-sm font-semibold hover:opacity-90 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
