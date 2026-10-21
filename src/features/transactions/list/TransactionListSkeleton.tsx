/** Five pulsing placeholder rows shown while the list (or its Suspense boundary) loads. */
export function TransactionListSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-4 animate-pulse${className ? ` ${className}` : ""}`}>
      {[1,2,3,4,5].map(i => (
        <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-200"></div>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-200 rounded"></div>
              <div className="h-3 w-20 bg-slate-200 rounded"></div>
            </div>
          </div>
          <div className="h-6 w-24 bg-slate-200 rounded"></div>
        </div>
      ))}
    </div>
  );
}
