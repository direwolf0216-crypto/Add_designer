"use client";

import React, { useState, useEffect, useRef } from 'react';
import CustomDropdown from "@/components/ui/CustomDropdown";
import DatePickerInput from "@/components/ui/DatePickerInput";
import { cn } from "@/lib/utils";
import { useGlobalForm } from "@/components/providers/GlobalFormProvider";

import { updateJobTrackingAction, deleteJobAction } from "@/app/actions";
import { toast } from "sonner";
import { useRouter } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());
import { FolderClock, PenTool, Printer, Package, ChevronRight, AlertTriangle, ChevronDown } from 'lucide-react';
import styles from './job-status.module.css';

const ICON_MAP: Record<string, React.ReactNode> = {
  FolderClock: <FolderClock size={18} />,
  PenTool: <PenTool size={18} />,
  Printer: <Printer size={18} />,
  Package: <Package size={18} />,
  AlertTriangle: <AlertTriangle size={18} />,
};

const STATUS_CARDS = [
  {
    status: 'Pending',
    label: 'Pending Jobs',
    sublabel: 'Awaiting action',
    icon: 'FolderClock',
    iconBg: '#ec008c', // Solid pink
    iconColor: '#ffffff',
    accentColor: '#ec008c',
    waveSvg: '<path fill="#ec008c" fill-opacity="0.05" d="M0,64L48,58.7C96,53,192,43,288,48C384,53,480,75,576,80C672,85,768,75,816,69.3L864,64L864,120L816,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"></path>',
  },
  {
    status: 'Overdue',
    label: 'Overdue Jobs',
    sublabel: 'Past due date',
    icon: 'AlertTriangle',
    iconBg: '#f97316', // Solid orange
    iconColor: '#ffffff',
    accentColor: '#f97316',
    waveSvg: '<path fill="#f97316" fill-opacity="0.05" d="M0,64L48,74.7C96,85,192,107,288,106.7C384,107,480,85,576,80C672,75,768,85,816,90.7L864,96L864,120L816,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"></path>',
  },
  {
    status: 'Designing',
    label: 'Designing',
    sublabel: 'In design phase',
    icon: 'PenTool',
    iconBg: '#8b5cf6', // Solid purple
    iconColor: '#ffffff',
    accentColor: '#8b5cf6',
    waveSvg: '<path fill="#8b5cf6" fill-opacity="0.05" d="M0,96L48,85.3C96,75,192,53,288,58.7C384,64,480,96,576,106.7C672,117,768,107,816,101.3L864,96L864,120L816,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"></path>',
  },
  {
    status: 'Printing',
    label: 'Printing in Progress',
    sublabel: 'Currently printing',
    icon: 'Printer',
    iconBg: '#1d4ed8', // Solid blue
    iconColor: '#ffffff',
    accentColor: '#1d4ed8',
    waveSvg: '<path fill="#1d4ed8" fill-opacity="0.05" d="M0,32L48,48C96,64,192,96,288,101.3C384,107,480,85,576,74.7C672,64,768,64,816,64L864,64L864,120L816,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"></path>',
  },
  {
    status: 'Ready for Delivery',
    label: 'Ready for Delivery',
    sublabel: 'Ready to dispatch',
    icon: 'Package',
    iconBg: '#16a34a', // Solid green
    iconColor: '#ffffff',
    accentColor: '#16a34a',
    waveSvg: '<path fill="#16a34a" fill-opacity="0.05" d="M0,64L48,58.7C96,53,192,43,288,48C384,53,480,75,576,80C672,85,768,75,816,69.3L864,64L864,120L816,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"></path>',
  },
];


interface JobStatusClientProps {
  jobs: any[];
  teamUsers?: any[];
  initialTab?: string;
}


const JOB_STATUS_OPTIONS = [
  'Pending',
  'Designing',
  'Printing',
  'Ready for Delivery',
  'Delivered'
];

