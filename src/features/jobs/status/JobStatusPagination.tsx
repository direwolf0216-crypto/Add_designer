"use client";

interface JobStatusPaginationProps {
  page: number;
  totalPages: number;
  perPage: number;
  totalCount: number;
  onPageChange: (updater: (prev: number) => number) => void;
}

export default function JobStatusPagination({ page, totalPages, perPage, totalCount, onPageChange }: JobStatusPaginationProps) {
  return (
    <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 mt-auto">
      <div className="flex gap-2">
        <button
          disabled={page === 1}
          onClick={() => onPageChange(prev => Math.max(1, prev - 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <i className="ph ph-caret-left font-bold"></i>
        </button>
        <div className="w-8 h-8 flex items-center justify-center rounded-lg border border-pink-100 bg-pink-50 text-pink-500 font-bold shadow-sm">
          {page}
        </div>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(prev => Math.min(totalPages, prev + 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <i className="ph ph-caret-right font-bold"></i>
        </button>
      </div>
      <div className="text-xs font-bold text-slate-500">
        Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, totalCount)} of {totalCount} jobs
      </div>
    </div>
  );
}
