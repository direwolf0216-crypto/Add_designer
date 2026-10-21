import type { TransactionUrlFilters } from "@/lib/transactions/filters";
import { hasActiveFilterBadges } from "@/lib/transactions/filters";

interface ActiveFilterBadgesProps {
  filters: TransactionUrlFilters;
  onClear: () => void;
}

/** Orange strip listing the filters currently applied from the URL, with a Clear button. */
export function ActiveFilterBadges({ filters: filterParams, onClear }: ActiveFilterBadgesProps) {
  if (!hasActiveFilterBadges(filterParams)) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-6 p-4 bg-orange-50 rounded-2xl border border-orange-100">
      <span className="text-xs font-bold text-orange-500 uppercase tracking-wider flex items-center mr-2"><i className="ph-bold ph-funnel mr-1"></i> Active Filters:</span>
      {filterParams.dateFrom && <span className="bg-white border border-orange-200 text-orange-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm">From: {filterParams.dateFrom}</span>}
      {filterParams.dateTo && <span className="bg-white border border-orange-200 text-orange-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm">To: {filterParams.dateTo}</span>}
      {filterParams.categories && <span className="bg-white border border-orange-200 text-orange-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm">Categories: {filterParams.categories}</span>}
      {filterParams.amountMin && <span className="bg-white border border-orange-200 text-orange-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm">Min: ₹{filterParams.amountMin}</span>}
      {filterParams.amountMax && <span className="bg-white border border-orange-200 text-orange-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm">Max: ₹{filterParams.amountMax}</span>}
      {filterParams.type && filterParams.type !== 'ALL' && <span className="bg-white border border-orange-200 text-orange-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm">Type: {filterParams.type}</span>}
      {filterParams.paymentMode && filterParams.paymentMode !== 'ALL' && <span className="bg-white border border-orange-200 text-orange-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm">Mode: {filterParams.paymentMode}</span>}
      <button onClick={onClear} className="ml-auto text-xs font-bold text-orange-500 hover:text-orange-700 transition-colors flex items-center gap-1"><i className="ph-bold ph-x"></i> Clear</button>
    </div>
  );
}
