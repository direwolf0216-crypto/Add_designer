"use client";

import React, { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import flatpickr from "flatpickr";

import CustomDropdown from "@/components/ui/CustomDropdown";
import CustomMultiDropdown from "@/components/ui/CustomMultiDropdown";
import Autocomplete from "../ui/Autocomplete";
import UserPicklist from "../ui/UserPicklist";
import MultiUserPicklist, { UserItem } from "../ui/MultiUserPicklist";
import { jobSchema, JobFormData } from "@/lib/validations/job";
import { saveJobAction } from "@/app/actions";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DatePickerInput from "../ui/DatePickerInput";
import TimePickerInput from "../ui/TimePickerInput";
import FileAttachment from "@/components/ui/FileAttachment";

import { useRouter, useSearchParams } from "next/navigation";
import { mutate } from "swr";
import { useGlobalForm } from "@/components/providers/GlobalFormProvider";
import { uploadFileToDrive } from "@/lib/uploadHelper";

const fetcher = (url: string) => fetch(url).then(r => r.json());

import { Suspense } from "react";

const getFieldIcon = (fieldName: string, type: string) => {
  const name = (fieldName || '').toLowerCase();
  if (name.includes('client') || name.includes('user') || name.includes('name')) return 'ph-user';
  if (name.includes('phone') || name.includes('mobile')) return 'ph-phone';
  if (name.includes('email') || name.includes('mail')) return 'ph-envelope-simple';
  if (name.includes('date') || type === 'DATE') return 'ph-calendar-blank';
  if (type === 'TIME') return 'ph-clock';
  if (name.includes('category') || name.includes('type')) return 'ph-list-dashes';
  if (name.includes('size')) return 'ph-ruler';
  if (name.includes('qty') || name.includes('quantity')) return 'ph-hash';
  if (name.includes('advance')) return 'ph-wallet';
  if (name.includes('payment mode')) return 'ph-credit-card';
  if (name.includes('discount')) return 'ph-tag';
  if (type === 'CURRENCY') return 'ph-currency-inr';
  return 'ph-text-aa';
};
function JobFormModalInner() {
  const { isJobFormOpen, jobToEditId, jobInitialDate, closeJobForm } = useGlobalForm();

  const { data: fetchedJob, isLoading: isJobLoading } = useSWR(
    jobToEditId ? `/api/jobs/${jobToEditId}` : null,
    fetcher
  );

  const job = jobToEditId ? fetchedJob : null;

  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedDateForNew = jobInitialDate;
  const isAddModalOpen = isJobFormOpen;

  const clientSuggestions: string[] = [];
  const locationSuggestions: string[] = [];

  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: '', category: '', date: '', time: '10:00 AM',
      location: '', phone: '', email: '', package: '', advance: '', due: '', status: 'Confirmed',
      fld_print_quantity: '', fld_print_paper_type: '', fld_print_gsm: '', fld_print_size: '', fld_print_design: ''
    }
  });

  const timeInputRef = useRef<HTMLInputElement>(null);
  const [timeFpInstance, setTimeFpInstance] = useState<flatpickr.Instance | null>(null);

  const [categoryOptions, setCategoryOptions] = useState<string[]>(['Flex Printing', 'Invitations', 'Business Cards', 'Posters']);
  const [statusOptions, setStatusOptions] = useState<string[]>(['Confirmed', 'Pending', 'Partial']);
  const [layoutSchema, setLayoutSchema] = useState<any>(null);
  const [teamUsers, setTeamUsers] = useState<UserItem[]>([]);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [isMultiInstallment, setIsMultiInstallment] = useState(false);
  const [installments, setInstallments] = useState<{ amount: string, date: string, paymentMode: string, transactionId?: string }[]>([
    { amount: '', date: new Date().toISOString().split('T')[0], paymentMode: 'Cash' }
  ]);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<string | null>(null);
  const [repeatableData, setRepeatableData] = useState<Record<string, Array<Record<string, any>>>>({});
  const [financialRates, setFinancialRates] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ sectionId: string, index: number } | null>(null);

  const standardFieldMap: Record<string, string> = {
    fld_b_client: 'title', fld_b_phone: 'phone', fld_b_email: 'email',
    fld_b_date: 'date', fld_b_time: 'time', fld_b_job_category: 'category',
    fld_b_location: 'location', fld_b_status: 'status', fld_b_package: 'package', fld_b_advance: 'advance',
    fld_gallery_delivered: 'galleryDelivered'
  };

  const { data: layoutData } = useSWR(isJobFormOpen ? "/api/settings/layouts/JOB_FORM" : null, fetcher);
  const { data: usersData } = useSWR(isJobFormOpen ? "/api/users" : null, fetcher);
  const { data: driveStatus } = useSWR(isJobFormOpen ? "/api/integrations/google" : null, fetcher);

  const selectedDateStr = watch('date');
  const { data: jobsData } = useSWR(isJobFormOpen && selectedDateStr ? `/api/jobs?startDate=${selectedDateStr}&endDate=${selectedDateStr}` : null, fetcher);

  useEffect(() => {
    if (layoutData?.schema?.sections) {
      setLayoutSchema(layoutData.schema);
      layoutData.schema.sections.forEach((section: any) => {
        section.fields.forEach((field: any) => {
          if (field.id === "fld_b_job_category" && field.options?.length > 0) {
            setCategoryOptions(field.options);
          }
          if (field.id === "fld_b_status" && field.options?.length > 0) {
            setStatusOptions(field.options);
          }
        });
      });
    }
  }, [layoutData]);

  useEffect(() => {
    if (usersData) {
      const staff = (Array.isArray(usersData) ? usersData : usersData?.users ?? []).filter((u: any) => u.role !== 'CLIENT');
      setTeamUsers(staff.map((u: any) => ({
        id: u.id, name: u.name || 'Unknown', image: u.image, role: u.role
      })));
    }
  }, [usersData]);

  useEffect(() => {
    if (jobsData) setAllJobs(jobsData?.items || []);
  }, [jobsData]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusDropdownOpen) {
        const target = e.target as HTMLElement;
        if (!target.closest('.custom-dropdown-container')) {
          setStatusDropdownOpen(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [statusDropdownOpen]);

  // Edit mode pre-fill
  useEffect(() => {
    if (isAddModalOpen && !isJobLoading && job && layoutSchema) {
      const b = job as any;

      let parsedCustomData: any = {};
      if (typeof b.customData === 'string') {
        try { parsedCustomData = JSON.parse(b.customData); } catch (e) { }
      } else if (b.customData && typeof b.customData === 'object') {
        parsedCustomData = b.customData;
      }

      const initialRepeatableData: Record<string, any[]> = {};
      Object.keys(parsedCustomData).forEach(key => {
        if (key.startsWith('rep_')) {
          let val = parsedCustomData[key];
          if (typeof val === 'string') {
            try { val = JSON.parse(val); } catch (e) { }
          }
          initialRepeatableData[key] = Array.isArray(val) ? val : [];
          delete parsedCustomData[key];
        }
      });
      setRepeatableData(initialRepeatableData);

      if (parsedCustomData.fld_financial_rates) {
        try {
          setFinancialRates(JSON.parse(parsedCustomData.fld_financial_rates));
        } catch (e) { }
      } else {
        setFinancialRates({});
      }

      const formValues: any = {
        id: b.id,
        title: b.client?.name || b.title || parsedCustomData.fld_b_client || '',
        phone: b.client?.phone || b.phone || parsedCustomData.fld_b_phone || '',
        email: b.client?.email || b.email || parsedCustomData.fld_b_email || '',
        date: b.date ? (typeof b.date === 'string' ? b.date.split('T')[0] : new Date(b.date).toISOString().split('T')[0]) : (parsedCustomData.fld_b_date || ''),
        time: parsedCustomData.fld_b_time || b.time || '',
        category: b.category || parsedCustomData.fld_b_job_category || '',
        location: b.location || parsedCustomData.fld_b_location || '',
        status: b.status || parsedCustomData.fld_b_status || '',
        package: b.order?.package ? b.order.package.toString() : (parsedCustomData.fld_b_package || ''),
        advance: b.order?.advance ? b.order.advance.toString() : (parsedCustomData.fld_b_advance || ''),
        due: b.order?.due ? b.order.due.toString() : '',
        ...parsedCustomData
      };

      reset(formValues);

      if (timeFpInstance && formValues.time) {
        timeFpInstance.setDate(formValues.time);
      }


      const validTransactions = (b.transactions || []).filter((tx: any) => !tx.deletedAt);
      if (validTransactions.length > 0) {
        setIsMultiInstallment(validTransactions.length > 1);
        setInstallments(validTransactions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((tx: any) => ({
          amount: tx.amount.toString(),
          date: new Date(tx.date).toISOString().split('T')[0],
          paymentMode: tx.paymentMode || 'Cash',
          transactionId: tx.id
        })));
      } else if (b.order?.installments && Array.isArray(b.order.installments) && b.order.installments.length > 0) {
        setIsMultiInstallment(b.order.installments.length > 1);
        setInstallments(b.order.installments);
      } else {
        setIsMultiInstallment(false);
        setInstallments([{
          amount: b.order?.advance ? b.order.advance.toString() : (formValues.advance || ''),
          date: new Date().toISOString().split('T')[0],
          paymentMode: formValues.paymentMode || 'Cash'
        }]);
      }
    }
  }, [isAddModalOpen, job?.id, isJobLoading, reset, timeFpInstance, layoutSchema]);

  // Add mode default initialization
  useEffect(() => {
    if (isAddModalOpen && !isJobLoading && !jobToEditId) {
      const defaultDate = selectedDateForNew || new Date().toISOString().split('T')[0];
      const defaultValues: any = {
        title: '', category: '', date: defaultDate, time: '10:00 AM',
        location: '', phone: '', email: '', package: '', advance: '', due: '', status: 'Confirmed'
      };

      let statusFieldId = 'fld_b_status';
      if (layoutSchema?.sections) {
        const statusF = layoutSchema.sections.flatMap((s: any) => s.fields).find((f: any) => f.type === 'STATUS_PICKER');
        if (statusF) statusFieldId = statusF.id;
      }

      const initialRepeatable: Record<string, any[]> = {};

      if (layoutSchema?.sections) {
        layoutSchema.sections.forEach((sec: any) => {
          if (sec.isRepeatable) {
            const initialEntry: any = {};
            sec.fields.forEach((f: any) => {
              const fname = standardFieldMap[f.id] || f.id;
              if ((f.type === 'PICK_LIST' || f.type === 'CATEGORY_PICKER' || f.id === 'fld_b_job_category') && f.options && f.options.length > 0) {
                initialEntry[fname] = f.options[0].label || f.options[0] || '';
              } else if (f.defaultValue) {
                initialEntry[fname] = f.defaultValue;
              }
            });
            initialRepeatable[`rep_${sec.id}`] = [initialEntry];
          }
          sec.fields.forEach((f: any) => {
            if (sec.isRepeatable) return; // Don't flatten repeatable fields into defaultValues
            const fname = (f.id === statusFieldId && f.type === 'STATUS_PICKER') ? 'status' : (standardFieldMap[f.id] || f.id);

            if (f.type === 'STATUS_PICKER' && f.statusOptions && f.statusOptions.length > 0) {
              defaultValues[fname] = f.statusOptions[0].label;
            } else if ((f.type === 'PICK_LIST' || f.type === 'CATEGORY_PICKER' || f.id === 'fld_b_job_category') && f.options && f.options.length > 0) {
              defaultValues[fname] = f.options[0].label || f.options[0] || '';
            }

            if (f.defaultValue) {
              defaultValues[fname] = f.defaultValue;
            }
          });
        });
      }
      setRepeatableData(initialRepeatable);
      reset(defaultValues);
      if (timeFpInstance) timeFpInstance.setDate(defaultValues.time || '10:00 AM');
      clearErrors();
    }
  }, [isAddModalOpen, jobToEditId, isJobLoading, selectedDateForNew, reset, clearErrors, layoutSchema, timeFpInstance]);

  useEffect(() => {
    if (isAddModalOpen) {
      let timeFp: flatpickr.Instance | null = null;
      if (timeInputRef.current) {
        timeFp = flatpickr(timeInputRef.current, {
          enableTime: true,
          noCalendar: true,
          dateFormat: "h:i K",
          defaultDate: watch('time') || '10:00 AM',
          onChange: (selectedDates, dateStr) => setValue('time', dateStr)
        }) as flatpickr.Instance;
        setTimeFpInstance(timeFp);
      }

      return () => {
        if (timeFp) timeFp.destroy();
        setTimeFpInstance(null);
      };
    }
  }, [isAddModalOpen, setValue, watch]);

  const parseCurrency = (str: string) => parseFloat(str.replace(/,/g, '')) || 0;
  const formatCurrencyInput = (num: number) => num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useEffect(() => {
    // If installments change, auto-update the advance
    if (installments.length > 0) {
      const sum = installments.reduce((acc, curr) => acc + parseCurrency(curr.amount || '0'), 0);
      setValue('advance', sum > 0 ? sum.toString() : '');
    }

    const fValues = watch();

    // Auto-calculate package if repeatable jobs are present
    let calculatedPackage = 0;
    let hasRepeatableRates = false;

    // Scan repeatableData for category fields and compute based on financialRates
    Object.keys(repeatableData).forEach(secKey => {
      const repSection = layoutSchema?.sections?.find((s: any) => `rep_${s.id}` === secKey);
      const entries = repeatableData[secKey] || [];
      entries.forEach((entry: any, idx: number) => {
        let catFieldKey = Object.keys(entry).find(k => k.toLowerCase().includes('category') || k.toLowerCase().includes('job'));
        let qtyFieldKey = Object.keys(entry).find(k => k.toLowerCase().includes('qty') || k.toLowerCase().includes('quantity'));

        if (repSection && repSection.fields) {
          const catF = repSection.fields.find((f: any) => f.name.toLowerCase().includes('category') || f.name.toLowerCase().includes('job'));
          if (catF) catFieldKey = standardFieldMap[catF.id] || catF.id;

          const qtyF = repSection.fields.find((f: any) => f.name.toLowerCase().includes('qty') || f.name.toLowerCase().includes('quantity'));
          if (qtyF) qtyFieldKey = standardFieldMap[qtyF.id] || qtyF.id;
        }

        if (catFieldKey && entry[catFieldKey]) {
          hasRepeatableRates = true;
          const rateStr = financialRates[`${secKey}_${idx}`] || '0';
          const rate = parseCurrency(rateStr);
          let qty = 1;
          if (qtyFieldKey && entry[qtyFieldKey]) {
            qty = parseFloat(entry[qtyFieldKey]) || 1;
          }
          calculatedPackage += (rate * qty);
        }
      });
    });

    if (hasRepeatableRates) {
      let discountFieldKey = Object.keys(fValues).find(k => k.toLowerCase().includes('discount'));
      if (layoutSchema && layoutSchema.sections) {
        const discF = layoutSchema.sections.flatMap((s: any) => s.fields).find((f: any) => (f.name || '').toLowerCase().includes('discount'));
        if (discF) discountFieldKey = standardFieldMap[discF.id] || discF.id;
      }
      const discount = discountFieldKey ? parseCurrency((fValues as any)[discountFieldKey] || '0') : 0;

      const grandTotal = Math.max(0, calculatedPackage - discount);
      if (fValues.package !== grandTotal.toString()) {
        setValue('package', grandTotal.toString());
      }
    }

    const total = parseCurrency(watch('package') || '0'); // This is now grandTotal
    const advance = parseCurrency(watch('advance') || '0');

    // Outstanding balance is just grandTotal (total) - advance
    const outstanding = Math.max(0, total - advance);
    if (total > 0 || advance > 0) {
      setValue('due', formatCurrencyInput(outstanding));
    } else {
      setValue('due', '');
    }
  }, [watch('package'), watch('advance'), installments, setValue, watch, repeatableData, financialRates, layoutSchema]);

  // The previous useEffect that registered all mandatory fields was removed to support dynamic visibility.
  // We now register mandatory fields manually inside `renderField` and handle custom component validation inside `onSubmit`.

  const formValues = watch();

  const evaluateVisibility = (rule: any) => {
    if (!rule) return true;

    const dependsOnKey = rule.dependsOn || rule.fieldId;
    if (!dependsOnKey) return true;

    const depFieldName = standardFieldMap[dependsOnKey] || dependsOnKey;
    const depValue = formValues[depFieldName as keyof JobFormData] !== undefined
      ? formValues[depFieldName as keyof JobFormData]
      : (formValues as any)[dependsOnKey];

    const ruleValues: string[] = rule.values || (rule.value ? [rule.value] : []);

    if (rule.dependsOn || rule.fieldId) {
    }

    if (rule.operator === 'EQUALS') {
      return ruleValues.includes(depValue as string);
    } else if (rule.operator === 'NOT_EQUALS') {
      return !ruleValues.includes(depValue as string);
    } else if (rule.operator === 'CONTAINS') {
      if (typeof depValue === 'string') {
        return ruleValues.some(v => depValue.includes(v));
      }
      if (Array.isArray(depValue)) {
        return ruleValues.some(v => depValue.includes(v));
      }
      return false;
    }

    // For pure dependsOn + values format without operator
    if (rule.dependsOn && Array.isArray(rule.values) && !rule.operator) {
      return rule.values.includes(depValue);
    }

    return true;
  };

  const onSubmit = async (data: JobFormData) => {
    let hasManualErrors = false;
    clearErrors();

    // Validate repeatable sections have at least 1 entry
    if (layoutSchema && layoutSchema.sections) {
      layoutSchema.sections.forEach((section: any) => {
        if (section.isRepeatable) {
          const arr = repeatableData[`rep_${section.id}`] || [];
          if (arr.length === 0) {
            toast.error(`Please add at least one entry for ${section.title || 'the repeatable section'}.`);
            hasManualErrors = true;
          }
        }
      });
    }

    if (hasManualErrors) {
      setIsSubmittingLocal(false);
      return;
    }

    // Evaluate visibility and apply manual validation for custom/hidden fields
    if (layoutSchema && layoutSchema.sections) {
      layoutSchema.sections.forEach((section: any) => {
        if (section.isRepeatable) return; // Skip repeatable fields for standard flat validation
        const secVisible = evaluateVisibility(section.visibilityRule);
        if (!secVisible) return;

        section.fields.forEach((field: any) => {
          const fieldVisible = evaluateVisibility(field.visibilityRule);
          if (!fieldVisible) return;

          const fieldName = standardFieldMap[field.id] || field.id;

          // Manual required check for fields that use setValue (not natively registered with required)
          // or fields that bypassed native validation
          if (field.mandatory && (!data[fieldName as keyof JobFormData] || (Array.isArray(data[fieldName as keyof JobFormData]) && data[fieldName as keyof JobFormData].length === 0))) {
            setError(fieldName as any, { type: 'manual', message: `${field.name} is required` });
            hasManualErrors = true;
          }
        });
      });
    }

    if (hasManualErrors) {
      // Find the first manual error field to scroll to
      let firstErrField = null;
      if (layoutSchema && layoutSchema.sections) {
        for (const section of layoutSchema.sections) {
          if (firstErrField) break;
          if (section.isRepeatable) continue;
          if (!evaluateVisibility(section.visibilityRule)) continue;

          for (const field of section.fields) {
            if (!evaluateVisibility(field.visibilityRule)) continue;
            const fieldName = standardFieldMap[field.id] || field.id;
            if (field.mandatory && (!data[fieldName as keyof JobFormData] || (Array.isArray(data[fieldName as keyof JobFormData]) && data[fieldName as keyof JobFormData].length === 0))) {
              firstErrField = fieldName;
              break;
            }
          }
        }
      }

      if (firstErrField) {
        setTimeout(() => {
          const element = document.getElementById(`field-container-${firstErrField}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Flash red background momentarily for better UX
            element.classList.add('bg-red-50', 'p-2', 'rounded-xl', 'transition-colors', 'duration-500');
            setTimeout(() => {
              element.classList.remove('bg-red-50', 'p-2', 'rounded-xl', 'transition-colors', 'duration-500');
            }, 500);
          }
        }, 100);
      }
      setIsSubmittingLocal(false);
      return;
    }

    // Filter out hidden fields from submission
    if (layoutSchema && layoutSchema.sections) {
      layoutSchema.sections.forEach((section: any) => {
        const secVisible = evaluateVisibility(section.visibilityRule);
        section.fields.forEach((field: any) => {
          const fieldVisible = secVisible && evaluateVisibility(field.visibilityRule);
          const fieldName = standardFieldMap[field.id] || field.id;
          if (!fieldVisible) {
            delete data[fieldName as keyof JobFormData];
          }
        });
      });
    }

    // Handle file uploads
    setIsSubmittingLocal(true);
    try {
      const uploadPromises = [];
      for (const [key, value] of Object.entries(data)) {
        let valToProcess = value;
        if (Array.isArray(value) && value.length > 0) {
          const first = value[0];
          if (first instanceof File || first instanceof Blob || (typeof first === 'object' && first.driveFile) || (typeof first === 'string' && (first.startsWith('data:') || first.includes('driveFile')))) {
            valToProcess = first;
            (data as any)[key] = valToProcess;
          }
        }

        if (typeof window !== 'undefined' && (valToProcess instanceof File || valToProcess instanceof Blob)) {
          uploadPromises.push(
            uploadFileToDrive(valToProcess as File, 'Jobs', data.category || 'Uncategorized', data.date)
              .then(uploaded => ({ key, uploaded }))
          );
        } else if (valToProcess && typeof valToProcess === 'object' && !Array.isArray(valToProcess)) {
          (data as any)[key] = JSON.stringify(valToProcess);
        }
      }

      const uploadResults = await Promise.all(uploadPromises);
      for (const result of uploadResults) {
        (data as any)[result.key] = JSON.stringify(result.uploaded);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
      setIsSubmittingLocal(false);
      return;
    }

    const formDataObj = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          formDataObj.append(key, JSON.stringify(value));
        } else if (Array.isArray(value)) {
          formDataObj.append(key, value.join(', '));
        } else {
          formDataObj.append(key, value as string);
        }
      }
    });

    Object.entries(repeatableData).forEach(([key, value]) => {
      formDataObj.append(key, JSON.stringify(value));
    });

    formDataObj.append('fld_financial_rates', JSON.stringify(financialRates));

    // Check for recordDate
    if (layoutSchema?.sections) {
      const recordDateField = layoutSchema.sections
        .flatMap((s: any) => s.fields)
        .find((f: any) => f.isRecordDate);
      if (recordDateField) {
        const fname = standardFieldMap[recordDateField.id] || recordDateField.id;
        const recordDateValue = data[fname as keyof JobFormData];
        if (recordDateValue) {
          formDataObj.append('recordDate', recordDateValue as string);
        }
      }
    }

    const result = await saveJobAction(formDataObj);

    if (result.success && result.data) {
      let needsReSave = false;
      const newInstallments = [...installments];
      const txPromises = newInstallments.map(async (inst) => {
        if (inst.amount && parseFloat(inst.amount) > 0) {
          const isLegacy = inst.transactionId?.toString().startsWith('legacy');
          if (!inst.transactionId || isLegacy) {
            try {
              const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  amount: parseFloat(inst.amount),
                  type: 'INCOME',
                  category: 'JOB',
                  description: `Advance Payment for Job ${result.data.jobNumber || '#' + result.data.id} - ${data.title || 'Client'}`,
                  date: new Date(inst.date).toISOString(),
                  jobId: result.data.id,
                  paymentMode: inst.paymentMode || 'Cash'
                })
              });
              if (res.ok) {
                const txData = await res.json();
                inst.transactionId = txData.id;
                needsReSave = true;
              }
            } catch (e) {
              console.error("Failed to create transaction for installment", e);
            }
          } else {
            // Update existing transaction
            try {
              await fetch(`/api/transactions/${inst.transactionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  amount: parseFloat(inst.amount),
                  date: new Date(inst.date).toISOString(),
                  paymentMode: inst.paymentMode || 'Cash'
                })
              });
            } catch (e) {
              console.error("Failed to update transaction for installment", e);
            }
          }
        }
      });
      await Promise.all(txPromises);

      if (needsReSave) {
        formDataObj.set('id', result.data.id);
        formDataObj.set('installments', JSON.stringify(newInstallments));
        await saveJobAction(formDataObj);
      }

      toast.success(job ? "Job updated successfully!" : "Job created successfully!");

      // Use SWR mutate to update cache immediately without full page reload
      mutate(
        (key: any) => typeof key === 'string' && (key.startsWith('/api/jobs') || key.startsWith('/api/dashboard') || key.startsWith('/api/transactions')),
        undefined,
        { revalidate: true }
      );
      router.refresh();

      closeJobForm();
    } else {
      toast.error("Failed to save job. Please check your inputs.");
    }
    setIsSubmittingLocal(false);
  };

  const onError = (errors: any) => {
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      const element = document.getElementById(`field-container-${firstError}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const currentDate = watch('date');
  const currentTime = watch('time');

  const usersWithAvailability = teamUsers.map(user => {
    const isBusy = allJobs.some(b => {
      if (job && b.id === job.id) return false;

      const bDateStr = typeof b.date === 'string' ? b.date.split('T')[0] : '';
      if (bDateStr === currentDate && b.time === currentTime) {
        if (b.customData) {
          return Object.values(b.customData).some(val => {
            if (typeof val === 'string' && val.includes(user.id)) return true;
            return false;
          });
        }
      }
      return false;
    });
    return { ...user, isBusy };
  });

  const handleDeleteInstallment = async (idx: number) => {
    const inst = installments[idx];
    if (inst.transactionId) {
      if (!confirm('Are you sure you want to delete this payment transaction?')) return;
      try {
        await fetch(`/api/transactions/${inst.transactionId}`, { method: 'DELETE' });
        toast.success('Transaction deleted');
      } catch (err) {
        toast.error('Failed to delete transaction');
        return;
      }
    }
    setInstallments(installments.filter((_, i) => i !== idx));
  };

  const renderField = (field: any) => {
    const fieldName = standardFieldMap[field.id] || field.id;
    const isError = errors[fieldName as keyof JobFormData];
    const icon = getFieldIcon(field.name, field.type);

    const wrapWithIcon = (children: React.ReactNode, isCurrency = false) => (
      <div className="relative">
        {!isCurrency && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 z-10">
            <i className={`ph-bold ${icon} text-[1.1rem]`}></i>
          </div>
        )}
        {children}
      </div>
    );

    if (field.id === 'fld_b_client') {
      return wrapWithIcon(
        <input type="text" autoComplete="new-password" className={`flex h-[45px] w-full rounded-xl border bg-white pl-10 pr-4 py-2 text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isError ? 'border-red-500' : 'border-gray-200'}`} {...register(fieldName as any, { required: field.mandatory })} placeholder={field.placeholder || "e.g. Rahul Sharma"} />
      );
    }
    if (field.id === 'fld_b_location') {
      return wrapWithIcon(
        <Autocomplete suggestions={locationSuggestions} value={watch(fieldName as any) || ''} onChange={val => setValue(fieldName as any, val, { shouldValidate: true })} placeholder={field.placeholder || "e.g. Grand Hyatt, City"} error={!!isError} className="pl-10" />
      );
    }
    if (field.type === 'DATE') {
      return wrapWithIcon(
        <DatePickerInput value={watch(fieldName as any) || ''} onChange={(date) => setValue(fieldName as any, date, { shouldValidate: true })} placeholder={field.placeholder || "Select Date..."} disableFutureDates={!!field.restrictFutureDate} className="pl-10" />
      );
    }
    if (field.type === 'TIME') {
      return wrapWithIcon(
        <TimePickerInput value={watch(fieldName as any) || ''} onChange={(time) => setValue(fieldName as any, time, { shouldValidate: true })} placeholder={field.placeholder || "e.g. HH:MM AM/PM"} hasError={!!isError} className="pl-10" />
      );
    }
    if (field.type === 'PICK_LIST') {
      const opts = field.options || [];
      return wrapWithIcon(
        <CustomDropdown
          options={opts}
          value={watch(fieldName as any) || ''}
          onChange={(val) => setValue(fieldName as any, val as any, { shouldValidate: true })}
          error={!!isError}
          placeholder={`Select ${field.name}...`}
          className="pl-10"
        />
      );
    }

    if (field.type === 'MULTI_SELECT') {
      const opts = field.options || [];
      const currentSelected = watch(fieldName as any) || '';
      const selectedArray = typeof currentSelected === 'string' && currentSelected.trim() ? currentSelected.split(',').map((s: string) => s.trim()) : (Array.isArray(currentSelected) ? currentSelected : []);

      return wrapWithIcon(
        <CustomMultiDropdown
          options={opts.map((opt: any) => opt.label || opt.value || opt)}
          value={selectedArray}
          onChange={(val: any) => setValue(fieldName as any, Array.isArray(val) ? val.join(', ') : val as any, { shouldValidate: true })}
          error={!!isError}
          placeholder={`Select ${field.name}...`}
          className="pl-10"
        />
      );
    }

    if (field.type === 'STATUS_PICKER') {
      const opts = field.statusOptions || [];
      const currentValue = watch(fieldName as any) || '';
      const currentOpt = opts.find((o: any) => o.label === currentValue);

      // Handle future date restriction
      let isRestrictedDate = false;
      if (field.futureDateRestriction?.enabled && field.futureDateRestriction?.dateFieldId) {
        const dependentDateFieldName = standardFieldMap[field.futureDateRestriction.dateFieldId] || field.futureDateRestriction.dateFieldId;
        const dependentDateVal = watch(dependentDateFieldName as any);
        if (dependentDateVal) {
          const dateObj = new Date(dependentDateVal);
          dateObj.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (dateObj > today) {
            isRestrictedDate = true;
          }
        }
      }

      // Filter options if restricted (CustomDropdown doesn't currently support disabled individual options, but the user requested replacing custom inline UIs with CustomDropdown. For restricted statuses, we can omit them or just pass them if CustomDropdown doesn't support disabled. Let's omit them if restricted so they can't be selected).
      const availableOpts = opts.filter((opt: any) => {
        return !(isRestrictedDate && field.futureDateRestriction?.restrictedStatuses?.includes(opt.label));
      });

      return wrapWithIcon(
        <CustomDropdown
          options={availableOpts.map((opt: any) => ({ label: opt.label, value: opt.label, color: opt.color }))}
          value={currentValue}
          onChange={(val: any) => setValue(fieldName as any, val as any, { shouldValidate: true })}
          error={!!isError}
          placeholder={`Select Status...`}
          className="pl-10"
        />
      );
    }

    if (field.type === 'USER_PICKLIST' || field.type === 'MULTI_USER_PICKLIST') {
      let filteredUsers = usersWithAvailability;
      if (field.userPicklistConfig) {
        if (field.userPicklistConfig.mode === 'ROLES' && field.userPicklistConfig.roles?.length > 0) {
          filteredUsers = usersWithAvailability.filter(u => field.userPicklistConfig.roles.includes(u.role));
        } else if (field.userPicklistConfig.mode === 'USERS' && field.userPicklistConfig.userIds?.length > 0) {
          filteredUsers = usersWithAvailability.filter(u => field.userPicklistConfig.userIds.includes(u.id));
        }
      }

      if (field.type === 'USER_PICKLIST') {
        return wrapWithIcon(
          <UserPicklist users={filteredUsers} value={watch(fieldName as any) || ''} onChange={(val) => setValue(fieldName as any, val, { shouldValidate: true })} placeholder={`Select ${field.name}...`} error={!!isError} showAvailability={field.userPicklistConfig?.showAvailability} />
        );
      }

      return wrapWithIcon(
        <MultiUserPicklist users={filteredUsers} value={watch(fieldName as any) || ''} onChange={(val) => setValue(fieldName as any, val, { shouldValidate: true })} placeholder={`Select ${field.name}...`} error={!!isError} showAvailability={field.userPicklistConfig?.showAvailability} />
      );
    }
    if (field.type === 'MULTI_LINE') {
      return wrapWithIcon(
        <textarea className={`flex w-full rounded-xl border bg-white pl-10 pr-4 py-2 text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-h-[80px] ${isError ? 'border-red-500' : 'border-gray-200'}`} {...register(fieldName as any, { required: field.mandatory })} placeholder={field.placeholder || `Enter ${field.name}...`} />
      );
    }

    if (field.type === 'CHECKBOX') {
      return (
        <div className={`flex items-center h-[45px] w-full rounded-xl border bg-white px-4 transition-colors ${isError ? 'border-red-500' : 'border-gray-200'}`}>
          <label className="flex items-center gap-3 cursor-pointer w-full h-full">
            <input
              type="checkbox"
              className="w-5 h-5 accent-blue-500 rounded border-gray-300 cursor-pointer"
              {...register(fieldName as any, { required: field.mandatory })}
            />
            <span className="text-[0.95rem] text-slate-600 font-medium select-none">{field.name}</span>
          </label>
        </div>
      );
    }



    if (field.type === 'IMAGE' || field.type === 'FILE') {
      const value = watch(fieldName as any);
      return (
        <FileAttachment
          id={fieldName}
          type={field.type}
          value={value}
          onChange={(vals: any[]) => setValue(fieldName as any, vals as any)}
          driveStatus={driveStatus}
          moduleName="Jobs"
          categoryName={formValues.category || "Uncategorized"}
        />
      );
    }

    // Default fallback to text/number input
    const typeAttr = field.type === 'EMAIL' ? 'email' : (field.type === 'NUMBER' || field.type === 'CURRENCY' ? 'text' : 'text');

    if (fieldName === 'package') {
      return wrapWithIcon(
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <span className="text-gray-500 font-bold text-[1rem]">₹</span>
          </div>
          <input type="text" readOnly className={`flex h-[45px] w-full rounded-xl border px-4 pl-8 py-2 text-[1rem] font-bold text-slate-600 bg-slate-50 border-slate-200 cursor-not-allowed`} {...register(fieldName as any)} />
        </div>,
        true
      );
    }

    return wrapWithIcon(
      <input type={typeAttr} autoComplete="new-password" className={`flex h-[45px] w-full rounded-xl border bg-white pl-10 pr-4 py-2 text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isError ? 'border-red-500' : 'border-gray-200'}`} {...register(fieldName as any, { required: field.mandatory })} placeholder={field.placeholder || `e.g. Enter ${field.name}...`} />
    );
  };

  const updateRepeatableField = (sectionId: string, index: number, fieldId: string, value: any) => {
    setRepeatableData(prev => {
      const secKey = `rep_${sectionId}`;
      const arr = [...(prev[secKey] || [])];
      if (!arr[index]) arr[index] = {};
      arr[index] = { ...arr[index], [fieldId]: value };
      return { ...prev, [secKey]: arr };
    });
  };

  const renderRepeatableField = (field: any, sectionId: string, index: number) => {
    const fieldName = standardFieldMap[field.id] || field.id;
    const secKey = `rep_${sectionId}`;
    const currentValue = (repeatableData[secKey] && repeatableData[secKey][index]) ? repeatableData[secKey][index][fieldName] : '';
    const onChange = (val: any) => updateRepeatableField(sectionId, index, fieldName, val);
    const icon = getFieldIcon(field.name, field.type);

    const wrapWithIcon = (children: React.ReactNode, isCurrency = false) => (
      <div className="relative">
        {!isCurrency && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 z-10">
            <i className={`ph-bold ${icon} text-[1.1rem]`}></i>
          </div>
        )}
        {children}
      </div>
    );

    if (field.type === 'DATE') {
      return wrapWithIcon(
        <DatePickerInput value={currentValue || ''} onChange={(date) => onChange(date)} placeholder={field.placeholder || "Select Date..."} disableFutureDates={!!field.restrictFutureDate} className="pl-10" />
      );
    }
    if (field.type === 'TIME') {
      return wrapWithIcon(
        <TimePickerInput value={currentValue || ''} onChange={(time) => onChange(time)} placeholder={field.placeholder || "e.g. HH:MM AM/PM"} hasError={false} className="pl-10" />
      );
    }
    if (field.type === 'PICK_LIST' || field.type === 'CATEGORY_PICKER') {
      const opts = field.options || [];
      return wrapWithIcon(
        <CustomDropdown
          options={opts}
          value={currentValue || ''}
          onChange={(val) => onChange(val as any)}
          placeholder={`Select ${field.name}...`}
          className="pl-10"
        />
      );
    }
    if (field.type === 'MULTI_SELECT') {
      const opts = field.options || [];
      const selectedArray = typeof currentValue === 'string' && currentValue.trim() ? currentValue.split(',').map((s: string) => s.trim()) : (Array.isArray(currentValue) ? currentValue : []);
      return wrapWithIcon(
        <CustomMultiDropdown
          options={opts.map((opt: any) => opt.label || opt.value || opt)}
          value={selectedArray}
          onChange={(val: any) => onChange(Array.isArray(val) ? val.join(', ') : val as any)}
          placeholder={`Select ${field.name}...`}
          className="pl-10"
        />
      );
    }
    const typeAttr = field.type === 'EMAIL' ? 'email' : (field.type === 'NUMBER' || field.type === 'CURRENCY' || (field.name && field.name.toLowerCase().includes('discount')) ? 'text' : 'text');

    if (field.type === 'CURRENCY' || (field.name && field.name.toLowerCase().includes('discount'))) {
      return wrapWithIcon(
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <span className="text-gray-500 font-bold text-[0.95rem]">₹</span>
          </div>
          <input
            type="text"
            autoComplete="new-password"
            className="flex h-[45px] w-full rounded-xl border bg-white pl-8 pr-4 py-2 text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 border-gray-200"
            value={currentValue || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || `e.g. Enter ${field.name}...`}
          />
        </div>,
        true
      );
    }

    return wrapWithIcon(
      <input
        type={typeAttr}
        autoComplete="new-password"
        className="flex h-[45px] w-full rounded-xl border bg-white pl-10 pr-4 py-2 text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 border-gray-200"
        value={currentValue || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || `e.g. Enter ${field.name}...`}
      />
    );
  };

  return (
    <Dialog open={isAddModalOpen} onOpenChange={(open) => {
      if (!open) { closeJobForm(); }
    }}>
      <DialogContent className="max-w-[800px] sm:max-w-[800px] w-[95vw] sm:w-full p-0 bg-transparent overflow-visible border-0 shadow-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, type: "spring", bounce: 0.4 }}
          className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col h-[96dvh] max-h-[96dvh] relative overflow-hidden"
        >
          <DialogHeader className="bg-gradient-to-r from-blue-700 to-blue-600 px-5 py-4 sm:px-6 sm:py-5 relative shrink-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-[14px] bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                <i className="ph-fill ph-printer text-white text-xl"></i>
              </div>
              <div className="flex flex-col">
                <span className="text-[0.65rem] sm:text-[0.7rem] font-bold text-orange-300 uppercase tracking-[1px] mb-0.5 leading-none">Job Registration</span>
                <DialogTitle className="text-[1.2rem] sm:text-[1.4rem] font-extrabold text-white leading-tight">
                  {job ? "Edit Printing Job" : "Create Printing Job"}
                </DialogTitle>
                <span className="text-[0.75rem] text-blue-100 font-medium mt-0.5 leading-none">Enter job details to get started</span>
              </div>
            </div>
          </DialogHeader>
          <div className="bg-slate-50 px-5 py-6 sm:px-10 sm:py-8 flex-1 overflow-y-auto">
            <form id="job-form" onSubmit={handleSubmit(onSubmit, onError)} className="hidden">
              <input type="hidden" {...register('installments' as any)} value={JSON.stringify(installments)} />
            </form>
            {layoutSchema && layoutSchema.sections ? (
              layoutSchema.sections.map((section: any, idx: number) => {
                if (section.visibilityRule && !evaluateVisibility(section.visibilityRule)) {
                  return null;
                }

                const badgeColors = [
                  'bg-blue-50 text-blue-600 border-blue-100',
                  'bg-emerald-50 text-emerald-600 border-emerald-100',
                  'bg-purple-50 text-purple-600 border-purple-100'
                ];
                const badgeColor = badgeColors[idx % badgeColors.length];
                const numStr = (idx + 1).toString().padStart(2, '0');

                return (
                  <div key={section.id} className="bg-white rounded-3xl p-6 sm:p-8 mb-6 border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] relative">
                    <div className="flex flex-col mb-8">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center font-bold text-[1.1rem] border ${badgeColor}`}>
                          {numStr}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-extrabold text-[1.2rem] text-slate-900 tracking-tight">{section.title}</span>
                          {section.description && <span className="text-[0.85rem] text-slate-500 mt-0.5 font-medium">{section.description}</span>}
                        </div>
                      </div>
                    </div>

                    {section.isRepeatable ? (
                      <div className="flex flex-col gap-4">
                        {/* Render Global Fields (isRepeatableField === false) */}
                        {section.fields.filter((f: any) => f.isRepeatableField === false).length > 0 && (
                          <div className={`grid gap-5 items-start ${section.id === 'sec_job_financial' ? 'grid-cols-1 md:grid-cols-12' : 'grid-cols-1 md:grid-cols-2'} mb-4`}>
                            {(section.id === 'sec_job_financial'
                              ? [...section.fields.filter((f: any) => f.isRepeatableField === false)].sort((a, b) => {
                                const getOrder = (field: any) => {
                                  const nameStr = ((standardFieldMap[field.id] || field.id) + ' ' + (field.name || '')).toLowerCase();
                                  if (nameStr.includes('package') || nameStr.includes('total')) return 0;
                                  if (nameStr.includes('discount')) return 1;
                                  if (nameStr.includes('advance')) return 2;
                                  if (nameStr.includes('payment')) return 3;
                                  return 99;
                                };
                                return getOrder(a) - getOrder(b);
                              })
                              : section.fields.filter((f: any) => f.isRepeatableField === false)
                            ).map((field: any) => {
                              const statusF = layoutSchema?.sections?.flatMap((s: any) => s.fields).find((f: any) => f.type === 'STATUS_PICKER');
                              let fieldName = standardFieldMap[field.id] || field.id;
                              if (statusF && field.id === statusF.id) fieldName = 'status';
                              if (field.visibilityRule && !evaluateVisibility(field.visibilityRule)) return null;
                              const isError = errors[fieldName as keyof JobFormData];
                              if (!job && field.type === 'STATUS_PICKER') return null;
                              return (
                                <div key={field.id} id={`field-container-${fieldName}`} className={`flex flex-col gap-1.5 ${section.id === 'sec_job_financial' ? 'md:col-span-4' : (field.type === 'MULTI_LINE' ? 'md:col-span-2' : '')}`}>
                                  <div className="flex justify-between items-center">
                                    <label className="text-[0.75rem] font-bold text-slate-600 uppercase tracking-[0.5px]">
                                      {field.name} {field.mandatory && <span className="text-red-500 ml-0.5">*</span>}
                                    </label>
                                  </div>
                                  {renderField(field)}
                                  {isError && <span className="text-[0.7rem] font-semibold text-red-500 mt-1">{isError.message as string || `${field.name} is required`}</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {(repeatableData[`rep_${section.id}`] || []).map((entry, entryIdx) => (
                          <div key={entryIdx} className="bg-white border border-slate-200 rounded-xl p-5 relative group/rep shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                              {section.fields.filter((f: any) => f.isRepeatableField !== false).map((field: any) => {
                                if (field.visibilityRule && !evaluateVisibility(field.visibilityRule)) return null;
                                return (
                                  <div key={field.id} id={`field-container-${standardFieldMap[field.id] || field.id}`} className="flex flex-col gap-1.5 relative">
                                    <label className="text-[0.75rem] font-bold text-slate-600 uppercase tracking-[0.5px]">
                                      {field.name} {field.mandatory && <span className="text-red-500 ml-0.5">*</span>}
                                    </label>
                                    <div className="relative mt-1">
                                      {renderRepeatableField(field, section.id, entryIdx)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {entryIdx > 0 && (
                              <button type="button" onClick={() => setDeleteConfirm({ sectionId: section.id, index: entryIdx })} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover/rep:opacity-100 transition-opacity">
                                <i className="ph-bold ph-trash text-lg"></i>
                              </button>
                            )}
                            {deleteConfirm?.sectionId === section.id && deleteConfirm?.index === entryIdx && (
                              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-xl flex items-center justify-center gap-4 z-10 border border-red-100 shadow-sm">
                                <span className="text-slate-800 font-bold text-[0.95rem]">Remove this entry?</span>
                                <button type="button" onClick={() => {
                                  setRepeatableData(prev => {
                                    const arr = [...(prev[`rep_${section.id}`] || [])];
                                    arr.splice(entryIdx, 1);
                                    return { ...prev, [`rep_${section.id}`]: arr };
                                  });
                                  setDeleteConfirm(null);
                                }} className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-[0.9rem] transition-colors shadow-lg shadow-red-500/20">Yes, Remove</button>
                                <button type="button" onClick={() => setDeleteConfirm(null)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[0.9rem] transition-colors shadow-sm border border-slate-200">Cancel</button>
                              </div>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => {
                          setRepeatableData(prev => {
                            const arr = [...(prev[`rep_${section.id}`] || [])];
                            const newEntry: any = {};
                            section.fields.forEach((f: any) => {
                              const fname = standardFieldMap[f.id] || f.id;
                              if ((f.type === 'PICK_LIST' || f.type === 'CATEGORY_PICKER' || f.id === 'fld_b_job_category') && f.options && f.options.length > 0) {
                                newEntry[fname] = f.options[0].label || f.options[0] || '';
                              } else if (f.defaultValue) {
                                newEntry[fname] = f.defaultValue;
                              }
                            });
                            arr.push(newEntry);
                            return { ...prev, [`rep_${section.id}`]: arr };
                          });
                        }} className="mt-2 w-full py-4 border border-dashed border-emerald-300 rounded-2xl bg-emerald-50/50 text-emerald-600 font-bold text-[0.95rem] hover:bg-emerald-50 transition-all flex flex-col items-center justify-center gap-1 shadow-sm">
                          <div className="flex items-center gap-2 text-[1rem]">
                            <i className="ph-bold ph-plus"></i> Add Another Item
                          </div>
                          <span className="text-[0.8rem] font-medium text-emerald-600/70">Add multiple items with different specifications</span>
                        </button>


                      </div>
                    ) : (
                      <div className={`grid gap-5 items-start ${section.id === 'sec_job_financial' ? 'grid-cols-1 md:grid-cols-12' : 'grid-cols-1 md:grid-cols-2'}`}>
                        {(section.id === 'sec_job_financial'
                          ? [...section.fields].sort((a, b) => {
                            const getOrder = (field: any) => {
                              const nameStr = ((standardFieldMap[field.id] || field.id) + ' ' + (field.name || '')).toLowerCase();
                              if (nameStr.includes('package') || nameStr.includes('total')) return 0;
                              if (nameStr.includes('discount')) return 1;
                              if (nameStr.includes('advance')) return 2;
                              return 99;
                            };
                            return getOrder(a) - getOrder(b);
                          })
                          : section.fields
                        ).map((field: any) => {
                          // Map STATUS_PICKER to 'status' if it's the main one
                          const statusF = layoutSchema?.sections?.flatMap((s: any) => s.fields).find((f: any) => f.type === 'STATUS_PICKER');
                          let fieldName = standardFieldMap[field.id] || field.id;
                          if (statusF && field.id === statusF.id) fieldName = 'status';

                          if (field.visibilityRule && !evaluateVisibility(field.visibilityRule)) {
                            return null;
                          }

                          const isError = errors[fieldName as keyof JobFormData];

                          if (!job && field.type === 'STATUS_PICKER') return null;

                          if (fieldName === 'advance') {
                            const pmOptions = ['Cash', 'UPI'].map(m => ({ label: m, value: m }));
                            return (
                              <React.Fragment key="installments-section">
                                <AnimatePresence mode="popLayout">
                                  {!isMultiInstallment ? (
                                    <React.Fragment key="single-installment">
                                      <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="md:col-span-6 flex flex-col gap-1.5 relative">
                                        <div className="flex justify-between items-center h-[20px]">
                                          <label className="text-[0.75rem] font-bold text-slate-600 uppercase tracking-[0.5px]">Advance Paid (₹)</label>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setIsMultiInstallment(true);
                                              setInstallments([
                                                ...installments,
                                                { amount: '', date: new Date().toISOString().split('T')[0], paymentMode: 'Cash' }
                                              ]);
                                            }}
                                            className="text-[0.75rem] font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1 transition-colors whitespace-nowrap"
                                          >
                                            <i className="ph-bold ph-plus"></i> Add Installment
                                          </button>
                                        </div>
                                        <div className="relative mt-1">
                                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</div>
                                          <input type="text" value={installments[0]?.amount || ''} onChange={(e) => {
                                            const newInst = [...installments];
                                            if (newInst.length === 0) newInst.push({ amount: '', date: new Date().toISOString().split('T')[0], paymentMode: 'Cash' });
                                            newInst[0].amount = e.target.value.replace(/[^0-9.]/g, '');
                                            setInstallments(newInst);
                                          }} className="flex h-[45px] w-full rounded-xl border border-gray-200 bg-white pl-8 pr-4 py-2 text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" placeholder="Amount" />
                                        </div>
                                      </motion.div>
                                      <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="md:col-span-6 w-full flex flex-col gap-1.5 relative">
                                        <div className="h-[20px] flex items-center">
                                          <label className="text-[0.75rem] font-bold text-slate-600 uppercase tracking-[0.5px]">Payment Mode</label>
                                        </div>
                                        <div className="relative custom-dropdown-container mt-1">
                                          <CustomDropdown
                                            options={pmOptions}
                                            value={installments[0]?.paymentMode || 'Cash'}
                                            onChange={(val: any) => {
                                              const newInst = [...installments];
                                              if (newInst.length === 0) newInst.push({ amount: '', date: new Date().toISOString().split('T')[0], paymentMode: 'Cash' });
                                              newInst[0].paymentMode = val;
                                              setInstallments(newInst);
                                            }}
                                            placeholder="Select Payment Mode"
                                          />
                                        </div>
                                      </motion.div>
                                    </React.Fragment>
                                  ) : (
                                    <motion.div key="multi-installment" layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} className="md:col-span-12 flex flex-col gap-1.5">
                                      <div className="flex justify-between items-center h-[20px]">
                                        <label className="text-[0.75rem] font-bold text-slate-600 uppercase tracking-[0.5px]">Payments & Installments</label>
                                        <button
                                          type="button"
                                          onClick={() => setInstallments([...installments, { amount: '', date: new Date().toISOString().split('T')[0], paymentMode: 'Cash' }])}
                                          className="text-[0.7rem] font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1 transition-colors bg-orange-50 px-3 py-1.5 rounded-lg -mr-1"
                                        >
                                          <i className="ph-bold ph-plus"></i> Add Installment
                                        </button>
                                      </div>

                                      <div className="flex flex-col gap-3 mt-1">
                                        {installments.map((inst, idx) => (
                                          <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                                            <div className="flex-[1.5] relative w-full">
                                              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[0.95rem] z-10 pointer-events-none">₹</div>
                                              <input type="text" value={inst.amount || ''} onChange={(e) => {
                                                const newInst = [...installments];
                                                newInst[idx].amount = e.target.value.replace(/[^0-9.]/g, '');
                                                setInstallments(newInst);
                                              }} className="flex h-[42px] w-full rounded-xl border border-gray-200 bg-white pl-8 pr-3 py-2 text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" placeholder="Amount" />
                                            </div>
                                            <div className="w-full sm:w-[130px] shrink-0 h-[42px] relative">
                                              <DatePickerInput
                                                value={inst.date ? new Date(inst.date).toISOString().split('T')[0] : ''}
                                                onChange={(val: any) => {
                                                  const newInst = [...installments];
                                                  newInst[idx].date = val;
                                                  setInstallments(newInst);
                                                }}
                                              />
                                            </div>
                                            <div className="w-full sm:w-[130px] shrink-0 h-[42px] relative custom-dropdown-container">
                                              <CustomDropdown
                                                options={pmOptions}
                                                value={inst.paymentMode || 'Cash'}
                                                onChange={(val: any) => {
                                                  const newInst = [...installments];
                                                  newInst[idx].paymentMode = val;
                                                  setInstallments(newInst);
                                                }}
                                                placeholder="Mode"
                                              />
                                            </div>
                                            <button type="button" onClick={() => {
                                              if (installments.length === 2) {
                                                setIsMultiInstallment(false);
                                              }
                                              handleDeleteInstallment(idx);
                                            }} className="w-[42px] h-[42px] shrink-0 rounded-xl bg-white border border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition-colors">
                                              <i className="ph-bold ph-trash"></i>
                                            </button>
                                          </motion.div>
                                        ))}
                                      </div>
                                      <div className="text-[0.8rem] text-slate-500 font-bold bg-slate-100 rounded-lg px-3 py-2 mt-1 w-fit border border-slate-200">
                                        Total Advance: <span className="text-slate-800">₹{installments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0).toLocaleString('en-IN')}</span>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </React.Fragment>
                            );
                          }

                          return (
                            <React.Fragment key={field.id}>
                              {section.id === 'sec_job_financial' && fieldName === 'package' && (
                                <div className="flex flex-col gap-3 w-full md:col-span-12 mb-4">
                                  <label className="text-[0.75rem] font-bold text-slate-500 uppercase tracking-[1px]">Rates per Job</label>
                                  <div className="flex flex-col gap-2">
                                    {Object.keys(repeatableData).flatMap(secKey => {
                                      const repSection = layoutSchema?.sections?.find((s: any) => `rep_${s.id}` === secKey);
                                      return (repeatableData[secKey] || []).map((entry, idx) => {
                                        let catFieldKey, sizeFieldKey, qtyFieldKey;

                                        if (repSection && repSection.fields) {
                                          catFieldKey = Object.keys(entry).find(k => {
                                            const f = repSection.fields.find((field: any) => (standardFieldMap[field.id] || field.id) === k);
                                            return f && (f.name.toLowerCase().includes('category') || f.name.toLowerCase().includes('job'));
                                          });
                                          sizeFieldKey = Object.keys(entry).find(k => {
                                            const f = repSection.fields.find((field: any) => (standardFieldMap[field.id] || field.id) === k);
                                            return f && f.name.toLowerCase().includes('size');
                                          });
                                          qtyFieldKey = Object.keys(entry).find(k => {
                                            const f = repSection.fields.find((field: any) => (standardFieldMap[field.id] || field.id) === k);
                                            return f && (f.name.toLowerCase().includes('qty') || f.name.toLowerCase().includes('quantity'));
                                          });
                                        }

                                        // Fallback to old behavior if not found
                                        if (!catFieldKey) catFieldKey = Object.keys(entry).find(k => k.toLowerCase().includes('category') || k.toLowerCase().includes('job'));
                                        if (!sizeFieldKey) sizeFieldKey = Object.keys(entry).find(k => k.toLowerCase().includes('size'));
                                        if (!qtyFieldKey) qtyFieldKey = Object.keys(entry).find(k => k.toLowerCase().includes('qty') || k.toLowerCase().includes('quantity'));

                                        if (!catFieldKey || !entry[catFieldKey]) return null;

                                        const catName = entry[catFieldKey];
                                        const sizeVal = sizeFieldKey ? entry[sizeFieldKey] : '';
                                        const qtyVal = qtyFieldKey ? entry[qtyFieldKey] : '';

                                        const extras = [];
                                        if (sizeVal) extras.push(sizeVal);
                                        if (qtyVal) extras.push(`Qty: ${qtyVal}`);
                                        const extraText = extras.length > 0 ? ` (${extras.join(', ')})` : '';

                                        return (
                                          <div key={`${secKey}_${idx}`} className="flex items-center justify-between bg-slate-50/80 hover:bg-slate-50 transition-colors border border-slate-100/50 rounded-2xl p-2.5 sm:p-3">
                                            <div className="flex items-center gap-3 sm:gap-4">
                                              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-[14px] bg-white border border-slate-200/60 flex items-center justify-center shrink-0 shadow-sm text-blue-600">
                                                <i className="ph-fill ph-receipt text-[1.1rem] sm:text-[1.2rem]"></i>
                                              </div>
                                              <span className="text-[0.95rem] sm:text-[1.05rem] font-semibold text-slate-800">{catName}{extraText}</span>
                                            </div>
                                            <div className="flex items-center gap-4 sm:gap-6">
                                              <div className="flex flex-col items-end">
                                                <span className="text-[0.65rem] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Rate</span>
                                                <div className="flex items-center relative w-[90px] sm:w-[110px]">
                                                  <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                                                    <span className="text-slate-400 font-medium text-[0.9rem]">₹</span>
                                                  </div>
                                                  <input
                                                    type="text"
                                                    className="flex h-[34px] sm:h-[36px] w-full rounded-lg bg-white border border-slate-200 pl-6 sm:pl-7 pr-2 py-1 text-[0.95rem] font-semibold text-slate-700 text-right transition-colors focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500"
                                                    value={financialRates[`${secKey}_${idx}`] || ''}
                                                    onChange={(e) => {
                                                      let val = e.target.value.replace(/[^0-9.]/g, '');
                                                      setFinancialRates(prev => ({ ...prev, [`${secKey}_${idx}`]: val }));
                                                    }}
                                                    placeholder="0"
                                                  />
                                                </div>
                                              </div>
                                              <div className="w-[1px] h-[30px] bg-slate-200 mt-3"></div>
                                              <div className="flex flex-col items-end min-w-[70px] sm:min-w-[90px] pr-1">
                                                <span className="text-[0.65rem] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1.5">Total</span>
                                                <span className="text-[1.05rem] font-bold text-slate-800 leading-none">
                                                  ₹ {((parseFloat(financialRates[`${secKey}_${idx}`]) || 0) * (parseFloat(qtyVal) || 1)).toLocaleString('en-IN')}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })
                                    })}

                                    {/* Sum of Line Items Row */}
                                    {(() => {
                                      let sumLineItems = 0;
                                      Object.keys(repeatableData).forEach(secKey => {
                                        const repSection = layoutSchema?.sections?.find((s: any) => `rep_${s.id}` === secKey);
                                        (repeatableData[secKey] || []).forEach((entry, idx) => {
                                          const rate = parseFloat(financialRates[`${secKey}_${idx}`]) || 0;
                                          let qtyFieldKey = Object.keys(entry).find(k => {
                                            if (repSection && repSection.fields) {
                                              const f = repSection.fields.find((field: any) => (standardFieldMap[field.id] || field.id) === k);
                                              if (f && (f.name.toLowerCase().includes('qty') || f.name.toLowerCase().includes('quantity'))) return true;
                                            }
                                            return k.toLowerCase().includes('qty') || k.toLowerCase().includes('quantity');
                                          });
                                          const qty = qtyFieldKey ? (parseFloat(entry[qtyFieldKey]) || 1) : 1;
                                          sumLineItems += (rate * qty);
                                        });
                                      });
                                      if (sumLineItems > 0) {
                                        return (
                                          <div className="flex items-center justify-end px-2.5 sm:px-3 pt-2 pb-1">
                                            <div className="flex items-center gap-4 sm:gap-6">
                                              <div className="flex flex-col items-end min-w-[70px] sm:min-w-[90px] pr-1">
                                                <span className="text-[1.15rem] font-black text-slate-800 leading-none">
                                                  ₹ {sumLineItems.toLocaleString('en-IN')}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                </div>
                              )}

                              {section.id === 'sec_job_financial' && fieldName === 'package' ? (
                                <div className="hidden">
                                  {renderField(field)}
                                </div>
                              ) : (
                                <div id={`field-container-${fieldName}`} className={`flex flex-col gap-1.5 ${section.id === 'sec_job_financial' ? 'w-full md:col-span-6' : (field.type === 'MULTI_LINE' ? 'md:col-span-2' : '')}`}>
                                  <div className="flex justify-between items-center">
                                    <label className="text-[0.75rem] font-bold text-slate-600 uppercase tracking-[0.5px]">
                                      {field.name} {field.mandatory && <span className="text-red-500 ml-0.5">*</span>}
                                    </label>

                                  </div>
                                  {renderField(field)}
                                  {isError && <span className="text-[0.7rem] font-semibold text-red-500 mt-1">{isError.message as string || `${field.name} is required`}</span>}
                                </div>
                              )}

                              {section.id === 'sec_job_financial' && fieldName.toLowerCase().includes('discount') && (
                                <div className="flex flex-col gap-1.5 w-full md:col-span-6">
                                  <div className="flex justify-between items-center">
                                    <label className="text-[0.75rem] font-bold text-slate-600 uppercase tracking-[0.5px]">Grand Total</label>
                                  </div>
                                  <div className="flex h-[34px] sm:h-[42px] w-full rounded-[14px] bg-slate-50 border border-slate-200 px-4 items-center justify-end shadow-inner">
                                    <span className="text-[1.15rem] font-black text-slate-800">
                                      ₹ {(() => {
                                        const pkg = parseFloat((watch('package') || '0').toString().replace(/,/g, '')) || 0;
                                        return pkg.toLocaleString('en-IN');
                                      })()}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}



                        {section.id === 'sec_job_financial' && (
                          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 flex items-center justify-between w-full md:col-span-12 mt-2 shadow-sm">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-[14px] bg-orange-100/50 flex items-center justify-center text-orange-600 border border-orange-200/50">
                                <i className="ph-fill ph-calculator text-[1.4rem]"></i>
                              </div>
                              <span className="font-bold text-slate-800 text-[1.05rem]">Outstanding Balance</span>
                            </div>
                            <span className="text-[1.6rem] font-black text-orange-600 tracking-tight">
                              ₹ {(() => {
                                const pkg = parseFloat((watch('package') || '0').toString().replace(/,/g, '')) || 0; // pkg is now grandTotal
                                const adv = installments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);
                                return Math.max(0, pkg - adv).toLocaleString('en-IN');
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-500">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-orange-500 rounded-full animate-spin mr-3"></div> Loading form layout...
              </div>
            )}
          </div>
          <div className="bg-slate-50/80 border-t border-slate-200/60 px-4 py-4 sm:px-6 sm:py-4 flex justify-between items-center rounded-b-2xl sm:rounded-b-3xl shrink-0">
            <button type="button" className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-[12px] font-bold text-[0.9rem] bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer flex items-center gap-2" onClick={() => closeJobForm()}>
              <i className="ph-bold ph-x text-[1rem]"></i> Cancel
            </button>
            <button type="button" className="px-6 py-2.5 sm:px-8 sm:py-3 rounded-[12px] font-bold text-[0.9rem] bg-blue-600 text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 hover:-translate-y-[1px] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50" disabled={isSubmitting || isSubmittingLocal} onClick={handleSubmit(onSubmit, onError)}>
              <i className="ph-bold ph-check-circle text-[1rem]"></i> {(isSubmitting || isSubmittingLocal) ? "Saving..." : job ? "Save Changes" : "Create Job"}
            </button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

export default function JobFormModal() {
  return (
    <Suspense fallback={null}>
      <JobFormModalInner />
    </Suspense>
  );
}
