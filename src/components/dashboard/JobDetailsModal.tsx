"use client";

import { format } from "date-fns";
import { invalidateJobs } from "@/lib/swr";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { deleteJobAction, updateJobStatusAction, updateJobTrackingAction, generateInvoiceAction } from "@/app/actions";
import { toast } from "sonner";
import { useGlobalForm } from "@/components/providers/GlobalFormProvider";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Trash2, Receipt, FileText, Upload, Wallet,
  Clock, MapPin, Tag, UserCircle, Calendar, Link as LinkIcon, Phone, Mail, Info,
  Camera, Image as ImageIcon, LayoutList, Users, FolderOpen, Package,
  BookOpen, Maximize, Images, Activity, Edit3,
  ArrowLeft,
  Printer,
  IndianRupee
} from "lucide-react";
import JobStatusStepper from './JobStatusStepper';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const getSectionIcon = (title: string) => {
  const t = (title || '').toLowerCase();
  if (t.includes('event')) return <Camera className="w-5 h-5 text-indigo-500" />;
  if (t.includes('album') || t.includes('deliverable') || t.includes('photo')) return <ImageIcon className="w-5 h-5 text-emerald-500" />;
  if (t.includes('payment') || t.includes('finance')) return <Wallet className="w-5 h-5 text-emerald-500" />;
  if (t.includes('client') || t.includes('contact') || t.includes('detail')) return <UserCircle className="w-5 h-5 text-blue-500" />;
  if (t.includes('team') || t.includes('crew') || t.includes('assign')) return <Users className="w-5 h-5 text-orange-500" />;
  return <LayoutList className="w-5 h-5 text-slate-500" />;
}

const getFieldIcon = (field: any) => {
  const name = (field.name || '').toLowerCase();

  let icon = <Info className="w-4 h-4" />;
  let color = "slate";

  if (name.includes('album type') || name.includes('book')) { icon = <BookOpen className="w-5 h-5" />; color = "emerald"; }
  else if (name.includes('photo') || name.includes('image') || name.includes('picture') || name.includes('pic')) { icon = <Images className="w-5 h-5" />; color = "indigo"; }
  else if (name.includes('status') || name.includes('state')) { icon = <Activity className="w-5 h-5" />; color = "orange"; }
  else if (name.includes('size') || name.includes('dimension')) { icon = <Maximize className="w-5 h-5" />; color = "blue"; }
  else if (name.includes('email') || name.includes('mail')) { icon = <Mail className="w-5 h-5" />; color = "blue"; }
  else if (name.includes('name') || name.includes('client')) { icon = <UserCircle className="w-5 h-5" />; color = "indigo"; }
  else if (name.includes('location') || name.includes('address') || name.includes('city') || name.includes('venue')) { icon = <MapPin className="w-5 h-5" />; color = "rose"; }
  else if (name.includes('note') || name.includes('remark') || name.includes('description')) { icon = <FileText className="w-5 h-5" />; color = "yellow"; }
  else if (name.includes('date')) { icon = <Calendar className="w-5 h-5" />; color = "blue"; }
  else if (name.includes('time')) { icon = <Clock className="w-5 h-5" />; color = "purple"; }
  else if (name.includes('user') || name.includes('person') || name.includes('designer') || name.includes('photographer')) { icon = <Images className="w-5 h-5" />; color = "indigo"; } // changed to Images and indigo to match screenshot
  else if (name.includes('amount') || name.includes('price') || name.includes('cost')) { icon = <Wallet className="w-5 h-5" />; color = "emerald"; }
  else if (name.includes('category')) { icon = <FolderOpen className="w-5 h-5" />; color = "violet"; }
  else if (name.includes('inclusion') || name.includes('package') || name.includes('item')) { icon = <Package className="w-5 h-5" />; color = "amber"; }
  else if (name.includes('type')) { icon = <Tag className="w-5 h-5" />; color = "rose"; }
  else if (name.includes('link') || name.includes('url')) { icon = <LinkIcon className="w-5 h-5" />; color = "blue"; }
  else if (name.includes('phone') || name.includes('contact') || name.includes('mobile')) { icon = <Phone className="w-5 h-5" />; color = "emerald"; }

  return { icon, color };
};


function getDynamicFieldValue(customData: any, fieldId: string, standardFieldName?: string) {
  if (!customData) return null;
  if (customData[fieldId]) return customData[fieldId];
  if (standardFieldName && customData[standardFieldName]) return customData[standardFieldName];
  
  for (const key of Object.keys(customData)) {
    if (key.startsWith('rep_')) {
      let arr = customData[key];
      if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch(e) {}
      }
      if (Array.isArray(arr) && arr.length > 0) {
        const firstItem = arr[0];
        if (firstItem[fieldId]) return firstItem[fieldId];
        if (standardFieldName && firstItem[standardFieldName]) return firstItem[standardFieldName];
      }
    }
  }
  return null;
}

