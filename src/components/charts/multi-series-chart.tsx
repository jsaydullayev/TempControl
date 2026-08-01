import type { Reading } from "@/lib/types";

export interface Series {
  id: string;
  label: string;
  color: string;
  points: Reading[];
}

interface Props {
  series: Series[];
  field: "tempC" | "humidity";
  band: { min: number; max: number };
  unit: string;
  maxLabel: string;
  minLabel: string;
  gapMs: number;
  ticks: { at: number; label: string }[];
  ariaLabel: string;
}

const W = 900;
const H = 280;
const PAD = { top: 16, right: 64, bottom: 26, left: 8 };

/**
 * Several sensors on ONE axis.
 *
 * Every series shares the same scale, which is the only honest way to compare
 * them — a second y-axis would invent a relationship that is not in the data.
 * Silence is drawn as a break, never bridged.
 */
export function MultiSeriesChart({
  series,
  field,
  band,
  unit,
  maxLabel,
  minLabel,
  gapMs,
  ticks,
  ariaLabel,
}: Props) {
  const withData = series.filter((s) => s.points.length >= 2);
  if (withData.length === 0) return null;

  const allValues = withData.flatMap((s) => s.points.map((p) => p[field]));
  const lo = Math.min(...allValues, band.min);
  const hi = Math.max(...allValues, band.max);
  const pad = (hi - lo) * 0.15 || 1;
  const yMin = lo - pad;
  const yMax = hi + pad;

  const allTimes = withData.flatMap((s) => [s.points[0].ts, s.points[s.points.length - 1].ts]);
  const t0 = Math.min(...allTimes);
  const t1 = Math.max(...allTimes);
  const tSpan = t1 - t0 || 1;

  const x = (ts: number) => PAD.left + ((ts - t0) / tSpan) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  const bandTop = y(band.max);
  const bandBottom = y(band.min);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      style={{ display: "block" }}
    >
      <rect
        x={PAD.left}
        y={bandTop}
        width={W - PAD.left - PAD.right}
        height={Math.max(0, bandBottom - bandTop)}
        fill="color-mix(in srgb, var(--status-good) 10%, transparent)"
      />
      {[bandTop, bandBottom].map((yy, i) => (
        <line
          key={i}
          x1={PAD.left}
          x2={W - PAD.right}
          y1={yy}
          y2={yy}
          stroke="color-mix(in srgb, var(--status-good) 40%, transparent)"
          strokeWidth={1}
        />
      ))}

      <text x={W - PAD.right + 8} y={bandTop + 4} fontSize={11} fill="var(--ink-muted)" className="tnum">
        {band.max} {unit} {maxLabel}
      </text>
      <text x={W - PAD.right + 8} y={bandBottom + 4} fontSize={11} fill="var(--ink-muted)" className="tnum">
        {band.min} {unit} {minLabel}
      </text>

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

      {withData.map((s) => (
        <g key={s.id}>
          {runsOf(s.points, field, gapMs, x, y).map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Path segments, broken wherever the sensor stopped reporting. */
function runsOf(
  points: Reading[],
  field: "tempC" | "humidity",
  gapMs: number,
  x: (ts: number) => number,
  y: (v: number) => number,
): string[] {
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

  return runs;
}
