"use client";
import React from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Modals from '@/components/dashboard/Modals';
import { useJobs } from '@/components/providers/JobProvider';
import { useGlobalForm } from '@/components/providers/GlobalFormProvider';

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { setIsFilterModalOpen, filters, setFilters, hasData } = useJobs();
  const { openJobForm } = useGlobalForm();

  const isOverview = pathname === '/jobs/overview';
  const isUpcoming = pathname === '/jobs/upcoming';
  const isJobStatus = pathname === '/jobs/job-status';
  const isTable = pathname === '/jobs/allJobs';
  const hasActiveFilters = filters.categories.length > 0 || filters.statuses.length > 0 || filters.clientName || filters.location || filters.dateStart || filters.dateEnd || filters.amountMin || filters.amountMax;

  const [isExporting, setIsExporting] = React.useState(false);
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false);

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExportMenuOpen(false);
    setIsExporting(true);
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      const allJobs = Array.isArray(data) ? data : (data?.items || []);
      
      const filtered = allJobs.filter((b: any) => {
        if (filters.categories.length > 0 && !filters.categories.includes(b.category)) return false;
        if (filters.statuses.length > 0 && !filters.statuses.includes(b.status)) return false;
        if (filters.clientName && !b.client?.name?.toLowerCase().includes(filters.clientName.toLowerCase())) return false;
        const bDate = b.date.split('T')[0];
        if (filters.dateStart && bDate < filters.dateStart) return false;
        if (filters.dateEnd && bDate > filters.dateEnd) return false;
        return true;
      });

      const sorted = [...filtered].sort((a: any, b: any) => a.date.localeCompare(b.date));

      if (sorted.length === 0) {
        alert("No data available to export with current filters.");
        setIsExporting(false);
        return;
      }

      if (format === 'csv') {
        const escapeCsv = (val: any) => {
          if (val === null || val === undefined || val === '') return '""';
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        };

        const maxRepEntries: Record<string, number> = {};
        const repKeys = new Set<string>();
        sorted.forEach((b: any) => {
           let cdata = b.customData;
           if (typeof cdata === 'string') { try { cdata = JSON.parse(cdata); } catch(e){} }
           if (cdata && typeof cdata === 'object') {
             Object.keys(cdata).forEach(k => {
               if (k.startsWith('rep_')) {
                 const arr = cdata[k];
                 if (Array.isArray(arr)) {
                   maxRepEntries[k] = Math.max(maxRepEntries[k] || 0, arr.length);
                   arr.forEach(entry => {
                     if (entry && typeof entry === 'object') {
                        Object.keys(entry).forEach(ek => repKeys.add(ek));
                     }
                   });
                 }
               }
             });
           }
        });

        const dynamicHeaders: string[] = [];
        Object.keys(maxRepEntries).forEach(secKey => {
           const sectionName = secKey.replace('rep_', '').replace(/_/g, ' ');
           const max = maxRepEntries[secKey];
           for (let i = 0; i < max; i++) {
              Array.from(repKeys).forEach(fKey => {
                 dynamicHeaders.push(`${sectionName} ${i+1} - ${fKey.replace('fld_', '').replace('b_', '').replace(/_/g, ' ')}`);
              });
           }
        });

        const headers = [
          "ID", "Client Name", "Client Phone", "Client Email", "Job Category", 
          "Order Date", "Target Time", "Delivery Location", "Status", "Total Amount", 
          "Advance", "Due", "Installments", "Assigned Operator", "Quantity", "Paper Type", "GSM", "Dimensions", 
          "Custom Data",
          ...dynamicHeaders
        ];
        
        const rows = sorted.map((b: any) => {
          let cdata = b.customData;
          if (typeof cdata === 'string') { try { cdata = JSON.parse(cdata); } catch(e){} }
          
          const row = [
            escapeCsv(b.jobNumber || b.id.substring(b.id.length - 6).toUpperCase()),
            escapeCsv(b.client?.name),
            escapeCsv(b.client?.phone),
            escapeCsv(b.client?.email),
            escapeCsv(b.category),
            escapeCsv(b.date?.split('T')[0]),
            escapeCsv(b.time),
            escapeCsv(b.location),
            escapeCsv(b.status),
            escapeCsv(b.order?.package),
            escapeCsv(b.order?.advance),
            escapeCsv(b.order?.due),
            escapeCsv(b.order?.installments),
            escapeCsv(cdata?.fld_b_assigned_operator || b.photographers),
            escapeCsv(cdata?.fld_print_quantity || ''),
            escapeCsv(cdata?.fld_print_paper_type || ''),
            escapeCsv(cdata?.fld_print_gsm || ''),
            escapeCsv(cdata?.fld_print_dimensions || ''),
            escapeCsv(cdata)
          ];
          
          Object.keys(maxRepEntries).forEach(secKey => {
             const arr = (cdata && Array.isArray(cdata[secKey])) ? cdata[secKey] : [];
             const max = maxRepEntries[secKey];
             for (let i = 0; i < max; i++) {
                const entry = arr[i] || {};
                Array.from(repKeys).forEach(fKey => {
                   row.push(escapeCsv(entry[fKey] || ''));
                });
             }
          });
          return row;
        });
        const csvContent = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `jobs_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const { jsPDF } = await import("jspdf");
        const autoTable = (await import("jspdf-autotable")).default;
        const doc = new jsPDF();
        doc.text("Jobs Schedule", 14, 15);
        const tableData = sorted.map((b: any) => [
          b.jobNumber || b.id.substring(b.id.length - 6).toUpperCase(),
          b.client?.name || '',
          b.category,
          b.date.split('T')[0],
          b.time,
          b.location || '',
          b.order?.package?.toString() || '0',
          b.status
        ]);
        autoTable(doc, {
          head: [["ID", "Client", "Category", "Date", "Time", "Location", "Amount", "Status"]],
          body: tableData,
          startY: 20,
        });
        doc.save(`jobs_export_${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (error) {
      alert("Failed to export schedule.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="view-section active w-full fade-in-up">
      <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10">
        {/* Top Banner & Tabs */}
        <div className="relative w-full bg-white rounded-2xl overflow-hidden mb-2 shadow-sm border border-slate-100">
          {/* Decorative background */}
          <div className="absolute right-0 top-0 w-[60%] h-full opacity-30 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 800 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M 0 200 C 200 100 600 300 800 200 L 800 0 L 0 0 Z\' fill=\'url(%23grad)\'/%3E%3Cdefs%3E%3ClinearGradient id=\'grad\' x1=\'0%25\' y1=\'0%25\' x2=\'100%25\' y2=\'0%25\'%3E%3Cstop offset=\'0%25\' stop-color=\'%23a855f7\' stop-opacity=\'0.2\'/%3E%3Cstop offset=\'100%25\' stop-color=\'%23ec008c\' stop-opacity=\'0.2\'/%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E")', backgroundSize: 'cover', backgroundPosition: 'right' }}></div>
          
          <div className="px-8 py-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
            <div>
              <h1 className="text-3xl font-black text-slate-900 mb-1 tracking-tight">Jobs</h1>
              <p className="text-slate-500 font-medium text-sm">Track, manage and deliver every print job efficiently.</p>
            </div>
            
            <button 
              onClick={() => openJobForm()}
              className="bg-gradient-to-r from-pink-500 to-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-pink-500/20 whitespace-nowrap"
            >
              <i className="ph ph-plus font-bold"></i> Add New Job
            </button>
          </div>
          
          {/* Sub Navigation */}
          <div className="px-8 flex items-center gap-8 border-b border-slate-100 mt-2 relative z-10">
            <Link
              href="/jobs/job-status"
              className={`pb-4 text-sm font-bold transition-colors border-b-2 ${
                isJobStatus 
                  ? 'border-pink-500 text-pink-500' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Job Status
            </Link>
            <Link
              href="/jobs/upcoming"
              className={`pb-4 text-sm font-bold transition-colors border-b-2 ${
                isUpcoming 
                  ? 'border-pink-500 text-pink-500' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Pending Deliveries
            </Link>
            <Link
              href="/jobs/allJobs"
              className={`pb-4 text-sm font-bold transition-colors border-b-2 ${
                isTable 
                  ? 'border-pink-500 text-pink-500' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              All Jobs
            </Link>
          </div>
        </div>

        {/* Filters Row */}
        {isTable && (
          <div className="flex flex-wrap items-center gap-3 w-full justify-end mt-2">
            {hasActiveFilters && (
              <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100 overflow-x-auto hide-scrollbar max-w-full">
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ea580c" }}>Filtered by:</span>
                {filters.categories.length > 0 && <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#c2410c" }}>{filters.categories.join(', ')}</span>}
                {filters.statuses.length > 0 && <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#c2410c" }}>{filters.statuses.join(', ')}</span>}
                {filters.clientName && <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#c2410c" }}>{filters.clientName}</span>}
                {filters.location && <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#c2410c" }}>{filters.location}</span>}
                {(filters.dateStart || filters.dateEnd) && <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#c2410c" }}>{filters.dateStart || 'Any'} to {filters.dateEnd || 'Any'}</span>}
                <button onClick={() => setFilters({ categories: [], statuses: [], clientName: '', location: '', dateStart: '', dateEnd: '', amountMin: '', amountMax: '' })} style={{ background: "none", border: "none", color: "#ea580c", cursor: "pointer", display: "flex", alignItems: "center", marginLeft: "4px" }} title="Clear Filters">
                  <i className="ph-bold ph-x"></i>
                </button>
              </div>
            )}
            
            <button 
              className="bg-white border border-slate-200 text-slate-600 font-bold py-2 px-4 rounded-xl flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm text-sm" 
              onClick={() => setIsFilterModalOpen(true)}
            >
              <i className="ph-fill ph-funnel text-slate-400 text-lg"></i> Filters
            </button>
            
            {hasData && (
              <div className="relative">
                <button 
                  className="bg-white border border-slate-200 text-slate-600 font-bold py-2 px-4 rounded-xl flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm text-sm" 
                  onClick={() => setExportMenuOpen(!exportMenuOpen)}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin"></div>
                  ) : (
                    <i className="ph-bold ph-download-simple text-slate-400 text-lg"></i>
                  )}
                  Export Schedule
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
            )}
          </div>
        )}
      </div>

      <div className="sub-view active">
        {children}
      </div>

      {/* Shared Modals */}
      <Modals />


    </div>
  );
}
