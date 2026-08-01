import Link from "next/link";
import { LineChart, Table2 } from "lucide-react";

export interface LegendEntry {
  label: string;
  color: string;
  /** Swatch instead of a line — used for the comfort band. */
  block?: boolean;
}

/**
 * Chart container: title, legend, and the switch to the table twin.
 *
 * Every chart ships a table view. A tooltip may enhance a value but must never
 * be the only way to read it.
 */
export function ChartFrame({
  title,
  legend,
  toggleHref,
  showingTable,
  chartLabel,
  tableLabel,
  children,
}: {
  title: string;
  legend: LegendEntry[];
  toggleHref: string;
  showingTable: boolean;
  chartLabel: string;
  tableLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="flex flex-col gap-4 rounded-xl p-4"
      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-sm font-medium">{title}</h2>
          <ul className="flex flex-wrap items-center gap-3">
            {legend.map((entry) => (
              <li
                key={entry.label}
                className="inline-flex items-center gap-1.5 text-xs"
                style={{ color: "var(--ink-muted)" }}
              >
                <span
                  aria-hidden
                  className="inline-block"
                  style={
                    entry.block
                      ? {
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: entry.color,
                        }
                      : { width: 14, height: 2, borderRadius: 2, background: entry.color }
                  }
                />
                {entry.label}
              </li>
            ))}
          </ul>
        </div>

        <Link
          href={toggleHref}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs"
          style={{ border: "1px solid var(--hairline)", color: "var(--ink-secondary)" }}
        >
          {showingTable ? <LineChart size={14} aria-hidden /> : <Table2 size={14} aria-hidden />}
          {showingTable ? chartLabel : tableLabel}
        </Link>
      </div>

      {children}
    </section>
  );
}
