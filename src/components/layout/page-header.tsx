import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export interface HeaderStat {
  label: string;
  value: string;
  unit?: string;
  /** Status colour for the value — used when the number is the problem. */
  accent?: string;
  /** Small leading dot, for the "live / last updated" stat. */
  dot?: string;
}

/**
 * Page title with the headline numbers inline on the right.
 *
 * Four separate KPI cards would take a whole band of the screen to say what
 * three numbers say here — and the plan below is the thing worth the space.
 */
export function PageHeader({
  eyebrow,
  title,
  stats = [],
  backHref,
  backLabel,
}: {
  eyebrow: string;
  title: string;
  stats?: HeaderStat[];
  /** Where "up" is. A real link, not history.back() — see below. */
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pt-2">
      <div className="flex items-start gap-3">
        {backHref ? (
          /*
           * A link to the parent, not a history.back(). Reached from a bookmark
           * or a fresh tab there is no history to go back to, and "back" would
           * do nothing at all — the one moment a user most needs a way out.
           */
          <Link
            href={backHref}
            aria-label={backLabel}
            title={backLabel}
            className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
            style={{
              border: "1px solid var(--hairline)",
              background: "var(--surface-1)",
              color: "var(--ink-secondary)",
            }}
          >
            <ChevronLeft size={18} aria-hidden />
          </Link>
        ) : null}

        <div>
          <p
            className="text-[11px] font-medium tracking-[0.08em] uppercase"
            style={{ color: "var(--ink-muted)" }}
          >
            {eyebrow}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
        </div>
      </div>

      {stats.length > 0 ? (
        <dl className="flex flex-wrap items-end gap-x-7 gap-y-3">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt
                className="text-[11px] font-medium tracking-[0.08em] uppercase"
                style={{ color: "var(--ink-muted)" }}
              >
                {stat.label}
              </dt>
              <dd className="mt-0.5 flex items-baseline gap-1">
                {stat.dot ? (
                  <span
                    aria-hidden
                    className="mr-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: stat.dot }}
                  />
                ) : null}
                <span
                  className="text-2xl leading-none font-semibold tracking-tight"
                  style={{ color: stat.accent ?? "var(--ink-primary)" }}
                >
                  {stat.value}
                </span>
                {stat.unit ? (
                  <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
                    {stat.unit}
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
