"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  formatDateLabel,
  isSameDay,
  startOfMonth,
  toDateParam,
} from "@/lib/date";
import { cn } from "@/lib/cn";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function DateNav({
  selectedDate,
  today,
  basePath,
}: {
  selectedDate: Date;
  today: Date;
  basePath: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const prev = toDateParam(addDays(selectedDate, -1));
  const next = toDateParam(addDays(selectedDate, 1));
  const isToday = isSameDay(selectedDate, today);

  // Deliberately omits `status`: switching days resets to that day's smart
  // default (active for today/future, all for past) instead of carrying the
  // previous day's filter, which could otherwise hide a past day's orders
  // behind an "Active" filter that no longer matches anything.
  function hrefFor(dateParam: string) {
    return `${basePath}?date=${dateParam}`;
  }

  function goToDate(date: Date) {
    setOpen(false);
    router.push(hrefFor(toDateParam(date)));
  }

  function openPicker() {
    setViewMonth(startOfMonth(selectedDate));
    setOpen(true);
  }

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

  return (
    <div className="flex items-center gap-2">
      <Link
        href={hrefFor(prev)}
        aria-label="Previous day"
        className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border border-line text-muted hover:text-foreground hover:border-brand transition-colors"
      >
        ‹
      </Link>

      <div className="relative flex-1">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openPicker())}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-xl border bg-surface px-3 py-2.5 text-sm font-semibold text-foreground transition-colors",
            open ? "border-brand ring-2 ring-brand/20" : "border-line hover:border-brand"
          )}
        >
          <CalendarGlyph />
          {formatDateLabel(selectedDate, today)}
          <span className="font-normal text-muted">
            {selectedDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </button>

        {open && (
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Choose a date"
            className="absolute left-1/2 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-line bg-surface p-3 shadow-lg"
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
                {viewMonth.toLocaleDateString([], { month: "long", year: "numeric" })}
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
                <span
                  key={i}
                  className="flex h-7 items-center justify-center text-[11px] font-medium text-muted"
                >
                  {w}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-0.5">
              {buildMonthGrid(viewMonth).map(({ date, inMonth }) => {
                const isSelected = isSameDay(date, selectedDate);
                const isToday_ = isSameDay(date, today);
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => goToDate(date)}
                    className={cn(
                      "h-9 w-9 mx-auto flex items-center justify-center rounded-full text-sm transition-colors",
                      isSelected
                        ? "bg-brand text-brand-ink font-semibold"
                        : isToday_
                          ? "border border-brand text-brand font-semibold hover:bg-brand-soft"
                          : inMonth
                            ? "text-foreground hover:bg-background"
                            : "text-muted/40 hover:bg-background"
                    )}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {!isToday && (
              <button
                type="button"
                onClick={() => goToDate(today)}
                className="mt-2 w-full rounded-lg py-2 text-sm font-medium text-brand hover:bg-brand-soft transition-colors"
              >
                Jump to today
              </button>
            )}
          </div>
        )}
      </div>

      <Link
        href={hrefFor(next)}
        aria-label="Next day"
        className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border border-line text-muted hover:text-foreground hover:border-brand transition-colors"
      >
        ›
      </Link>
    </div>
  );
}

function CalendarGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted shrink-0"
      aria-hidden="true"
    >
      <rect x="3" y="4.5" width="18" height="16" rx="3" />
      <path d="M16 2.5v4M8 2.5v4M3 10h18" />
    </svg>
  );
}
