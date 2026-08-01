import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";

import { FreeCanvas } from "@/components/building/free-canvas";
import { StructureCard, type CardLabels } from "@/components/admin/structure-card";

export interface StructureItem {
  id: string;
  name: string;
  meta: string;
  href: string;
  /** Which table the delete button acts on. */
  entity: "floor" | "department" | "room";
}

interface Props {
  items: StructureItem[];
  storageKey: string;
  eyebrow: string;
  hint: string;
  emptyHint: string;
  /** Inline "+" form: hidden fields plus the label texts. */
  add: {
    action: (formData: FormData) => Promise<void>;
    hidden: Record<string, string>;
    placeholder: string;
  };
  remove: { action: (formData: FormData) => Promise<void>; label: string };
  rename: { action: (formData: FormData) => Promise<void>; label: string };
  /** Card button texts — edit, cancel and the delete confirmation. */
  labels: Omit<CardLabels, "rename" | "remove">;
  header?: { name: string; meta: string };
  backHref?: string;
}

/** Graph-paper backdrop — the same surface the dashboard plan uses. */
const GRID = "radial-gradient(var(--hairline) 1px, transparent 1px)";

/**
 * The admin structure editor drawn exactly like the dashboard plan: same
 * canvas, same cards, same drag-to-arrange. An editor that looks like the thing
 * it edits is one mental model instead of two.
 */
export function StructureCanvas({
  items,
  storageKey,
  eyebrow,
  hint,
  emptyHint,
  add,
  remove,
  rename,
  labels,
  header,
  backHref,
}: Props) {
  return (
    <section
      className="rounded-xl p-4"
      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
    >
      <div
        className="rounded-lg p-4"
        style={{
          background: "var(--paper)",
          backgroundImage: GRID,
          backgroundSize: "16px 16px",
          border: "1px solid var(--hairline)",
        }}
      >
        <div className="flex flex-col gap-3">
          {header ? (
            <div className="flex items-center gap-3">
              {backHref ? (
                <Link
                  href={backHref}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "var(--surface-2)", color: "var(--ink-secondary)" }}
                >
                  <ChevronLeft size={16} aria-hidden />
                </Link>
              ) : null}
              <div>
                <p className="text-sm font-semibold">{header.name}</p>
                <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                  {header.meta}
                </p>
              </div>
            </div>
          ) : null}

          {/* Create sits above the canvas, where it cannot be dragged away. */}
          <form action={add.action} className="flex max-w-[380px] items-center gap-2">
            {Object.entries(add.hidden).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            <input
              name="name"
              required
              maxLength={120}
              placeholder={add.placeholder}
              className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--hairline)",
                color: "var(--ink-primary)",
              }}
            />
            <button
              type="submit"
              aria-label={add.placeholder}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ background: "var(--series-1)" }}
            >
              <Plus size={16} aria-hidden />
            </button>
          </form>

          {items.length === 0 ? (
            <p className="py-16 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
              {emptyHint}
            </p>
          ) : (
            <FreeCanvas
              storageKey={storageKey}
              resetLabel=""
              eyebrow={eyebrow}
              hint={hint}
              editable
              items={items.map((item) => ({
                id: item.id,
                href: item.href,
                node: (
                  <StructureCard
                    item={item}
                    rename={rename.action}
                    remove={remove.action}
                    labels={{ ...labels, rename: rename.label, remove: remove.label }}
                  />
                ),
              }))}
            />
          )}
        </div>
      </div>
    </section>
  );
}

