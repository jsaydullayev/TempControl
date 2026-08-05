import { niceTicks, formatTick } from "@/components/charts/axis";
import type { ReportRow } from "@/server/dal/report";

/**
 * One sensor's period as a min–max range chart, sized to sit twelve-to-a-page.
 *
 * Small multiples rather than twelve lines on one plot: past about eight series
 * no palette can keep them apart, and the reader's question here is per-sensor
 * anyway ("did THIS fridge hold?"), not a comparison between them. Each panel
 * carries its own limits, which is the only way a fridge and a store room can
 * share a page honestly.
 *
 * The band is drawn from the same buckets as the table on the previous sheet,
 * so the two pages can never disagree.
 */

const W = 260;
const H = 96;
const PAD = { top: 8, right: 6, bottom: 12, left: 26 };

export function MiniChart({ row, label }: { row: ReportRow; label: string }) {
  const filled = row.cells.filter((c) => c.min !== null);
  if (filled.length === 0) {
    return (
      <figure className="break-inside-avoid">
        <figcaption className="truncate text-[8pt] font-medium">{row.name}</figcaption>
        <p className="py-6 text-center text-[7pt]" style={{ color: "var(--ink-muted)" }}>
          {label}
        </p>
      </figure>
    );
  }

  // The limits are part of the scale, not just an overlay: a period spent
  // entirely inside them should still show where the edges are.
  const values = filled.flatMap((c) => [c.min as number, c.max as number]);
  const lo = Math.min(...values, row.limits.min);
  const hi = Math.max(...values, row.limits.max);
  const pad = (hi - lo) * 0.12 || 1;
  const yMin = lo - pad;
  const yMax = hi + pad;

  const x = (i: number) =>
    PAD.left + (row.cells.length < 2 ? 0 : (i / (row.cells.length - 1)) * (W - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  // Upper edge left to right, lower edge back again — one closed shape.
  const top = row.cells
    .map((c, i) => (c.max === null ? null : `${x(i)},${y(c.max)}`))
    .filter(Boolean) as string[];
  const bottom = row.cells
    .map((c, i) => (c.min === null ? null : `${x(i)},${y(c.min)}`))
    .filter(Boolean)
    .reverse() as string[];

  const ticks = niceTicks(yMin, yMax, 3);
  const breached = row.breaches > 0;

  return (
    <figure className="break-inside-avoid">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[8pt] font-medium">{row.name}</span>
        <span
          className="tnum shrink-0 text-[7pt]"
          style={{ color: breached ? "var(--status-critical)" : "var(--ink-muted)" }}
        >
          {row.limits.min}–{row.limits.max} °C
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={row.name}>
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--hairline)"
              strokeWidth={0.5}
            />
            <text
              x={PAD.left - 3}
              y={y(v) + 2.5}
              fontSize={6}
              textAnchor="end"
              fill="var(--ink-muted)"
              className="tnum"
            >
              {formatTick(v)}
            </text>
          </g>
        ))}

        {/* The safe band, behind everything. */}
        <rect
          x={PAD.left}
          y={y(row.limits.max)}
          width={W - PAD.left - PAD.right}
          height={Math.max(0, y(row.limits.min) - y(row.limits.max))}
          fill="color-mix(in srgb, var(--status-good) 14%, transparent)"
        />
        {[row.limits.max, row.limits.min].map((v) => (
          <line
            key={v}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(v)}
            y2={y(v)}
            stroke="color-mix(in srgb, var(--status-good) 50%, transparent)"
            strokeWidth={0.6}
          />
        ))}

        {/* The measured range. Colour is doubled by the outline so the shape
            still reads once the page is photocopied. */}
        <polygon
          points={[...top, ...bottom].join(" ")}
          fill={
            breached
              ? "color-mix(in srgb, var(--status-critical) 28%, transparent)"
              : "color-mix(in srgb, var(--series-1) 30%, transparent)"
          }
          stroke={breached ? "var(--status-critical)" : "var(--series-1)"}
          strokeWidth={0.6}
          strokeLinejoin="round"
        />
      </svg>
    </figure>
  );
}
