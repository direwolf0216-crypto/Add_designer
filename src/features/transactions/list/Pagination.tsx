interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  /** Disables the buttons while the next page loads. */
  isLoadingMore: boolean;
  onPageChange: (page: number) => void;
}

/** "Showing x to y of n" with Prev / Next; hidden when everything fits on one page. */
export function Pagination({ currentPage, totalPages, totalCount, pageSize, isLoadingMore, onPageChange }: PaginationProps) {
  if (totalCount <= pageSize) return null;

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mt-6 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 gap-4">
      <div className="text-[0.8rem] font-bold text-slate-500 uppercase tracking-wider">
        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} entries
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || isLoadingMore}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-bold text-[0.85rem] text-slate-700 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          <i className="ph-bold ph-caret-left"></i> Prev
        </button>

        <div className="hidden sm:flex items-center justify-center px-4 font-bold text-[0.85rem] text-slate-700 bg-white border border-slate-200 rounded-xl shadow-sm">
          Page {currentPage} of {totalPages}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoadingMore}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-bold text-[0.85rem] text-slate-700 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          Next <i className="ph-bold ph-caret-right"></i>
        </button>
      </div>
    </div>
  );
}
