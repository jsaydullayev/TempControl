import Link from "next/link";

export interface SegmentItem {
  key: string;
  label: string;
  href: string;
}

/**
 * Plain links, not a client component: these are navigations, and keeping the
 * choice in the URL makes the view shareable and bookmarkable.
 */
export function SegmentedLinks({
  items,
  current,
  ariaLabel,
}: {
  items: SegmentItem[];
  current: string;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-lg p-0.5"
      style={{ background: "var(--surface-2)" }}
    >
      {items.map((item) => {
        const active = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "true" : undefined}
            className="rounded-md px-2.5 py-1 text-sm whitespace-nowrap transition-colors"
            style={{
              background: active ? "var(--surface-1)" : "transparent",
              color: active ? "var(--ink-primary)" : "var(--ink-secondary)",
              fontWeight: active ? 500 : 400,
              boxShadow: active ? "0 1px 2px rgb(0 0 0 / 0.06)" : undefined,
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
