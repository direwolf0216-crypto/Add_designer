"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toLocalISODate } from "@/lib/dates";
import { downloadCsv } from "@/lib/export/csv";
import { saveTablesPdf } from "@/lib/export/pdf";
import { ledgerCsv, ledgerPdfSections, summariseLedger } from "@/lib/transactions/ledgerExport";
import type { TransactionRecord } from "@/lib/transactions/types";

interface ExportMenuProps {
  /** Rows to export (the current page as shown). */
  transactions: TransactionRecord[];
}

/** Export button with a CSV / PDF dropdown. */
export function ExportMenu({ transactions }: ExportMenuProps) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (transactions.length === 0) return;
    setExportMenuOpen(false);
    setIsExporting(true);
    try {
      const totals = summariseLedger(transactions);
      if (format === 'csv') {
        downloadCsv(`add-designer-ledger-${toLocalISODate()}.csv`, ledgerCsv(transactions, totals));
      } else {
        await saveTablesPdf(`add-designer-ledger-${toLocalISODate()}.pdf`, "Transactions Ledger", ledgerPdfSections(transactions, totals));
      }
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setExportMenuOpen(!exportMenuOpen)}
        disabled={isExporting}
        className="h-[45px] px-4 rounded-xl border border-slate-200 bg-white shadow-sm font-bold text-[0.95rem] text-slate-700 flex items-center gap-2 transition-all hover:shadow-md hover:border-slate-300 active:scale-95"
      >
        {isExporting ? (
          <i className="ph ph-circle-notch animate-spin"></i>
        ) : (
          <i className="ph-bold ph-download-simple"></i>
        )}
        Export
      </button>
      {exportMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden py-1">
            <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2.5 text-[0.85rem] font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
              <i className="ph-bold ph-file-csv text-lg text-emerald-500"></i> Export as CSV
            </button>
            <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2.5 text-[0.85rem] font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
              <i className="ph-bold ph-file-pdf text-lg text-rose-500"></i> Export as PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}
