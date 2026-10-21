import { SkeletonExit } from "./PageReveal";

const Box = ({ className }: { className: string }) => <div className={`skeleton rounded-2xl ${className}`} />;

/** Route-level loading placeholders shaped like the page they stand in for (no layout jump on arrival). */
export default function PageSkeleton({ variant = "dashboard" }: { variant?: "dashboard" | "table" | "board" | "feed" | "detail" }) {
  return (
    <SkeletonExit>
      <div className="flex w-full flex-col gap-6" aria-busy="true" aria-label="Loading">
        <div className="flex items-center gap-4">
          <Box className="h-12 w-12" />
          <div className="flex-1 space-y-2">
            <Box className="h-5 w-48 !rounded-lg" />
            <Box className="h-3 w-32 !rounded-lg" />
          </div>
        </div>

        {(variant === "dashboard" || variant === "board" || variant === "table") && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Box key={i} className="h-[84px]" />)}
          </div>
        )}

        {variant === "dashboard" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Box className="h-72 lg:col-span-2" />
            <Box className="h-72" />
          </div>
        )}

        {(variant === "table" || variant === "board") && (
          <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white/70 p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-slate-100 py-3 last:border-0">
                <Box className="h-9 w-9 !rounded-full" />
                <Box className="h-3 flex-[2] !rounded-lg" />
                <Box className="h-3 flex-1 !rounded-lg" />
                <Box className="h-6 w-20 !rounded-full" />
              </div>
            ))}
          </div>
        )}

        {variant === "feed" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => <Box key={i} className="h-40" />)}
          </div>
        )}

        {variant === "detail" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Box className="h-56" />
            <Box className="h-56" />
            <Box className="h-40 lg:col-span-2" />
          </div>
        )}
      </div>
    </SkeletonExit>
  );
}
