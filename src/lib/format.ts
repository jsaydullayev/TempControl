/**
 * Formatting helpers.
 *
 * Relative time is computed here rather than via Intl.RelativeTimeFormat
 * because Node's ICU support for `uz` is patchy; returning a message key plus a
 * count lets next-intl render it correctly in all three locales.
 */

export type RelativeKey = "justNow" | "minutesAgo" | "hoursAgo" | "daysAgo";

export function relativeTimeParts(
  ts: number | null,
  now: number,
): { key: RelativeKey; count: number } | null {
  if (ts === null) return null;

  const diffMs = Math.max(0, now - ts);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return { key: "justNow", count: 0 };
  if (minutes < 60) return { key: "minutesAgo", count: minutes };

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { key: "hoursAgo", count: hours };

  return { key: "daysAgo", count: Math.floor(hours / 24) };
}

/** One decimal place, and never "-0.0". */
export function formatTemp(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const safe = Object.is(rounded, -0) ? 0 : rounded;
  return safe.toFixed(1);
}

export function formatHumidity(value: number): string {
  return String(Math.round(value));
}

export function formatClock(ts: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === "uz" ? "en-GB" : locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts);
}
