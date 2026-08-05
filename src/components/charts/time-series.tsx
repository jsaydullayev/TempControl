import type { Reading } from "@/lib/types";

interface Props {
  points: Reading[];
  field: "tempC" | "humidity";
  color: string;
  /**
   * Comfort band drawn behind the line, or null when the compared sensors do
   * not share one — a single band over series with different limits would
   * declare readings safe or unsafe by a rule that applies to none of them.
   */
  band: { min: number; max: number } | null;
  unit: string;
  maxLabel: string;
  minLabel: string;
  /** Points further apart than this are a gap, not a trend. */
  gapMs: number;
  /** Pre-formatted x-axis ticks, evenly spaced across the range. */
  ticks: { at: number; label: string }[];
  ariaLabel: string;
}

const W = 900;
const H = 260;
const PAD = { top: 16, right: 64, bottom: 26, left: 8 };

/**
 * Time series with a comfort band.
 *
 * Hand-rolled SVG and fully server-rendered: after the server has already
 * downsampled the range there is nothing left for a charting runtime to do,
 * and this way the chart costs no client JavaScript.
 *
 * Silence is drawn as a BREAK in the line. Bridging it with a straight segment
 * would claim the value held steady while the sensor was not reporting.
 */
export function TimeSeriesChart({
  points,
  field,
  color,
  band,
  unit,
  maxLabel,
  minLabel,
  gapMs,
  ticks,
  ariaLabel,
}: Props) {
  if (points.length < 2) {
    return null;
  }

  const values = points.map((p) => p[field]);
  const lo = Math.min(...values, ...(band ? [band.min] : []));
  const hi = Math.max(...values, ...(band ? [band.max] : []));
  const pad = (hi - lo) * 0.15 || 1;
  const yMin = lo - pad;
  const yMax = hi + pad;

  const t0 = points[0].ts;
  const t1 = points[points.length - 1].ts;
  const tSpan = t1 - t0 || 1;

  const x = (ts: number) => PAD.left + ((ts - t0) / tSpan) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  // Break the path wherever the sensor went quiet.
  const runs: string[] = [];
  let current: string[] = [];
  points.forEach((p, i) => {
    const prev = points[i - 1];
    if (prev && p.ts - prev.ts > gapMs) {
      if (current.length > 1) runs.push(current.join(" "));
      current = [];
    }
    current.push(`${current.length === 0 ? "M" : "L"}${x(p.ts).toFixed(1)},${y(p[field]).toFixed(1)}`);
  });
  if (current.length > 1) runs.push(current.join(" "));

  const bandTop = band ? y(band.max) : 0;
  const bandBottom = band ? y(band.min) : 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      style={{ display: "block" }}
    >
      {/* Comfort band — a quiet wash, not a saturated block. */}
      {band ? (
        <rect
          x={PAD.left}
          y={bandTop}
          width={W - PAD.left - PAD.right}
          height={Math.max(0, bandBottom - bandTop)}
          fill="color-mix(in srgb, var(--status-good) 12%, transparent)"
        />
      ) : null}
      {(band ? [bandTop, bandBottom] : []).map((yy, i) => (
        <line
          key={i}
          x1={PAD.left}
          x2={W - PAD.right}
          y1={yy}
          y2={yy}
          stroke="color-mix(in srgb, var(--status-good) 45%, transparent)"
          strokeWidth={1}
        />
      ))}

      {/* Threshold values live at the edge as text, so the band never needs decoding. */}
      {band ? (
        <>
          <text
            x={W - PAD.right + 8}
            y={bandTop + 4}
            fontSize={11}
            fill="var(--ink-muted)"
            className="tnum"
          >
            {band.max} {unit} {maxLabel}
          </text>
          <text
            x={W - PAD.right + 8}
            y={bandBottom + 4}
            fontSize={11}
            fill="var(--ink-muted)"
            className="tnum"
          >
            {band.min} {unit} {minLabel}
          </text>
        </>
      ) : null}

      {/* Hairline baseline; no dashed grid. */}
      <line
        x1={PAD.left}
        x2={W - PAD.right}
        y1={H - PAD.bottom}
        y2={H - PAD.bottom}
        stroke="var(--axis)"
        strokeWidth={1}
      />

      {ticks.map((tick) => (
        <text
          key={tick.at}
          x={x(tick.at)}
          y={H - PAD.bottom + 15}
          fontSize={11}
          fill="var(--ink-muted)"
          textAnchor="middle"
          className="tnum"
        >
          {tick.label}
        </text>
      ))}

      {runs.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
