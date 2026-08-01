"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, ChevronRight } from "lucide-react";

import { markSeenAction } from "@/app/(app)/alerts/actions";

export interface AlertItem {
  /** Sensor id — the panel links to the sensor, not to the alert row. */
  id: string;
  name: string;
  room: string;
  label: string;
  color: string;
  when: string;
}

interface Props {
  items: AlertItem[];
  /** Badge count: alerts this building has not looked at yet. */
  unseen: number;
  label: string;
  allLabel: string;
  emptyLabel: string;
}

/**
 * Bell with a dropdown.
 *
 * Deliberately a panel and not a page: checking what is wrong should not throw
 * away the view you were looking at.
 */
export function AlertBell({ items, unseen, label, allLabel, emptyLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    // Opening the panel is what "seen" means — clear the badge.
    if (next && unseen > 0) startTransition(() => void markSeenAction());
  }

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);


  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unseen > 0 ? `${label} (${unseen})` : label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg"
        style={{
          border: "1px solid var(--hairline)",
          background: open ? "var(--surface-2)" : "transparent",
          color: "var(--ink-secondary)",
        }}
      >
        <Bell size={16} aria-hidden />
        {unseen > 0 ? (
          <span
            className="absolute -top-1.5 -right-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
            style={{ background: "var(--status-critical)" }}
          >
            {unseen > 99 ? "99+" : unseen}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={label}
          /* Never wider than the screen: a fixed 330px panel pushed the page
             sideways on a 320px phone, and the bell sits at the right edge. */
          className="absolute right-0 z-50 mt-2 w-[min(330px,calc(100vw-1.5rem))] overflow-hidden rounded-xl"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--hairline)",
            boxShadow: "0 12px 32px rgb(0 0 0 / 0.4)",
          }}
        >
          <div
            className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5"
            style={{ borderColor: "var(--hairline)" }}
          >
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
              {items.length}
            </span>
          </div>

          {items.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
              {emptyLabel}
            </p>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/sensors/${item.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 border-b px-3.5 py-2.5"
                    style={{ borderColor: "var(--hairline)" }}
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: item.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="block truncate text-xs" style={{ color: "var(--ink-muted)" }}>
                        {item.room} · {item.when}
                      </span>
                    </span>
                    <span
                      className="shrink-0 text-xs font-medium whitespace-nowrap"
                      style={{ color: item.color }}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/alerts"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between px-3.5 py-2.5 text-sm"
            style={{ color: "var(--ink-secondary)" }}
          >
            {allLabel}
            <ChevronRight size={14} aria-hidden />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
