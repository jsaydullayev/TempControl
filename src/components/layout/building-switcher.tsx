"use client";

import { useTransition } from "react";
import { Building2 } from "lucide-react";

import { setBuildingAction } from "@/app/(app)/actions";
import type { Building } from "@/lib/types";

interface Props {
  buildings: Building[];
  currentId: string;
  label: string;
}

/**
 * Only an admin session ever sees more than one building, so a building
 * session gets a plain label instead of a one-option dropdown.
 */
export function BuildingSwitcher({ buildings, currentId, label }: Props) {
  const [pending, startTransition] = useTransition();

  if (buildings.length < 2) {
    return (
      <span
        className="flex min-w-0 items-center gap-2 truncate text-sm font-medium"
        style={{ color: "var(--ink-primary)" }}
      >
        <Building2 size={16} className="shrink-0" style={{ color: "var(--ink-muted)" }} aria-hidden />
        <span className="truncate">{buildings[0]?.name ?? "—"}</span>
      </span>
    );
  }

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const formData = new FormData();
    formData.set("buildingId", event.target.value);
    startTransition(() => {
      void setBuildingAction(formData);
    });
  }

  return (
    <label
      className="flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm"
      style={{
        border: "1px solid var(--hairline)",
        background: "var(--surface-1)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <Building2 size={16} className="shrink-0" style={{ color: "var(--ink-muted)" }} aria-hidden />
      <span className="sr-only">{label}</span>
      <select
        value={currentId}
        onChange={onChange}
        className="min-w-0 truncate font-medium outline-none"
        style={{ background: "var(--surface-1)", color: "var(--ink-primary)" }}
      >
        {buildings.map((b) => (
          <option key={b.id} value={b.id} style={{ background: "var(--surface-1)", color: "var(--ink-primary)" }}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
