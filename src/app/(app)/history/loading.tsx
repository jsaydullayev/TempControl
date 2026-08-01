import { HeaderSkeleton, PanelSkeleton, Skeleton } from "@/components/layout/skeleton";

export default function HistoryLoading() {
  return (
    <div className="flex flex-col gap-5">
      <HeaderSkeleton />
      <Skeleton height={30} width={280} />
      <PanelSkeleton height={280} />
      <PanelSkeleton height={280} />
    </div>
  );
}
