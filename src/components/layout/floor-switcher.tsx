"use client";

import { useTransition } from "react";

import { setFloorAction } from "@/app/(app)/actions";
import type { Floor } from "@/lib/types";

interface Props {
  floors: Floor[];
  /** null = all floors */
  currentId: string | null;
  allLabel: string;
}

/**
 * A segmented control rather than a dropdown: with a handful of floors, showing
 * them all is one click instead of two, and "all floors" stays visible as the
 * default rather than hiding inside a menu.
 */
export function FloorSwitcher({ floors, currentId, allLabel }: Props) {
  const [pending, startTransition] = useTransition();

  if (floors.length === 0) return null;

  function select(floorId: string) {
    const formData = new FormData();
    formData.set("floorId", floorId);
    startTransition(() => {
      void setFloorAction(formData);
    });
  }

  const options = [{ id: "", name: allLabel }, ...floors.map((f) => ({ id: f.id, name: f.name }))];

  return (
    <div
      role="group"
      className="inline-flex items-center gap-0.5 rounded-lg p-0.5"
      style={{ background: "var(--surface-2)", opacity: pending ? 0.6 : 1 }}
    >
      {options.map((opt) => {
        const active = (currentId ?? "") === opt.id;
        return (
          <button
            key={opt.id || "all"}
            type="button"
            onClick={() => select(opt.id)}
            aria-pressed={active}
            className="rounded-md px-2.5 py-1 text-sm whitespace-nowrap transition-colors"
            style={{
              background: active ? "var(--surface-1)" : "transparent",
              color: active ? "var(--ink-primary)" : "var(--ink-secondary)",
              fontWeight: active ? 500 : 400,
              boxShadow: active ? "0 1px 2px rgb(0 0 0 / 0.06)" : undefined,
            }}
          >
            {opt.name}
          </button>
        );
      })}
    </div>
  );
}
