import { HeaderSkeleton, Skeleton } from "@/components/layout/skeleton";

export default function AlertsLoading() {
  return (
    <div className="flex flex-col gap-5">
      <HeaderSkeleton />
      <div className="flex items-center justify-between gap-3">
        <Skeleton height={16} width={120} radius={4} />
        <Skeleton height={30} width={160} />
      </div>
      <div
        className="flex flex-col gap-3 rounded-xl p-4"
        style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={40} />
        ))}
      </div>
    </div>
  );
}
