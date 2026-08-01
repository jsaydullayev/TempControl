/**
 * Skeleton primitive.
 *
 * Each loading screen mirrors the real layout it replaces, so the page does not
 * jump when the content arrives — a generic spinner would move everything.
 * The pulse is disabled by the global `prefers-reduced-motion` rule.
 *
 * IMPORTANT — do NOT add a `loading.tsx` above a page that can call
 * `notFound()`. The loading file creates a Suspense boundary, Next.js streams
 * the shell immediately with status 200, and the later `notFound()` can then
 * only swap in the not-found UI: the response still says 200. That silently
 * breaks every out-of-scope check on the dashboard, /sensors and /sensors/[id],
 * which is why only /history and /alerts have one.
 */
export function Skeleton({
  className = "",
  height,
  width,
  radius = 8,
}: {
  className?: string;
  height?: number | string;
  width?: number | string;
  radius?: number;
}) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse ${className}`}
      style={{
        height,
        width,
        borderRadius: radius,
        background: "var(--surface-2)",
      }}
    />
  );
}

/** Page title block: eyebrow, heading, and the inline stat strip. */
export function HeaderSkeleton() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 pt-2">
      <div className="flex flex-col gap-2">
        <Skeleton height={10} width={90} radius={4} />
        <Skeleton height={30} width={220} />
      </div>
      <div className="flex gap-7">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton height={10} width={70} radius={4} />
            <Skeleton height={22} width={60} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PanelSkeleton({ height = 440 }: { height?: number }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
    >
      <Skeleton height={height} />
    </div>
  );
}
