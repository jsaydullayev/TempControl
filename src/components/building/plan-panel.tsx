import { PlanCards, type Entry } from "@/components/building/plan-cards";

/** Graph-paper backdrop — the panel reads as a plan surface, not a table. */
const GRID = "radial-gradient(var(--hairline) 1px, transparent 1px)";

export async function PlanPanel({
  entries,
  storageKey,
  eyebrow,
  hint,
  editable,
  header,
  backHref,
}: {
  entries: Entry[];
  storageKey: string;
  eyebrow: string;
  hint: string;
  editable: boolean;
  header?: { name: string; meta: string };
  backHref?: string;
}) {
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
        <PlanCards
          entries={entries}
          storageKey={storageKey}
          eyebrow={eyebrow}
          hint={hint}
          editable={editable}
          header={header}
          backHref={backHref}
        />
      </div>
    </section>
  );
}