export default function JobDetailsModal({ standaloneJobId }: { standaloneJobId?: string }) {
  const router = useRouter();
  const { checkPermission } = usePermissions();
  const canManageTransactions = checkPermission('manage_transactions');
  const canManageJobs = checkPermission('manage_jobs');
  const {
    openJobForm,
    isJobDetailsOpen,
    jobDetailsId: contextJobId,
    closeJobDetails,
    openTransactionDetails
  } = useGlobalForm();

  const jobDetailsId = standaloneJobId || contextJobId;
  const isVisible = standaloneJobId ? true : isJobDetailsOpen;

  const { data: fetchedJob, isLoading: isJobLoading, mutate: refreshJob } = useSWR(
    isVisible && jobDetailsId ? `/api/jobs/${jobDetailsId}` : null,
    fetcher
  );

  const job = jobDetailsId && fetchedJob ? {
    ...fetchedJob,
    customData: typeof fetchedJob.customData === 'string' ?
      (() => { try { return JSON.parse(fetchedJob.customData); } catch (e) { return {}; } })() :
      (fetchedJob.customData || {}),
    inclusions: typeof fetchedJob.inclusions === 'string' ?
      (() => { try { return JSON.parse(fetchedJob.inclusions); } catch (e) { return []; } })() :
      (fetchedJob.inclusions || []),
  } : null;

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isAlbumStatusDropdownOpen, setIsAlbumStatusDropdownOpen] = useState(false);
  const { data: layoutRes } = useSWR(isVisible ? "/api/settings/layouts/JOB_FORM" : null, fetcher);
  const { data: usersRes } = useSWR(isVisible ? "/api/users" : null, fetcher);

  const layoutSchema: any = layoutRes?.schema ?? null;
  const teamUsers: any[] = usersRes ? (Array.isArray(usersRes) ? usersRes : (usersRes.data || [])) : [];

  const standardFieldMap: Record<string, string> = {
    fld_b_client: 'title', fld_b_phone: 'phone', fld_b_email: 'email',
    fld_b_date: 'date', fld_b_time: 'time', fld_b_category: 'category', fld_b_job_category: 'category',
    fld_b_location: 'location', fld_b_status: 'status', fld_b_package: 'package', fld_b_advance: 'advance',
    fld_gallery_delivered: 'galleryDelivered'
  };

  const statusField = layoutSchema?.sections?.flatMap((s: any) => s.fields).find((f: any) => f.id === 'fld_b_status') || layoutSchema?.sections?.flatMap((s: any) => s.fields).find((f: any) => f.type === 'STATUS_PICKER');
  const isStatusPicker = statusField?.type === 'STATUS_PICKER';
  const statusOptions = isStatusPicker ? (statusField.statusOptions || []) : [];

  const albumStatusField = layoutSchema?.sections?.flatMap((s: any) => s.fields).find((f: any) => f.id === 'fld_b_album_status');
  const isAlbumStatusPicker = albumStatusField?.type === 'STATUS_PICKER';
  const albumStatusOptions = isAlbumStatusPicker ? (albumStatusField.statusOptions || []) : [];

  const currentOpt = isStatusPicker ? statusOptions.find((o: any) => o.label === job?.status) : null;

  const changeStatus = async (newStatus: string) => {
    if (!job) return;
    setIsUpdatingStatus(true);

    let res;
    const s = newStatus.toLowerCase();
    if (['designing', 'printing', 'ready for delivery', 'delivered'].includes(s)) {
      res = await updateJobTrackingAction(job.id, { customData: { fld_b_job_status: newStatus }, status: newStatus });
    } else {
      res = await updateJobStatusAction(job.id, newStatus);
    }

    setIsUpdatingStatus(false);
    if (res.success) {
      toast.success(`Status updated to ${newStatus}`);
      setIsStatusDropdownOpen(false);
      refreshJob();

      // Globally invalidate SWR keys so Jobs list, Calendar, Dashboard, and Album Status sync instantly
      invalidateJobs();
      router.refresh();
    } else {
      toast.error("Failed to update status");
    }
  };

  const changeSectionStatus = async (fieldId: string, newStatus: string) => {
    if (!job) return;
    if (fieldId === 'fld_b_status') {
      return changeStatus(newStatus);
    }

    setIsUpdatingStatus(true);
    const updates: any = { customData: { [fieldId]: newStatus } };
    if (fieldId === 'fld_b_job_status') {
      updates.status = newStatus;
    }
    const res = await updateJobTrackingAction(job.id, updates);
    setIsUpdatingStatus(false);

    if (res.success) {
      toast.success(`Status updated to ${newStatus}`);
      refreshJob();
      invalidateJobs();
      router.refresh();
    } else {
      toast.error("Failed to update status");
    }
  };

  const confirmDelete = async () => {
    if (job) {
      setIsDeleting(true);
      try {
        const res = await deleteJobAction(job.id);
        if (res.success) {
          toast.success("Job deleted successfully!");
          setIsDeleteConfirmOpen(false);
          closeJobDetails();

          invalidateJobs();
          router.refresh();
        } else {
          toast.error("Failed to delete job.");
        }
      } catch (error) {
        toast.error('Failed to delete job');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const generateInvoice = async () => {
    if (!job) return;
    setIsGeneratingInvoice(true);
    try {
      const res = await generateInvoiceAction(job.id);
      if (!res.success) {
        toast.error(res.error || "Failed to generate invoice");
        return;
      }
      toast.success("Invoice generated successfully!");
      window.open(`/api/invoices/${res.invoiceId}/pdf`, "_blank");
    } catch (error) {
      toast.error("Failed to generate invoice");
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const exportJob = async () => {
    setIsExporting(true);
    try {
      const element = document.getElementById('job-details-content');
      if (!element) return;
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.height > canvas.width ? 'p' : 'l',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Job_Export_${job.jobNumber || job.id.slice(-6).toUpperCase()}.pdf`);
      toast.success("Job exported successfully!");
    } catch (error) {
      toast.error("Failed to export job");
    } finally {
      setIsExporting(false);
    }
  };

  const isFieldVisibleForRender = (rule: any) => {
    if (!rule) return true;
    const dependsOnKey = rule.dependsOn || rule.fieldId;
    if (!dependsOnKey) return true;
    const depFieldName = standardFieldMap[dependsOnKey] || dependsOnKey;
    const standardDepVal = (job as any)[depFieldName];
    const depVal = (standardDepVal !== undefined && standardDepVal !== null && standardDepVal !== '')
      ? standardDepVal
      : job.customData?.[depFieldName] || job.customData?.[dependsOnKey];

    const ruleValues: string[] = rule.values || (rule.value ? [rule.value] : []);
    if (rule.operator === 'EQUALS') return ruleValues.includes(depVal as string);
    else if (rule.operator === 'NOT_EQUALS') return !ruleValues.includes(depVal as string);
    else if (rule.operator === 'CONTAINS') {
      if (typeof depVal === 'string' || Array.isArray(depVal)) return ruleValues.some(v => depVal.includes(v));
      return false;
    }
    if (rule.dependsOn && Array.isArray(rule.values) && !rule.operator) return rule.values.includes(depVal);
    return true;
  };

  const getDynamicFieldId = (names: string[]) => {
    if (!layoutSchema || !layoutSchema.sections) return null;
    for (const section of layoutSchema.sections) {
      if (!section.fields) continue;
      const field = section.fields.find((f: any) => names.includes((f.name || '').toLowerCase()));
      if (field) return field.id;
    }
    return null;
  };

  const albumDesignerId = getDynamicFieldId(['operator', 'assigned operator', 'designer']);
  const albumDesignerVal = albumDesignerId ? job?.customData?.[albumDesignerId] : null;

  const focusAmountFieldId = (() => {
    if (!layoutSchema || !layoutSchema.sections) return null;
    const focusSection = layoutSchema.sections.find((s: any) => s.title?.toLowerCase() === 'focus');
    if (!focusSection || !focusSection.fields) return null;
    const amountField = focusSection.fields.find((f: any) => (f.name || '').toLowerCase() === 'amount');
    return amountField ? amountField.id : null;
  })();
  const focusAmountVal = focusAmountFieldId && job?.customData ? job.customData[focusAmountFieldId] : null;

  const handleClose = () => {
    if (standaloneJobId) {
      router.back();
    } else {
      closeJobDetails();
    }
  };

  let sizeVal = job?.customData?.size || job?.customData?.fld_print_size;
  let qtyVal = job?.customData?.qty || job?.customData?.quantity || job?.customData?.fld_print_quantity;
  let dueDateVal = job?.customData?.due_date || job?.customData?.dueDate || job?.customData?.fld_b_due_date || job?.customData?.job_delivery_date || job?.customData?.delivery_date;
  let categoryVal = job?.category || job?.customData?.category || job?.customData?.fld_b_job_category;

  if (layoutSchema?.sections && job) {
    const allFields = layoutSchema.sections.flatMap((s: any) => s.fields || []);
    
    const catField = allFields.find((f: any) => (f.name || '').toLowerCase().includes('category'));
    if (catField) {
      categoryVal = getDynamicFieldValue(job.customData, catField.id, standardFieldMap[catField.id]) || categoryVal;
    }

    if (!sizeVal) {
      const sizeField = allFields.find((f: any) => f.name?.toLowerCase().includes('size'));
      if (sizeField) sizeVal = getDynamicFieldValue(job.customData, sizeField.id, standardFieldMap[sizeField.id]);
    }
    
    if (!qtyVal) {
      const qtyField = allFields.find((f: any) => f.name?.toLowerCase() === 'qty' || f.name?.toLowerCase() === 'quantity');
      if (qtyField) qtyVal = getDynamicFieldValue(job.customData, qtyField.id, standardFieldMap[qtyField.id]);
    }
    
    if (!dueDateVal) {
      const dueDateField = allFields.find((f: any) => f.name?.toLowerCase().includes('due date') || f.name?.toLowerCase().includes('delivery date'));
      if (dueDateField) dueDateVal = getDynamicFieldValue(job.customData, dueDateField.id, standardFieldMap[dueDateField.id]);
    }
  }

  let displayCategory = "N/A";
  if (categoryVal) {
    if (Array.isArray(categoryVal)) {
      displayCategory = categoryVal.join(", ");
    } else if (typeof categoryVal === 'string') {
      try {
        const parsed = JSON.parse(categoryVal);
        if (Array.isArray(parsed)) displayCategory = parsed.join(", ");
        else displayCategory = categoryVal;
      } catch (e) {
        displayCategory = categoryVal;
      }
    } else {
      displayCategory = String(categoryVal);
    }
  }

  // Also fetch categories from repeatable line items
  if (layoutSchema?.sections && job) {
    const jdSec = layoutSchema.sections.find((s: any) => s.title?.toLowerCase() === 'job details' || s.title?.toLowerCase() === 'job information');
    if (jdSec && jdSec.isRepeatable) {
      let repData = job.customData?.['rep_' + jdSec.id];
      if (typeof repData === 'string') {
        try { repData = JSON.parse(repData); } catch(e) { repData = []; }
      }
      if (Array.isArray(repData)) {
        const catField = jdSec.fields?.find((f: any) => (f.name || '').toLowerCase().includes('category') || (f.name || '').toLowerCase().includes('type'));
        if (catField) {
          const categories = repData.map((item: any) => item[catField.id] || item[standardFieldMap[catField.id]]).filter(c => c);
          if (categories.length > 0) {
            displayCategory = Array.from(new Set(categories)).join(', ');
          }
        }
      }
    }
  }

  const content = (
    <div className={`w-full bg-[#fcfcfc] flex flex-col overflow-hidden relative ${standaloneJobId ? 'h-full min-h-screen' : 'h-[100dvh] sm:h-[90dvh] max-h-[100dvh] sm:max-h-[90dvh] rounded-none sm:rounded-[2rem] shadow-2xl'}`}>
      {(!job) ? (
        <div className="flex-1 flex flex-col items-center justify-center p-20 min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mb-4" />
          <p className="text-slate-500 font-medium">Loading job details...</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
          
          {/* Header */}
          <header className="shrink-0 sticky top-0 z-40 bg-[#fcfcfc] px-6 md:px-8 py-4 border-b border-slate-100 flex flex-col gap-4">
             {/* Back Button */}
             <div className="flex justify-between items-center w-full">
                <button 
                  onClick={handleClose} 
                  className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors bg-white shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Jobs
                </button>
             </div>
             
             {/* Title & Actions Row */}
             <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
               <div>
                 <h1 className="text-2xl font-black text-slate-900 tracking-tight">Job Details</h1>
                 <p className="text-sm text-slate-500 font-medium">View complete information about this print job.</p>
               </div>
               
               <div className="flex items-center gap-3 flex-wrap">
                  {/* Status Badge */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-100 rounded-lg text-sm font-bold">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span> {job.status || "Pending"}
                  </div>
                  
                  {/* Edit Job */}
                  {canManageJobs && <button onClick={() => { openJobForm(job.id, undefined); closeJobDetails(); }} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors bg-white shadow-sm">
                    <Edit3 className="w-4 h-4" /> Edit Job
                  </button>}
                  
                  {/* Print Summary */}
                  <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors bg-white shadow-sm">
                    <Printer className="w-4 h-4" /> Print Summary
                  </button>

                  {/* Vertical Divider */}
                  <div className="hidden md:block w-px h-6 bg-slate-200 mx-1"></div>

                  {/* Legacy Actions (Delete, Export, Invoice) */}
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                    {canManageJobs && (
                      <button onClick={() => setIsDeleteConfirmOpen(true)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete" aria-label="Delete job">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={exportJob} disabled={isExporting} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors" title="Export" aria-label="Export job">
                      <Upload className="w-4 h-4" />
                    </button>
                    {canManageTransactions && (
                      <button onClick={generateInvoice} disabled={isGeneratingInvoice} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors" title="Invoice" aria-label="Generate invoice">
                        <Receipt className="w-4 h-4" />
                      </button>
                    )}
                  </div>
               </div>
             </div>
          </header>

          <main id="job-details-content" className="flex-1 overflow-y-auto px-6 md:px-8 pb-10 pt-6 flex flex-col gap-6">
            
            {/* Top Summary Strip */}
            <div className="w-full bg-white rounded-xl p-6 border border-slate-100 flex flex-col md:flex-row items-center divide-y md:divide-y-0 md:divide-x divide-slate-100 shadow-sm">
              <div className="flex-1 flex flex-col gap-1 w-full md:w-auto p-4 md:p-0 md:px-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">JOB ID</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-fuchsia-50 border border-fuchsia-100 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-fuchsia-600" />
                  </div>
                  <p className="text-lg font-bold text-fuchsia-600">{job.jobNumber || `#${job.id.slice(-6).toUpperCase()}`}</p>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col gap-2 w-full md:w-auto p-4 md:p-0 md:px-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CATEGORY</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-800">{displayCategory && displayCategory !== 'N/A' && displayCategory !== '-' ? displayCategory : 'Not specified'}</p>
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-2 w-full md:w-auto p-4 md:p-0 md:px-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CREATED ON</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-bold text-slate-800">{format(new Date(job.createdAt), "dd MMM yyyy, hh:mm a")}</p>
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-2 w-full md:w-auto p-4 md:p-0 md:px-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DUE DATE</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-bold text-slate-800">{dueDateVal ? format(new Date(dueDateVal), "dd MMM yyyy") : "Not set"}</p>
                </div>
              </div>
            </div>

            {(() => {
              const totalAmount = Number(job.order?.package || job.customData?.fld_b_package || 0);
              const advanceAmount = Number(job.order?.advance || job.customData?.fld_b_advance || 0);
              const dueAmount = totalAmount - advanceAmount;
              const paymentMethod = job.customData?.paymentMode || job.customData?.fld_b_payment_mode || "Cash";

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                   {/* LEFT COLUMN */}
                   <div className="flex flex-col gap-6">
                     
                     {/* Client Information */}
                     <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm flex flex-col gap-5">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                           <UserCircle className="w-4 h-4 text-indigo-500" />
                         </div>
                         <h3 className="font-bold text-slate-800 text-[15px]">Client Information</h3>
                       </div>
                       <div className="flex flex-col gap-0 divide-y divide-slate-50">
                         <div className="flex justify-between items-center py-3">
                           <span className="text-sm text-slate-500 font-medium">Client Name / Company</span>
                           <span className="text-sm font-bold text-slate-800 text-right">{job.client?.name || job.title || job.customData?.fld_b_client || "N/A"}</span>
                         </div>
                         <div className="flex justify-between items-center py-3">
                           <span className="text-sm text-slate-500 font-medium">Phone Number</span>
                           <span className="text-sm font-bold text-slate-800 text-right">{job.client?.phone || job.phone || job.customData?.fld_b_phone || "N/A"}</span>
                         </div>
                         <div className="flex justify-between items-center py-3">
                           <span className="text-sm text-slate-500 font-medium">Email Address</span>
                           <span className="text-sm font-bold text-slate-800 text-right">{job.client?.email || job.email || job.customData?.fld_b_email || "N/A"}</span>
                         </div>
                       </div>
                     </div>

                     {/* Financials */}
                     <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm flex flex-col gap-5">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                           <IndianRupee className="w-4 h-4 text-green-600" />
                         </div>
                         <h3 className="font-bold text-slate-800 text-[15px]">Financials</h3>
                       </div>
                       <div className="flex flex-col gap-0 divide-y divide-slate-50">
                         <div className="flex justify-between items-center py-3">
                           <span className="text-sm text-slate-500 font-medium">Total Amount (₹)</span>
                           <span className="text-sm font-bold text-slate-800 text-right">₹ {totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                         </div>
                         <div className="flex justify-between items-center py-3">
                            <span className="text-sm text-slate-500 font-medium flex items-center gap-2">
                              Advance Paid (₹)
                              {paymentMethod && paymentMethod !== "N/A" && (
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{paymentMethod}</span>
                              )}
                            </span>
                            <span className="text-sm font-bold text-slate-800 text-right">₹ {advanceAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          </div>
                         <div className="flex justify-between items-center pt-3 pb-1 mt-2">
                           <span className="text-sm text-slate-800 font-bold">Outstanding Balance</span>
                           <span className="text-sm font-bold text-green-700 bg-green-50 border border-green-100 px-3 py-1 rounded-md text-right">₹ {dueAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                         </div>
                       </div>
                     </div>

                   </div>

                   {/* RIGHT COLUMN */}
                   <div className="flex flex-col gap-6">
                     
                     {/* Job Details */}
                     <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm flex flex-col gap-5">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                           <FileText className="w-4 h-4 text-blue-500" />
                         </div>
                         <h3 className="font-bold text-slate-800 text-[15px]">Job Details</h3>
                       </div>
                       <div className="flex flex-col gap-0 divide-y divide-slate-50">
                          {(() => {
                             let entries = [job.customData];
                             const jdSec = layoutSchema?.sections?.find((s: any) => s.title?.toLowerCase() === 'job details' || s.title?.toLowerCase() === 'job information');
                             
                             const financialRatesRaw = job?.customData?.fld_financial_rates;
                             let financialRates: any = {};
                             if (typeof financialRatesRaw === 'string') {
                               try { financialRates = JSON.parse(financialRatesRaw); } catch(e) {}
                             } else if (financialRatesRaw && typeof financialRatesRaw === 'object') {
                               financialRates = financialRatesRaw;
                             }

                             if (jdSec && jdSec.isRepeatable) {
                               const repData = job.customData?.['rep_' + jdSec.id];
                               if (typeof repData === 'string') {
                                 try { entries = JSON.parse(repData); } catch(e) { entries = []; }
                               } else if (Array.isArray(repData)) {
                                 entries = repData;
                               } else {
                                 entries = [];
                               }
                             }
                             if (!entries || entries.length === 0) entries = [job.customData];

                             return entries.map((entry: any, index: number) => {
                               let sVal = entry?.size || entry?.fld_print_size;
                               let qVal = entry?.qty || entry?.quantity || entry?.fld_print_quantity;
                               let rVal = entry?.rate || entry?.fld_rate || entry?.price;
                               let cVal = entry?.category || entry?.job_type;

                               if (jdSec) {
                                 const allF = jdSec.fields || [];
                                 if (!sVal) {
                                   const sF = allF.find((f: any) => f.name?.toLowerCase().includes('size'));
                                   if (sF) sVal = entry?.[sF.id] || entry?.[standardFieldMap[sF.id]];
                                 }
                                 if (!qVal) {
                                   const qF = allF.find((f: any) => f.name?.toLowerCase() === 'qty' || f.name?.toLowerCase() === 'quantity');
                                   if (qF) qVal = entry?.[qF.id] || entry?.[standardFieldMap[qF.id]];
                                 }
                                 if (!rVal) {
                                   const rF = allF.find((f: any) => f.name?.toLowerCase().includes('rate') || f.name?.toLowerCase().includes('price'));
                                   if (rF) rVal = entry?.[rF.id] || entry?.[standardFieldMap[rF.id]];
                                 }
                                 if (!cVal) {
                                   const cF = allF.find((f: any) => f.name?.toLowerCase().includes('category') || f.name?.toLowerCase().includes('type'));
                                   if (cF) cVal = entry?.[cF.id] || entry?.[standardFieldMap[cF.id]];
                                 }
                               }

                               if (!rVal && jdSec && jdSec.isRepeatable) {
                                 const rateKey = `rep_${jdSec.id}_${index}`;
                                 if (financialRates[rateKey]) {
                                   rVal = financialRates[rateKey];
                                 }
                               }

                               if (!sVal) sVal = sizeVal;
                               if (!qVal) qVal = qtyVal;
                               if (!rVal) rVal = "N/A";
                               if (!cVal) cVal = displayCategory && displayCategory !== 'N/A' ? displayCategory : undefined;

                               const hasValidRate = rVal !== "N/A" && !isNaN(parseFloat(String(rVal)));
                               const tVal = hasValidRate ? ((parseFloat(String(rVal)) || 0) * (parseFloat(String(qVal)) || 1)) : "N/A";

                               return (
                                 <div key={index} className={`flex flex-col gap-0 divide-y divide-slate-50 ${index > 0 ? 'mt-3 pt-3 border-t border-slate-100' : ''}`}>
                                   {entries.length > 1 && <div className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider py-2">Item {index + 1}</div>}
                                   
                                   {cVal && (
                                     <div className="flex justify-between items-center py-3">
                                       <span className="text-sm text-slate-500 font-medium">Category</span>
                                       <span className="text-sm font-bold text-slate-800 text-right">{cVal}</span>
                                     </div>
                                   )}
                                   <div className="flex justify-between items-center py-3">
                                     <span className="text-sm text-slate-500 font-medium">Size</span>
                                     <span className="text-sm font-bold text-slate-800 text-right">{sVal || "N/A"}</span>
                                   </div>
                                   <div className="flex justify-between items-center py-3">
                                     <span className="text-sm text-slate-500 font-medium">Quantity</span>
                                     <span className="text-sm font-bold text-slate-800 text-right">{qVal || "N/A"}</span>
                                   </div>
                                   <div className="flex justify-between items-center py-3">
                                     <span className="text-sm text-slate-500 font-medium">Rate</span>
                                     <span className="text-sm font-bold text-slate-800 text-right">{String(rVal).startsWith('₹') || rVal === 'N/A' ? rVal : `₹ ${parseFloat(String(rVal)).toLocaleString('en-IN')}`}</span>
                                   </div>
                                   {tVal !== "N/A" && (
                                      <div className="flex justify-between items-center py-3 bg-slate-50/50 -mx-4 px-4 rounded-b-lg mt-1 border-t border-slate-100">
                                        <span className="text-sm text-slate-600 font-bold">Total</span>
                                        <span className="text-sm font-bold text-slate-900 text-right">₹ {tVal.toLocaleString('en-IN')}</span>
                                      </div>
                                    )}
                                 </div>
                               );
                             });
                          })()}
                       </div>
                     </div>
                     
                     {/* Payment Details card removed as per request */}
                   </div>
                   
                   {/* Dynamic Content Mapping (Sections not covered above) */}
                   {layoutSchema?.sections?.filter((s: any) => s.title?.toLowerCase() !== 'financials' && s.title?.toLowerCase() !== 'financial' && s.title?.toLowerCase() !== 'job information' && s.title?.toLowerCase() !== 'job info' && s.title?.toLowerCase() !== 'job details' && s.title?.toLowerCase() !== 'focus')
                    .map((section: any) => {
                      const visibleFields = section.fields?.filter((f: any) => {
                        const fname = (f.name || '').toLowerCase();
                        if (f.id === 'fld_b_client' || f.id === 'fld_b_phone' || f.id === 'fld_b_email') return false;
                        if (fname.includes('attachment') || f.type === 'FILE' || f.type === 'ATTACHMENT') return false;
                        if (['status', 'date', 'order date', 'start time', 'time', 'category', 'location', 'focus', 'due date', 'job category'].includes(fname)) return false;
                        return true;
                      }) || [];

                      if (visibleFields.length === 0) return null;
                      
                      let entries = [job.customData];
                      if (section.isRepeatable) {
                        const repData = job.customData?.['rep_' + section.id];
                        if (typeof repData === 'string') {
                          try { entries = JSON.parse(repData); } catch(e) { entries = []; }
                        } else if (Array.isArray(repData)) {
                          entries = repData;
                        } else {
                          entries = [];
                        }
                      }
                      
                      if (!entries || entries.length === 0) return null;

                      const globalFields = section.isRepeatable ? visibleFields.filter((f: any) => f.isRepeatableField === false) : visibleFields;
                      const itemFields = section.isRepeatable ? visibleFields.filter((f: any) => f.isRepeatableField !== false) : [];

                      return (
                        <div key={section.id} className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm flex flex-col gap-5 col-span-1 lg:col-span-2">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                               {getSectionIcon(section.title)}
                             </div>
                             <h3 className="font-bold text-slate-800 text-[15px]">{section.title}</h3>
                           </div>

                           {/* Render Global Fields */}
                           {globalFields.length > 0 && (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-50 border-t border-slate-50 pt-2">
                               {globalFields.map((field: any) => {
                                 const standardKey = standardFieldMap[field.id];
                                 let val = standardKey ? (job as any)[standardKey] : job.customData?.[field.id];
                                 if (val === undefined || val === null || val === '') val = "N/A";
                                 
                                 return (
                                   <div key={field.id} className="flex justify-between items-center py-3 md:px-4">
                                     <span className="text-sm text-slate-500 font-medium">{field.name}</span>
                                     <span className="text-sm font-bold text-slate-800 text-right break-words max-w-[50%]">{val}</span>
                                   </div>
                                 );
                               })}
                             </div>
                           )}
                           
                           {/* Render Repeatable Items */}
                           {itemFields.length > 0 && entries.map((entry: any, index: number) => (
                             <div key={index} className={`grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-50 border-t border-slate-50 pt-2 ${index > 0 ? 'mt-4 border-t-2 border-slate-100' : ''}`}>
                               {itemFields.map((field: any) => {
                                 const standardKey = standardFieldMap[field.id];
                                 let val = standardKey ? (job as any)[standardKey] : entry?.[field.id];
                                 if (val === undefined || val === null || val === '') val = "N/A";
                                 
                                 return (
                                   <div key={field.id} className="flex justify-between items-center py-3 md:px-4">
                                     <span className="text-sm text-slate-500 font-medium">{field.name}</span>
                                     <span className="text-sm font-bold text-slate-800 text-right break-words max-w-[50%]">{val}</span>
                                   </div>
                                 );
                               })}
                             </div>
                           ))}
                        </div>
                      )
                    })
                   }
                </div>
              );
            })()}

            {/* Bottom: Job Status & Timeline */}
            <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm mt-4">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-pink-500" />
                </div>
                <h3 className="font-bold text-slate-800 text-[15px]">Job Status & Timeline</h3>
              </div>
              <div className="px-4 pb-2">
                {(() => {
                   let dynamicSteps = [
                     { label: "Pending", value: "Pending", icon: "ph-fill ph-clock", color: "text-red-500" },
                     { label: "Designing", value: "Designing", icon: "ph-fill ph-paint-brush-broad" },
                     { label: "Printing in Progress", value: "Sent for printing", icon: "ph-fill ph-printer" },
                     { label: "Ready for Delivery", value: "Ready for delivery", icon: "ph-fill ph-package" }
                   ];

                   if (layoutSchema?.sections) {
                     const statusF = layoutSchema.sections.flatMap((s: any) => s.fields || []).find((f: any) => f.type === 'STATUS_PICKER');
                     if (statusF && statusF.statusOptions && statusF.statusOptions.length > 0) {
                       dynamicSteps = statusF.statusOptions.map((opt: any, index: number) => {
                         // Attempt to map known statuses to icons/colors, or provide generic ones
                         const lower = opt.label.toLowerCase();
                         let icon = "ph-fill ph-check-circle";
                         let color = "text-slate-500";
                         if (lower.includes('pending') || lower.includes('confirmed')) { icon = "ph-fill ph-clock"; color = "text-amber-500"; }
                         else if (lower.includes('design')) { icon = "ph-fill ph-paint-brush-broad"; color = "text-blue-500"; }
                         else if (lower.includes('print')) { icon = "ph-fill ph-printer"; color = "text-fuchsia-500"; }
                         else if (lower.includes('deliver') || lower.includes('dispatch')) { icon = "ph-fill ph-package"; color = "text-green-500"; }
                         else if (lower.includes('cancel')) { icon = "ph-fill ph-x-circle"; color = "text-red-500"; }
                         else if (lower.includes('completed') || lower.includes('done')) { icon = "ph-fill ph-check-circle"; color = "text-emerald-500"; }

                         return {
                           label: opt.label,
                           value: opt.label,
                           icon,
                           color
                         };
                       });
                     }
                   }

                   return (
                     <JobStatusStepper 
                       steps={dynamicSteps}
                       currentStatus={job.status || (dynamicSteps.length > 0 ? dynamicSteps[0].value : "Pending")}
                       onStatusChange={(val) => changeStatus(val)}
                       className="w-full"
                     />
                   );
                })()}
              </div>
            </div>

          </main>

        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-3xl p-6 bg-white border-0 shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Delete Job?</h3>
            <p className="text-slate-500 mb-8 font-medium">This action cannot be undone. This will permanently remove the job and all related data.</p>
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : "Yes, Delete"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (standaloneJobId) {
    return content;
  }

  return (
    <Dialog open={isVisible} onOpenChange={(open) => {
      if (!open) closeJobDetails();
    }}>
      <DialogContent className="!max-w-[1300px] w-full sm:w-[95vw] p-0 bg-transparent border-0 shadow-none">
        <DialogTitle className="sr-only">Job Details</DialogTitle>
        {content}
      </DialogContent>
    </Dialog>
  );
}
