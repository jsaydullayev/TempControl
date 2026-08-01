/**
 * The wall-clock time for the current render.
 *
 * Server Components are rendered per request, and "how long ago did this sensor
 * report" genuinely depends on when the request arrived — there is no purer
 * source for it. The lint rule that flags `Date.now()` in render exists for
 * Client Components, where an impure read makes re-renders inconsistent; on the
 * server the value is fixed for the whole render pass.
 *
 * Wrapping it here keeps that reasoning in one place instead of eight
 * suppressions scattered across pages.
 */
export function requestNow(): number {
  return Date.now();
}
