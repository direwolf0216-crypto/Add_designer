/** The dashboard's final layout with each value as a flat grey bar at its real size. */
export function MetricsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2 bg-surface px-5 py-4">
            <div className="skeleton h-3.5 w-16" />
            <div className="skeleton h-6 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-card border border-line bg-surface p-5">
          <div className="skeleton h-4 w-44" />
          <div className="skeleton mt-4 h-[260px] w-full" />
        </div>
        <div className="flex flex-col gap-6">
          <div className="rounded-card border border-line bg-surface p-5">
            <div className="skeleton h-4 w-36" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="mt-4 flex items-center justify-between">
                <div className="skeleton h-3.5 w-32" />
                <div className="skeleton h-3.5 w-20" />
              </div>
            ))}
          </div>
          <div className="rounded-card border border-line bg-surface p-5">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton mt-4 h-2 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Route-level loading: the title row, then the metrics skeleton. */
export default function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="skeleton h-7 w-36" />
        <div className="skeleton mt-2 h-4 w-72" />
      </div>
      <MetricsSkeleton />
    </div>
  );
}
