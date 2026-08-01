"use client";

import { useState, useTransition } from "react";
import { Check, ChevronRight, Pencil, Trash2, X } from "lucide-react";

import type { StructureItem } from "@/components/admin/structure-canvas";

export interface CardLabels {
  rename: string;
  remove: string;
  edit: string;
  cancel: string;
  confirmDelete: string;
  confirmYes: string;
}

type Action = (formData: FormData) => Promise<void>;

/**
 * A structure card in one of three modes: view, rename, confirm-delete.
 *
 * The name is plain TEXT until the pencil is pressed. It used to be a live
 * input, which meant that aiming at the card to open it landed the caret in the
 * name instead — the card's main job, drilling in, was blocked by its rarest
 * one. Editing is now something you ask for.
 *
 * Deleting asks first. It cascades to everything inside the floor or department
 * and there is no undo, so a mis-aimed click must not be enough to trigger it.
 */
export function StructureCard({
  item,
  labels,
  rename,
  remove,
}: {
  item: StructureItem;
  labels: CardLabels;
  rename: Action;
  remove: Action;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  const [pending, startTransition] = useTransition();

  /*
   * Return to view only AFTER the action resolves. Switching on submit would
   * unmount the form while its request is still in flight, and the rename would
   * be lost on a slow connection — exactly when the user is least sure it saved.
   */
  function submitRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      await rename(formData);
      setMode("view");
    });
  }

  return (
    <div
      className="flex h-full w-full items-center gap-2 rounded-xl px-3.5 py-3"
      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
      /* While editing or confirming, the whole card stops being a drag handle
         and a link — otherwise a click aimed at Cancel navigates away instead. */
      {...(mode === "view" ? {} : { "data-no-drag": true })}
    >
      {mode === "confirm" ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--ink-primary)" }}>
            {labels.confirmDelete}
          </span>
          <form action={remove}>
            <input type="hidden" name="entity" value={item.entity} />
            <input type="hidden" name="id" value={item.id} />
            <button
              type="submit"
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-white"
              style={{ background: "var(--status-critical)" }}
            >
              {labels.confirmYes}
            </button>
          </form>
          <IconButton label={labels.cancel} onClick={() => setMode("view")}>
            <X size={14} aria-hidden />
          </IconButton>
        </div>
      ) : mode === "edit" ? (
        <form
          onSubmit={submitRename}
          className="flex min-w-0 flex-1 items-center gap-2"
          style={{ opacity: pending ? 0.6 : 1 }}
        >
          <input type="hidden" name="entity" value={item.entity} />
          <input type="hidden" name="id" value={item.id} />
          <input
            name="name"
            defaultValue={item.name}
            required
            maxLength={120}
            autoFocus
            aria-label={labels.rename}
            onKeyDown={(e) => {
              if (e.key === "Escape") setMode("view");
            }}
            className="min-w-0 flex-1 rounded-lg px-2 py-1 text-sm font-semibold outline-none"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--hairline)",
              color: "var(--ink-primary)",
            }}
          />
          <IconButton label={labels.rename} type="submit" accent disabled={pending}>
            <Check size={14} aria-hidden />
          </IconButton>
          <IconButton label={labels.cancel} onClick={() => setMode("view")} disabled={pending}>
            <X size={14} aria-hidden />
          </IconButton>
        </form>
      ) : (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{item.name}</span>
            <span className="block truncate text-xs" style={{ color: "var(--ink-muted)" }}>
              {item.meta}
            </span>
          </span>

          {/* data-no-drag: pressing a button must not start a drag or navigate. */}
          <span data-no-drag className="flex items-center gap-1.5">
            <IconButton label={labels.edit} onClick={() => setMode("edit")}>
              <Pencil size={14} aria-hidden />
            </IconButton>
            <IconButton label={labels.remove} onClick={() => setMode("confirm")}>
              <Trash2 size={14} aria-hidden />
            </IconButton>
          </span>

          <ChevronRight size={16} style={{ color: "var(--ink-muted)" }} aria-hidden />
        </>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  type = "button",
  accent,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
  accent?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
      style={
        accent
          ? { background: "var(--series-1)", color: "#fff" }
          : { border: "1px solid var(--hairline)", color: "var(--ink-muted)" }
      }
    >
      {children}
    </button>
  );
}
