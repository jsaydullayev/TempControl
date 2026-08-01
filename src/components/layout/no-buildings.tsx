import Link from "next/link";
import { Building2, Plus } from "lucide-react";

/**
 * Shown when the system has no buildings yet.
 *
 * Only an admin can ever see this — a building session cannot exist without a
 * building — so the empty state is also the first step of setup.
 */
export function NoBuildings({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl px-6 py-20 text-center"
      style={{ background: "var(--surface-1)", border: "1px dashed var(--axis)" }}
    >
      <Building2 size={24} style={{ color: "var(--ink-muted)" }} aria-hidden />
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm" style={{ color: "var(--ink-muted)" }}>
        {body}
      </p>
      <Link
        href="/admin/buildings"
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white"
        style={{ background: "var(--series-1)" }}
      >
        <Plus size={14} aria-hidden />
        {action}
      </Link>
    </div>
  );
}
