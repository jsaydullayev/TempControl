"use client";

import { Printer } from "lucide-react";

/**
 * Opens the browser's print dialogue, where "Save as PDF" is a destination.
 *
 * Deliberately not a server-side PDF generator: the sensor and room names here
 * are Cyrillic and Latin at once, and the pure-JS PDF writers ship only
 * WinAnsi fonts — every "холодильник" would come out as boxes unless a font
 * were embedded by hand. Headless Chrome renders it correctly and costs a
 * 300 MB image. The browser already has that renderer, and its output is a
 * real PDF file.
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white print:hidden"
      style={{ background: "var(--series-1)" }}
    >
      <Printer size={15} aria-hidden />
      {label}
    </button>
  );
}
