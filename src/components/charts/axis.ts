/**
 * Round values for a y-axis.
 *
 * A chart whose only labelled values are the two limit lines tells you a
 * reading is "somewhere above 8" — which is the question the chart was opened
 * to answer. Ticks at regular, readable numbers let the line be read directly.
 *
 * Steps are restricted to 1, 2 and 5 times a power of ten: those are the
 * intervals people add up in their head. 2.5 or 3 are arithmetically fine and
 * cost the reader a moment on every glance.
 */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];

  const raw = (max - min) / Math.max(1, target);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalised = raw / magnitude;

  /*
   * Thresholds at the geometric midpoints (√2, √10, √50) rather than at 1, 2
   * and 5.
   *
   * Rounding up at the plain integers overshoots: an ideal step of 5.3 is
   * nearer 5 than 10, but a `> 5` test promotes it to 10 and the axis loses
   * half its labels. Comparing a fridge with a room spans about 26 degrees and
   * came out with exactly two gridlines — the chart that prompted this.
   */
  const step =
    (normalised < 1.41 ? 1 : normalised < 3.16 ? 2 : normalised < 7.07 ? 5 : 10) * magnitude;

  const ticks: number[] = [];
  // Start at the first step boundary INSIDE the range, so no label is drawn
  // outside the plot and then clipped.
  for (let v = Math.ceil(min / step) * step; v <= max + step / 1000; v += step) {
    // Re-round: repeated addition of 0.1 drifts into 8.200000000000001.
    ticks.push(Math.round(v / step) * step);
  }
  return ticks;
}

/** Trailing zeros are noise on an axis: 8 rather than 8.0, but 8.5 stays. */
export function formatTick(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
