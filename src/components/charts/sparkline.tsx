import type { Reading } from "@/lib/types";

interface Props {
  points: Reading[];
  /** Which measurement to draw. */
  field: "tempC" | "humidity";
  color: string;
  width?: number;
  height?: number;
  /** Points further apart than this are treated as a gap, not a trend. */
  gapMs?: number;
  label: string;
}

/**
 * Hand-rolled SVG: a sparkline is a 2px polyline with no axes, so a charting
 * library would cost far more than it gives.
 *
 * A sensor that stops reporting produces a BREAK in the line — never a straight
 * segment bridging the silence, which would read as "the value held steady".
 */
export function Sparkline({
  points,
  field,
  color,
  width = 220,
  height = 40,
  gapMs = 15 * 60 * 1000,
  label,
}: Props) {
  if (points.length < 2) {
    return <div style={{ width, height }} aria-hidden />;
  }

  const values = points.map((p) => p[field]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const t0 = points[0].ts;
  const tSpan = points[points.length - 1].ts - t0 || 1;

  const pad = 3;
  const x = (ts: number) => ((ts - t0) / tSpan) * (width - pad * 2) + pad;
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);

  // Split into runs of consecutive points, breaking wherever the sensor went quiet.
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

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="max-w-full overflow-visible"
    >
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