export default function JobStatusClient({ jobs: initialJobs, teamUsers = [], initialTab = 'Pending' }: JobStatusClientProps) {
  const [jobs, setJobs] = useState(initialJobs);
  const router = useRouter();

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  const { data: layoutSchema } = useSWR('/api/settings/layout', fetcher);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { openJobDetails, openJobForm } = useGlobalForm();
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const counts = React.useMemo(() => {
    const arr = Array.isArray(jobs) ? jobs : (jobs ?? []);
    return {
      'Pending': arr.filter((b: any) => {
        let cd: any = {};
        try { cd = typeof b.customData === 'string' ? JSON.parse(b.customData) : (b.customData || {}); } catch (e) { }
        return (cd.fld_b_status || 'Pending') === 'Pending';
      }).length,
      'Designing': arr.filter((b: any) => {
        let cd: any = {};
        try { cd = typeof b.customData === 'string' ? JSON.parse(b.customData) : (b.customData || {}); } catch (e) { }
        return cd.fld_b_status === 'Designing';
      }).length,
      'Printing': arr.filter((b: any) => {
        let cd: any = {};
        try { cd = typeof b.customData === 'string' ? JSON.parse(b.customData) : (b.customData || {}); } catch (e) { }
        return cd.fld_b_status === 'Printing';
      }).length,
      'Ready for Delivery': arr.filter((b: any) => {
        let cd: any = {};
        try { cd = typeof b.customData === 'string' ? JSON.parse(b.customData) : (b.customData || {}); } catch (e) { }
        return cd.fld_b_status === 'Ready for Delivery';
      }).length,
      'Overdue': arr.filter((b: any) => {
        let cd: any = {};
        try { cd = typeof b.customData === 'string' ? JSON.parse(b.customData) : (b.customData || {}); } catch (e) { }
        const deliveryDateStr = cd.job_delivery_date || cd.delivery_date;
        if (deliveryDateStr) {
          const deliveryDate = new Date(deliveryDateStr);
          const aStatus = (cd.fld_b_status || '').trim().toLowerCase();
          if (deliveryDate < new Date() && aStatus !== 'delivered') return true;
        }
        return false;
      }).length,
    }
  }, [jobs]);

  const handleUpdateJob = async (jobId: string, updates: { status?: string, customData?: any }) => {
    // Optimistic update
    setJobs(prev => prev.map(a => {
      if (a.id === jobId) {
        let newCustomData = typeof a.customData === 'string' ? JSON.parse(a.customData) : (a.customData || {});
        if (updates.customData) {
          newCustomData = { ...newCustomData, ...updates.customData };
        }
        return {
          ...a,
          status: updates.status !== undefined ? updates.status : a.status,
          customData: JSON.stringify(newCustomData)
        };
      }
      return a;
    }));

    const res = await updateJobTrackingAction(jobId, updates);
    if (!res.success) {
      toast.error(res.error || "Failed to update job");
      // Revert optimistic update ideally, but skipping for brevity
    } else {
      toast.success("Job updated");
      globalMutate(
        (key) => typeof key === 'string' && (key.startsWith('/api/jobs') || key.startsWith('/api/dashboard')),
        undefined,
        { revalidate: true }
      );
      router.refresh();
    }
  };


  const selectedJob = jobs.find(a => a.id === selectedJobId) || null;

  const filteredJobs = jobs.filter(a => {
    let customData: any = {};
    try { customData = typeof a.customData === 'string' ? JSON.parse(a.customData) : (a.customData || {}); } catch (e) { }
    const aStatus = (customData.fld_b_status || 'pending').trim().toLowerCase();

    if (activeTab === 'Pending') {
      if (aStatus !== 'pending') return false;
    }
    if (activeTab === 'Designing') {
      if (aStatus !== 'designing') return false;
    }
    if (activeTab === 'Printing') {
      if (aStatus !== 'printing') return false;
    }
    if (activeTab === 'Ready for Delivery') {
      if (aStatus !== 'ready for delivery') return false;
    }
    if (activeTab === 'Overdue') {
      const deliveryDateStr = customData.job_delivery_date || customData.delivery_date;
      if (!deliveryDateStr) return false;
      const deliveryDate = new Date(deliveryDateStr);
      if (deliveryDate >= new Date() || aStatus === 'delivered') return false;
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const designerId = customData.designer;
      const designerUser = teamUsers?.find(u => u.id === designerId);
      const designerName = designerUser ? designerUser.name : (designerId || '');

      const match = (a.client?.name || '').toLowerCase().includes(q) ||
        (a.client?.phone || '').toLowerCase().includes(q) ||
        (a.jobNumber || '').toLowerCase().includes(q) ||
        (a.category || '').toLowerCase().includes(q) ||
        designerName.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const ITEMS_PER_PAGE = 25;
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedJobs = filteredJobs.slice((safeCurrentPage - 1) * ITEMS_PER_PAGE, safeCurrentPage * ITEMS_PER_PAGE);

  return (
    <div className="view-section active w-full fade-in-up">
      <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10">



        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {STATUS_CARDS.map((card, index) => (
            <div
              key={card.status}
              className={`relative bg-white rounded-2xl overflow-hidden flex flex-col h-[130px] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer group border border-slate-100 ${activeTab === card.status ? 'ring-2 ring-offset-2' : ''}`}
              style={{ animationDelay: `${index * 80}ms`, ...(activeTab === card.status ? { '--tw-ring-color': card.accentColor, boxShadow: `0 4px 12px ${card.accentColor}40` } as React.CSSProperties : {}) }}
              onClick={() => setActiveTab(card.status)}
            >
              {/* Background Wave */}
              <div className="absolute bottom-0 left-0 right-0 w-full h-[50%] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-300" dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 864 120" width="100%" height="100%" preserveAspectRatio="none">${card.waveSvg}</svg>` }} />
              
              <div className="p-5 flex items-start gap-4 relative z-10">
                <div
                  className="w-12 h-12 rounded-full flex shrink-0 items-center justify-center shadow-sm"
                  style={{ backgroundColor: card.iconBg, color: card.iconColor }}
                >
                  {ICON_MAP[card.icon]}
                </div>
                <div className="flex flex-col mt-0.5">
                  <div className="text-slate-600 font-bold text-[0.75rem] mb-1">{card.label}</div>
                  <div className="text-[1.35rem] font-black text-slate-900 leading-none mb-1.5 tracking-tight">
                    {(counts as any)[card.status] ?? 0}
                  </div>
                  <div className="text-[0.65rem] text-slate-400 font-medium uppercase tracking-wider">{card.sublabel}</div>
                </div>
              </div>
            </div>
          ))}
        </div>


        {/* Main Content Split */}
        <div className="flex flex-col lg:flex-row gap-6 mt-2">

          {/* Left Column - List */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            {filteredJobs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="p-5 text-[0.7rem] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap"><i className="ph ph-user mr-2 text-slate-400"></i> CUSTOMER</th>
                      <th className="p-5 text-[0.7rem] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap"><i className="ph ph-tag mr-2 text-slate-400"></i> JOB ID</th>
                      <th className="p-5 text-[0.7rem] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap"><i className="ph ph-folder mr-2 text-slate-400"></i> CATEGORY</th>
                      <th className="p-5 text-[0.7rem] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap"><i className="ph ph-package mr-2 text-slate-400"></i> SIZE / QUANTITY</th>
                      <th className="p-5 text-[0.7rem] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap text-center"><i className="ph ph-calendar mr-2 text-slate-400"></i> DUE DATE</th>
                      <th className="p-5 text-[0.7rem] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap text-center"><i className="ph ph-flag mr-2 text-slate-400"></i> STATUS</th>
                      <th className="p-5 text-[0.7rem] font-black text-slate-500 uppercase tracking-widest text-right"><i className="ph ph-lightning mr-2 text-slate-400"></i> ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedJobs.map((a: any) => {
                      let cData: any = {};
                      try {
                        cData = typeof a.customData === 'string' ? JSON.parse(a.customData) : (a.customData || {});
                      } catch (e) { }

                      const bDate = a.date instanceof Date ? a.date.toISOString().split('T')[0] : a.date?.split('T')[0];
                      const formattedOrderDate = bDate ? new Date(bDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
                      const firstRepItem = Array.isArray(a.items) ? a.items[0] : null;

                      let deliveryDateStr = cData.due_date || cData.dueDate || cData.fld_b_due_date || cData.delivery_date;
                      let resolvedCategory = cData.category || cData.fld_job_category || cData.fld_b_job_category || null;
                      let resolvedSize = cData.size || cData.fld_print_size || firstRepItem?.size || firstRepItem?.fld_print_size || null;
                      let resolvedQty = cData.qty || cData.quantity || cData.fld_print_quantity || firstRepItem?.qty || firstRepItem?.quantity || firstRepItem?.fld_print_quantity || null;

                      // Use layout schema to precisely identify dynamic fields by their real names
                      if (layoutSchema?.sections) {
                        layoutSchema.sections.forEach((sec: any) => {
                          sec.fields.forEach((f: any) => {
                            const fname = f.name.toLowerCase();
                            const fid = f.id;
                            
                            // Find category
                            if (!resolvedCategory && fname.includes('category')) {
                              resolvedCategory = cData[fid];
                            }
                            
                            // Find delivery/due date
                            if (!deliveryDateStr && (fname.includes('due') || fname.includes('delivery') || (fname.includes('date') && !f.isRecordDate))) {
                              deliveryDateStr = cData[fid];
                            }
                            
                            // Find size
                            if (!resolvedSize && fname.includes('size')) {
                              resolvedSize = cData[fid] || firstRepItem?.[fid];
                            }
                            
                            // Find qty
                            if (!resolvedQty && (fname.includes('qty') || fname.includes('quantity'))) {
                              resolvedQty = cData[fid] || firstRepItem?.[fid];
                            }
                          });
                        });
                      }

                      // Fallback logic for extraction without schema
                      if (!deliveryDateStr) {
                        for (const [k, v] of Object.entries(cData)) {
                          const kLow = k.toLowerCase();
                          if (kLow.includes('due') || kLow.includes('delivery')) {
                            deliveryDateStr = v as string;
                            break;
                          }
                        }
                      }
                      const formattedDeliveryDate = deliveryDateStr ? new Date(deliveryDateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set';

                      if (!resolvedSize || !resolvedQty || !resolvedCategory) {
                        for (const [k, v] of Object.entries(cData)) {
                          const kLow = k.toLowerCase();
                          if (!resolvedSize && (kLow.includes('size'))) resolvedSize = v as string;
                          if (!resolvedQty && (kLow.includes('qty') || kLow.includes('quantity'))) resolvedQty = v as string;
                          if (!resolvedCategory && (kLow.includes('category'))) resolvedCategory = v as string;
                        }
                      }
                      if (firstRepItem && (!resolvedSize || !resolvedQty)) {
                        for (const [k, v] of Object.entries(firstRepItem)) {
                          const kLow = k.toLowerCase();
                          if (!resolvedSize && (kLow.includes('size'))) resolvedSize = v as string;
                          if (!resolvedQty && (kLow.includes('qty') || kLow.includes('quantity'))) resolvedQty = v as string;
                        }
                      }

                      const finalCategory = resolvedCategory || a.category || '-';

                      let statusLabel = cData.fld_b_status || 'Pending';
                      let statusBg = 'bg-slate-100';
                      let statusText = 'text-slate-700';
                      let statusDot = 'bg-slate-400';
                      let progress = parseInt(cData.job_progress || '0');

                      if (statusLabel.toLowerCase() === 'pending') {
                        statusBg = 'bg-orange-100';
                        statusText = 'text-slate-800';
                        statusDot = 'bg-orange-500';
                      } else if (statusLabel.toLowerCase() === 'designing') {
                        statusBg = 'bg-purple-100';
                        statusText = 'text-slate-800';
                        statusDot = 'bg-purple-500';
                        if (progress === 0) progress = 25;
                      } else if (statusLabel.toLowerCase() === 'printing') {
                        statusBg = 'bg-blue-100';
                        statusText = 'text-slate-800';
                        statusDot = 'bg-blue-500';
                        if (progress === 0) progress = 50;
                      } else if (statusLabel.toLowerCase() === 'ready for delivery' || statusLabel.toLowerCase() === 'ready') {
                        statusBg = 'bg-emerald-100';
                        statusText = 'text-slate-800';
                        statusDot = 'bg-emerald-500';
                        if (progress === 0) progress = 75;
                      } else if (statusLabel.toLowerCase() === 'delivered') {
                        statusBg = 'bg-slate-100';
                        statusText = 'text-slate-800';
                        statusDot = 'bg-slate-500';
                        if (progress === 0) progress = 100;
                      }

                      return (
                        <tr key={a.id} className={`group hover:bg-slate-50/80 transition-colors ${selectedJobId === a.id ? 'bg-slate-50' : ''}`}>
                          <td
                            className="p-5 whitespace-nowrap cursor-pointer"
                            onClick={() => openJobDetails(a.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-200 overflow-hidden flex items-center justify-center text-slate-500 font-black uppercase text-lg group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
                                {a.client?.name?.charAt(0)}
                              </div>
                              <div>
                                <div className="font-black text-slate-800 text-sm group-hover:text-purple-600 transition-colors">{a.client?.name}</div>
                                <div className="text-xs text-slate-500 font-medium">{formattedOrderDate}</div>
                              </div>
                            </div>
                          </td>
                          <td
                            className="p-5 whitespace-nowrap cursor-pointer"
                            onClick={() => openJobDetails(a.id)}
                          >
                            <span className="text-purple-600 font-black text-sm hover:underline">
                              {a.jobNumber || `BK-${a.id.substring(a.id.length - 4).toUpperCase()}`}
                            </span>
                          </td>
                          <td className="p-5 whitespace-nowrap">
                            <div className="text-sm font-bold text-slate-700">{finalCategory}</div>
                          </td>
                          <td className="p-5 whitespace-nowrap">
                            <div className="text-sm font-bold text-slate-700">
                              {resolvedSize ? `${resolvedSize} ` : ''}
                              {resolvedQty ? `(${resolvedQty} pcs)` : (resolvedSize ? '' : '-')}
                              {!resolvedSize && !resolvedQty && '-'}
                            </div>
                          </td>
                          <td className="p-5 whitespace-nowrap text-center align-middle">
                            <div className="text-sm font-bold text-slate-700">{formattedDeliveryDate}</div>
                            {deliveryDateStr && new Date(deliveryDateStr) < new Date() && statusLabel.toLowerCase() !== 'delivered' && (
                              <div className="text-[0.65rem] text-orange-500 font-bold mt-1 text-center">Overdue by {Math.floor((new Date().getTime() - new Date(deliveryDateStr).getTime()) / (1000 * 3600 * 24))} days</div>
                            )}
                          </td>
                          <td className="p-5 whitespace-nowrap text-center align-middle">
                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${statusBg} ${statusText}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`}></span>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="p-5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); openJobForm(a.id); }}
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-600 border border-blue-100 transition-colors shadow-sm"
                                title="Edit Job"
                              >
                                <i className="ph ph-pencil-simple text-base"></i>
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(a.id);
                                }}
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-pink-50 text-pink-500 hover:bg-pink-100 hover:text-pink-600 border border-pink-100 transition-colors shadow-sm"
                                title="Delete Job"
                              >
                                <i className="ph ph-trash text-base"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-16 text-slate-400 h-full">
                <i className="ph-fill ph-images text-5xl mb-4 text-slate-300"></i>
                <p className="font-bold text-lg text-slate-500">No pending jobs.</p>
              </div>
            )}

            {/* Pagination Controls */}
            {filteredJobs.length > 0 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 mt-auto">
                <div className="flex gap-2">
                  <button
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <i className="ph ph-caret-left font-bold"></i>
                  </button>
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg border border-pink-100 bg-pink-50 text-pink-500 font-bold shadow-sm">
                    {safeCurrentPage}
                  </div>
                  <button
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <i className="ph ph-caret-right font-bold"></i>
                  </button>
                </div>
                <div className="text-xs font-bold text-slate-500">
                  Showing {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(safeCurrentPage * ITEMS_PER_PAGE, filteredJobs.length)} of {filteredJobs.length} jobs
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Detail Panel */}
          {selectedJob && (
            <div className="w-full lg:w-[380px] bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col relative sticky top-[80px] h-[calc(100vh-100px)] overflow-y-auto hide-scrollbar">
              <button
                onClick={() => setSelectedJobId(null)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"
              >
                <i className="ph-bold ph-x text-lg"></i>
              </button>

              <h3 className="text-lg font-black text-slate-800 pr-8">{selectedJob.client?.name} – {selectedJob.category}</h3>

              {(() => {
                let cData: any = {};
                try {
                  cData = typeof selectedJob.customData === 'string' ? JSON.parse(selectedJob.customData) : (selectedJob.customData || {});
                } catch (e) { }

                let statusLabel = cData.fld_b_status || 'Pending';
                let statusColor = 'bg-slate-100 text-slate-700';
                let progress = parseInt(cData.job_progress || '0');

                if (statusLabel.toLowerCase() === 'designing') {
                  statusColor = 'bg-orange-100 text-orange-700';
                  if (progress === 0) progress = 25;
                } else if (statusLabel.toLowerCase() === 'printing') {
                  statusColor = 'bg-purple-100 text-purple-700';
                  if (progress === 0) progress = 50;
                } else if (statusLabel.toLowerCase() === 'ready for delivery') {
                  statusColor = 'bg-emerald-100 text-emerald-700';
                  if (progress === 0) progress = 75;
                } else if (statusLabel.toLowerCase() === 'delivered') {
                  statusColor = 'bg-blue-100 text-blue-700';
                  if (progress === 0) progress = 100;
                }

                const bDate = selectedJob.date instanceof Date ? selectedJob.date.toISOString().split('T')[0] : selectedJob.date?.split('T')[0];
                const formattedOrderDate = bDate ? new Date(bDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

                const designerId = cData.designer;
                const designerUser = teamUsers.find(u => u.id === designerId);
                const designer = designerUser ? designerUser.name : (designerId || 'Unassigned');
                const deliveryDateStr = cData.job_delivery_date || cData.delivery_date;
                const formattedDeliveryDate = deliveryDateStr ? new Date(deliveryDateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set';

                return (
                  <>
                    <div className="mt-3">
                      <span className={`px-2.5 py-1 rounded-md text-[0.7rem] font-bold ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className="mt-8 space-y-4">
                      <div className="grid grid-cols-[110px_1fr] text-[0.85rem] items-center">
                        <div className="text-slate-500 font-medium">Job ID</div>
                        <div className="font-black text-slate-800 flex items-center gap-2"><span className="text-slate-400 font-normal">:</span> {selectedJob.jobNumber || `BK-${selectedJob.id.substring(selectedJob.id.length - 4).toUpperCase()}`}</div>
                      </div>
                      <div className="grid grid-cols-[110px_1fr] text-[0.85rem] items-center">
                        <div className="text-slate-500 font-medium">Order Date</div>
                        <div className="font-black text-slate-800 flex items-center gap-2"><span className="text-slate-400 font-normal">:</span> {formattedOrderDate}</div>
                      </div>
                      <div className="grid grid-cols-[110px_1fr] text-[0.85rem] items-center">
                        <div className="text-slate-500 font-medium">Designer</div>
                        <div className="font-black text-slate-800 flex items-center gap-2">
                          <span className="text-slate-400 font-normal">:</span>
                          <CustomDropdown
                            options={[{ label: "Unassigned", value: "" }, ...teamUsers.map(u => ({ label: u.name, value: u.id }))]}
                            value={designerId || ""}
                            onChange={(val) => handleUpdateJob(selectedJob.id, { customData: { designer: val } })}
                            className="w-40 border-b border-dashed border-slate-300 rounded-none shadow-none bg-transparent"
                            placeholder="Unassigned"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-[110px_1fr] text-[0.85rem] items-center">
                        <div className="text-slate-500 font-medium">Delivery Date</div>
                        <div className="font-black text-slate-800 flex items-center gap-2">
                          <span className="text-slate-400 font-normal">:</span>
                          <DatePickerInput
                            value={deliveryDateStr ? new Date(deliveryDateStr).toISOString().split('T')[0] : ""}
                            onChange={(val) => handleUpdateJob(selectedJob.id, { customData: { job_delivery_date: val } })}
                            className="flex items-center justify-between bg-white text-[0.8rem] border border-slate-200 rounded-lg px-3 py-1.5 outline-none hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer w-[140px] h-[34px]"
                          />
                          {deliveryDateStr && new Date(deliveryDateStr) < new Date() && statusLabel.toLowerCase() !== 'delivered' && (
                            <span className="text-orange-500 font-bold ml-1">(Overdue)</span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-[110px_1fr] text-[0.85rem] items-center">
                        <div className="text-slate-500 font-medium">Job Size</div>
                        <div className="font-black text-slate-800 flex items-center gap-2"><span className="text-slate-400 font-normal">:</span> {cData.job_size || 'Not specified'}</div>
                      </div>
                      <div className="grid grid-cols-[110px_1fr] text-[0.85rem] items-center">
                        <div className="text-slate-500 font-medium">Pages</div>
                        <div className="font-black text-slate-800 flex items-center gap-2"><span className="text-slate-400 font-normal">:</span> {cData.job_pages || 'Not specified'}</div>
                      </div>
                      <div className="grid grid-cols-[110px_1fr] text-[0.85rem] items-center">
                        <div className="text-slate-500 font-medium">Job Type</div>
                        <div className="font-black text-slate-800 flex items-center gap-2"><span className="text-slate-400 font-normal">:</span> {cData.fld_b_job_type || cData.job_type || 'Premium'}</div>
                      </div>
                      <div className="grid grid-cols-[110px_1fr] text-[0.85rem] items-start">
                        <div className="text-slate-500 font-medium">Remarks</div>
                        <div className="font-black text-slate-800 flex items-center gap-2"><span className="text-slate-400 font-normal">:</span> {cData.job_remarks || 'Designing in progress'}</div>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 relative">
                      <h4 className="font-black text-slate-800 text-sm mb-6">Timeline</h4>

                      <div className="relative pl-6 space-y-7">
                        <div className="absolute left-[7px] top-[8px] bottom-[15px] w-[2px] bg-slate-100"></div>

                        <div className="relative">
                          <div className="absolute -left-[1.65rem] w-4 h-4 rounded-full bg-emerald-500 border-[3px] border-white flex items-center justify-center shadow-sm">
                            <i className="ph-bold ph-check text-white text-[0.45rem]"></i>
                          </div>
                          <div className="flex justify-between items-start -mt-0.5">
                            <div className="font-black text-slate-800 text-[0.8rem]">Pending</div>
                            <div className="text-[0.7rem] text-slate-400 font-medium">{formattedOrderDate}</div>
                          </div>
                        </div>

                        <div className="relative">
                          <div className={`absolute -left-[1.65rem] w-4 h-4 rounded-full border-[3px] border-white flex items-center justify-center shadow-sm ${progress >= 25 ? 'bg-white border-orange-400' : 'bg-slate-200'}`}>
                            {progress >= 25 && <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>}
                          </div>
                          <div className="flex justify-between items-start -mt-0.5">
                            <div className={`font-black text-[0.8rem] ${progress >= 25 ? 'text-slate-800' : 'text-slate-400'}`}>Designing</div>
                            <div className="text-[0.7rem] text-slate-400 font-medium">{progress >= 25 ? 'Started' : 'Pending'}</div>
                          </div>
                        </div>

                        <div className="relative">
                          <div className={`absolute -left-[1.65rem] w-4 h-4 rounded-full border-[3px] border-white flex items-center justify-center shadow-sm ${progress >= 50 ? 'bg-white border-purple-400' : 'bg-slate-200'}`}>
                            {progress >= 50 && <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>}
                          </div>
                          <div className="flex justify-between items-start -mt-0.5">
                            <div className={`font-black text-[0.8rem] ${progress >= 50 ? 'text-slate-800' : 'text-slate-400'}`}>Printing</div>
                            <div className="text-[0.7rem] text-slate-400 font-medium">{progress >= 50 ? 'Sent' : 'Pending'}</div>
                          </div>
                        </div>

                        <div className="relative">
                          <div className={`absolute -left-[1.65rem] w-4 h-4 rounded-full border-[3px] border-white flex items-center justify-center shadow-sm ${progress >= 75 ? 'bg-emerald-500' : 'bg-white border-slate-200'}`}>
                            {progress >= 75 && <i className="ph-bold ph-check text-white text-[0.45rem]"></i>}
                          </div>
                          <div className="flex justify-between items-start -mt-0.5">
                            <div className={`font-black text-[0.8rem] ${progress >= 75 ? 'text-slate-800' : 'text-slate-400'}`}>Ready for Delivery</div>
                            <div className="text-[0.7rem] text-slate-400 font-medium">{progress >= 75 ? 'Ready' : 'Pending'}</div>
                          </div>
                        </div>

                        <div className="relative">
                          <div className={`absolute -left-[1.65rem] w-4 h-4 rounded-full border-[3px] border-white flex items-center justify-center shadow-sm ${statusLabel.toLowerCase() === 'delivered' ? 'bg-blue-500' : 'bg-white border-slate-200'}`}>
                            {statusLabel.toLowerCase() === 'delivered' && <i className="ph-bold ph-check text-white text-[0.45rem]"></i>}
                          </div>
                          <div className="flex justify-between items-start -mt-0.5">
                            <div className={`font-black text-[0.8rem] ${statusLabel.toLowerCase() === 'delivered' ? 'text-slate-800' : 'text-slate-400'}`}>Delivered</div>
                            <div className="text-[0.7rem] text-slate-400 font-medium">{statusLabel.toLowerCase() === 'delivered' ? 'Delivered' : 'Pending'}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 border-t border-slate-100 pt-6">
                      <h4 className="font-black text-slate-800 text-sm mb-4">Quick Actions</h4>
                      <div className="flex items-center gap-3">
                        <button className="flex-1 py-2.5 rounded-xl border border-purple-200 text-purple-700 font-bold text-xs hover:bg-purple-50 flex items-center justify-center gap-2 transition-colors">
                          <i className="ph-bold ph-upload-simple"></i> Upload Draft
                        </button>
                        <button
                          onClick={() => {
                            if (selectedJobId) openJobDetails(selectedJobId);
                          }}
                          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
                        >
                          <i className="ph-bold ph-eye"></i> View Details
                        </button>
                      </div>
                      <button
                        onClick={() => handleUpdateJob(selectedJob.id, { status: 'Delivered', customData: { fld_b_status: 'Delivered', job_progress: '100' } })}
                        className="w-full mt-3 py-3 rounded-xl bg-purple-700 text-white font-bold text-sm hover:bg-purple-800 flex items-center justify-center gap-2 shadow-md transition-colors"
                      >
                        <i className="ph-bold ph-check-circle"></i> Mark as Completed
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

        </div>
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[340px] overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="p-8 pb-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-100 to-red-50 border border-red-100/50 flex items-center justify-center mb-5 shadow-inner">
                <i className="ph-fill ph-trash text-red-600 text-3xl"></i>
              </div>
              <h3 className="text-xl font-extrabold text-slate-800 mb-2.5 tracking-tight">Move to Bin?</h3>
              <p className="text-[0.9rem] text-slate-500 leading-relaxed">
                This job will be moved to the bin. You can always restore it later if needed.
              </p>
            </div>
            <div className="px-8 pb-8 flex flex-col gap-3 mt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await deleteJobAction(deleteConfirmId);
                    globalMutate(key => typeof key === 'string' && key.startsWith('/api/jobs'));
                    setDeleteConfirmId(null);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="w-full py-3.5 text-[0.95rem] font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-lg shadow-red-600/25 disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Moving...
                  </>
                ) : 'Move to Bin'}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmId(null)}
                className="w-full py-3.5 text-[0.95rem] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 bg-white border-2 border-slate-100 rounded-xl transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
