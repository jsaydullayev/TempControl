interface Props {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  /** Optional accent for the value — a status token, never a series colour. */
  accent?: string;
  icon?: React.ReactNode;
}

/**
 * A single number is a stat tile, not a chart. Values keep proportional
 * figures; only the hint line can be tabular.
 */
export function StatTile({ label, value, unit, hint, accent, icon }: Props) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl p-4"
      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
    >
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--ink-muted)" }}>
        {icon}
        <span>{label}</span>
      </div>
      <p className="flex items-baseline gap-1">
        <span
          className="text-3xl leading-none font-semibold tracking-tight"
          style={{ color: accent ?? "var(--ink-primary)" }}
        >
          {value}
        </span>
        {unit ? (
          <span className="text-base" style={{ color: "var(--ink-secondary)" }}>
            {unit}
          </span>
        ) : null}
      </p>
      {hint ? (
        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
