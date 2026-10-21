import { Invoice, Job, Transaction, InvoiceLineItem, Client } from '@prisma/client';
import { InvoiceViewModel, InvoiceLineItemVM, SummaryCardVariant, PrintInvoice, PrintLineItem } from '../types/invoiceViewModel';
import { amountInWords } from './amountInWords';
import { normalizeJob, resolveJobSummary, resolveSpecEntries } from '@/lib/jobs/resolveJobFields';
import { JOB_DETAILS_FIELD_MAP } from '@/lib/forms/fieldMap';
import type { FormLayout } from '@/lib/forms/types';
import { InvoiceStatus } from '../types/invoiceStatus';
import { SummaryRow } from '../types/summaryRow';
import { PaymentStep } from '../types/paymentProgress';
import { formatCurrency } from './currency';
import { formatDate } from './date';
import { colors } from '../theme/invoiceTheme';
import { assets } from './assetRegistry';
import { computeBalance, round2 } from '@/lib/money';
import { businessTodayUtc } from '@/lib/dates';
import { BUSINESS_DETAILS } from '@/lib/constants';

type FullJob = Job & { client: Client; assignments?: { user: { name: string | null } }[] };
type FullInvoice = Invoice & { lineItems: InvoiceLineItem[] };

/** "1,250.00" (Indian grouping, always two decimals). */
const amount2 = (n: number) => round2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "Rs 1,250.00": the PDF fonts have no rupee glyph. */
const rs = (n: number) => `Rs ${amount2(n)}`;
const num = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const present = (v: unknown) => {
  const t = text(v);
  return t && t !== 'N/A' ? t : '';
};

/** An address on two lines at most: split at line breaks or "|", else after the first comma pair. */
function splitAddress(address: string): string[] {
  const explicit = address.split(/\r?\n|\|/).map((l) => l.trim()).filter(Boolean);
  if (explicit.length > 1) return explicit;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return explicit;
  const cut = Math.ceil(parts.length / 2);
  return [`${parts.slice(0, cut).join(', ')},`, parts.slice(cut).join(', ')];
}

/**
 * The printed invoice's content. Items come from the job's line items (category, size, quantity, rate)
 * as the job form saved them, else the invoice's own stored rows. Shop details come only from settings:
 * a line that isn't set is left off rather than filled with an example.
 */
function buildPrintInvoice(
  invoice: FullInvoice,
  job: FullJob,
  payments: { amount: number }[],
  settings: Record<string, string>,
  layout: FormLayout | null | undefined
): PrintInvoice {
  const cd = (job.customData && typeof job.customData === 'object' ? job.customData : {}) as Record<string, unknown>;
  const details = normalizeJob(job as unknown as Record<string, unknown>);
  const summary = resolveJobSummary(details, layout, JOB_DETAILS_FIELD_MAP);
  const specs = resolveSpecEntries(details, layout, JOB_DETAILS_FIELD_MAP, summary);
  // Older jobs keep quantity/size under loose keys ("field_qty"); use them when the layout lookup found nothing.
  const looseKey = (re: RegExp) => {
    const k = Object.keys(cd).find((key) => re.test(key) && present(cd[key]));
    return k ? cd[k] : undefined;
  };
  if (specs.length === 1) {
    if (!present(specs[0].quantity)) specs[0].quantity = looseKey(/qty|quantity/i);
    if (!present(specs[0].size)) specs[0].size = looseKey(/size/i);
  }

  const orderPackage = num((job as { order?: { package?: unknown } | null }).order?.package ?? cd.fld_b_package);
  const discountValue = num(cd.fld_b_discount);
  const discount = round2(Number.isFinite(discountValue) && discountValue > 0 ? discountValue : Number(invoice.discount) || 0);

  const qtyText = (q: unknown) => {
    const t = present(q);
    if (!t) return '1 No';
    const n = num(t);
    return Number.isFinite(n) ? `${n.toLocaleString('en-IN')} ${n === 1 ? 'No' : 'Nos'}` : t;
  };

  let items: PrintLineItem[] = [];
  let subTotal = 0;
  const priced = specs.length > 0 && specs.every((s) => s.total !== null);
  if (specs.length > 0 && (priced || specs.length === 1)) {
    items = specs.map((s) => {
      const qty = num(s.quantity);
      let lineTotal = s.total ?? NaN;
      // One unpriced line carries the whole job (the package is after discount).
      if (!Number.isFinite(lineTotal)) lineTotal = Number.isFinite(orderPackage) ? orderPackage + discount : 0;
      const rate = Number.isFinite(qty) && qty > 0 ? lineTotal / qty : lineTotal;
      subTotal += lineTotal;
      return {
        description: present(s.category) || present(job.category) || 'Printing job',
        size: present(s.size) || '—',
        qty: qtyText(s.quantity),
        rate: amount2(rate),
        amount: amount2(lineTotal),
      };
    });
  } else if (specs.length > 1) {
    // Several items without their own rates: list them, the job total carries the amount.
    items = specs.map((s) => ({
      description: present(s.category) || 'Printing job',
      size: present(s.size) || '—',
      qty: qtyText(s.quantity),
      rate: '—',
      amount: '—',
    }));
    subTotal = Number.isFinite(orderPackage) ? orderPackage + discount : 0;
  } else {
    items = invoice.lineItems.map((li) => ({
      description: li.description,
      size: '—',
      qty: qtyText(li.quantity),
      rate: amount2(Number(li.rate) || 0),
      amount: amount2(Number(li.amount) || 0),
    }));
    subTotal = invoice.lineItems.reduce((a, li) => a + (Number(li.amount) || 0), 0);
  }
  subTotal = round2(subTotal);

  // GST only when the shop has set a rate (split equally into CGST and SGST).
  const gstRate = num(settings.business_gst_rate);
  const taxable = round2(Math.max(0, subTotal - discount));
  const summaryRows: { label: string; value: string }[] = [
    { label: 'SUB TOTAL', value: rs(subTotal) },
    { label: 'DISCOUNT', value: rs(discount) },
  ];
  let tax = 0;
  if (Number.isFinite(gstRate) && gstRate > 0) {
    const half = round2((taxable * gstRate) / 200);
    tax = half * 2;
    const pct = `${(gstRate / 2).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
    summaryRows.push({ label: `CGST (${pct})`, value: rs(half) }, { label: `SGST (${pct})`, value: rs(half) });
  }

  const { total, paid, due } = computeBalance({ packageAmount: round2(taxable + tax), discount: 0, payments });

  const bank = [
    { label: 'Bank Name', value: present(settings.business_bank_name) },
    { label: 'A/c Name', value: present(settings.business_bank_account_name) },
    { label: 'A/c No.', value: present(settings.business_bank_account_no) },
    { label: 'IFSC Code', value: present(settings.business_bank_ifsc) },
    { label: 'Branch', value: present(settings.business_bank_branch) },
    { label: 'UPI ID', value: present(settings.business_upi_id) },
  ].filter((r) => r.value);

  const email = present(job.client.email) || present(cd.fld_b_email);
  return {
    business: {
      // Settings win; the shop's own details from lib/constants fill anything not set there.
      name: present(settings.business_name) || 'ADDESIGNER LASER PRINTER',
      addressLines: splitAddress(present(settings.business_address) || BUSINESS_DETAILS.address),
      phones: [present(settings.business_phone) || BUSINESS_DETAILS.phone, present(settings.business_phone_2)].filter(Boolean),
      email: present(settings.business_email) || BUSINESS_DETAILS.email,
      website: present(settings.business_website),
      gstin: present(settings.business_gstin),
      bank,
    },
    billTo: {
      name: job.client.name,
      lines: [present(job.location)].filter(Boolean),
      phone: present(job.client.phone) || 'N/A',
      email: email || 'N/A',
    },
    dueDate: formatDate(job.dueDate ?? job.date),
    items: items.length ? items : [{ description: 'Printing job', size: '—', qty: '1 No', rate: amount2(total), amount: amount2(total) }],
    summary: summaryRows,
    total: rs(total),
    paid: rs(paid),
    balance: rs(due),
    showPayments: paid > 0,
    amountInWords: amountInWords(total),
  };
}

export const buildInvoiceViewModel = (
  invoice: FullInvoice,
  job: FullJob,
  transactions: Transaction[],
  settings: Record<string, string>,
  qrCodeDataUrl?: string,
  layout?: FormLayout | null
): InvoiceViewModel => {
  
  // Calculate Totals (Removed GST completely)
  const safeNumber = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val.toNumber === 'function') return val.toNumber();
    if (typeof val === 'string') return Number(val) || 0;
    return Number(val) || 0;
  };
  
  const subtotal = round2(invoice.lineItems.reduce((acc, item) => acc + safeNumber(item.amount), 0));
  const discount = round2(safeNumber(invoice.discount));

  // Only money received counts against the invoice: non-deleted INCOME rows (never expenses).
  const payments = transactions
    .filter(t => t.type === 'INCOME' && !t.deletedAt)
    .map(t => ({ ...t, amount: safeNumber(t.amount) }));
  const { total, paid: amountPaid, due: balanceDue } = computeBalance({ packageAmount: subtotal, discount, payments });

  // Determine Status
  let status: InvoiceStatus = 'PENDING';
  if (balanceDue === 0 && total > 0) {
    status = 'PAID';
  } else if (amountPaid > 0 && balanceDue > 0) {
    status = 'PARTIALLY_PAID';
  } else if (businessTodayUtc() > new Date(job.date) && balanceDue > 0) {
    status = 'OVERDUE';
  }

  const statusColorMap: Record<InvoiceStatus, string> = {
    PENDING: colors.pendingOrange,
    PARTIALLY_PAID: colors.pendingOrange,
    PAID: colors.successGreen,
    OVERDUE: colors.overdueRed,
  };

  const statusTextMap: Record<InvoiceStatus, string> = {
    PENDING: 'PENDING',
    PARTIALLY_PAID: 'PARTIALLY PAID',
    PAID: 'PAID IN FULL',
    OVERDUE: 'OVERDUE',
  };

  // Build Summary Rows
  const summaryRows: SummaryRow[] = [
    { label: 'Subtotal', value: formatCurrency(subtotal) },
  ];
  if (discount > 0) {
    summaryRows.push({ label: 'Discount', value: `-${formatCurrency(discount)}` });
  }
  summaryRows.push({ label: 'Total', value: formatCurrency(total) });
  summaryRows.push({ label: 'Amount Paid', value: `-${formatCurrency(amountPaid)}` });
  summaryRows.push({ label: 'Balance Due', value: formatCurrency(balanceDue), isTotal: true });

  // Summary Card Variant
  const summaryCardVariant: SummaryCardVariant = status === 'PAID' ? {
    theme: 'success',
    title: 'PAID IN FULL',
    amount: formatCurrency(0),
    subLabel: 'Payment Completed'
  } : {
    theme: 'dark',
    title: 'AMOUNT DUE',
    amount: formatCurrency(balanceDue),
    subLabel: 'Balance to be paid'
  };

  // Build Dynamic Payment Progress Timeline
  const paymentPercentage = total > 0 ? Math.min(100, Math.round((amountPaid / total) * 100)) : 100;
  const steps: PaymentStep[] = [];
  
  const sortedTransactions = [...payments]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedTransactions.forEach((t, i) => {
    steps.push({
      label: i === 0 ? 'Advance' : `Payment ${i + 1}`,
      amount: formatCurrency(t.amount),
      completed: true,
      date: formatDate(t.date),
    });
  });

  // Add pending balance step if not fully paid
  if (balanceDue > 0) {
    steps.push({
      label: steps.length === 0 ? 'Full Payment' : steps.length === 1 ? 'Second Payment' : 'Final Payment',
      amount: formatCurrency(balanceDue),
      completed: false,
    });
  }

  // Hero Image resolution hierarchy: Job Thumbnail -> Fallback Placeholder
  const heroImageUrl = (job.customData as any)?.thumbnailUrl || assets.imagePlaceholder;

  // Build Line Items
  const items: InvoiceLineItemVM[] = invoice.lineItems.map(li => ({
    description: li.description,
    qty: li.quantity,
    unitPrice: formatCurrency(safeNumber(li.rate)),
    total: formatCurrency(safeNumber(li.amount)),
  }));

  // Append repeatable entries from customData
  const cdata = job.customData as Record<string, any>;
  if (cdata && typeof cdata === 'object') {
     Object.keys(cdata).forEach(k => {
        if (k.startsWith('rep_')) {
           const sectionName = k.replace('rep_', '').replace(/_/g, ' ');
           const arr = cdata[k];
           if (Array.isArray(arr)) {
              arr.forEach((entry, idx) => {
                 const descParts: string[] = [];
                 Object.entries(entry).forEach(([ek, ev]) => {
                    const ekName = ek.replace('fld_', '').replace('b_', '').replace(/_/g, ' ');
                    if (ev) descParts.push(`${ekName}: ${ev}`);
                 });
                 if (descParts.length > 0) {
                    items.push({
                       description: `${sectionName.toUpperCase()} Entry ${idx + 1} - ${descParts.join(', ')}`,
                       qty: 1,
                       unitPrice: formatCurrency(0),
                       total: formatCurrency(0) // Repeatable entries don't have separate amounts modeled yet
                    });
                 }
              });
           }
        }
     });
  }

  if (items.length === 0) {
    items.push({
      description: 'No items found',
      qty: 0,
      unitPrice: formatCurrency(0),
      total: formatCurrency(0),
    });
  }

  // Footer notes
  const footerNotes = [
    '50% advance is required to confirm the job.',
    'Balance to be cleared at the time of delivery.',
    'Printing starts only after the design proof is approved.',
    'Please check the proof carefully; errors approved in the proof are not our responsibility.',
    'Cancellation after printing has started is non-refundable.'
  ];

  return {
    invoiceNumber: invoice.invoiceNumber,
    clientName: job.client.name,
    clientPhone: job.client.phone,
    clientEmail: job.client.email || 'N/A',
    clientAddress: 'N/A',
    
    fromName: settings.business_name || 'Add designer',
    fromPhone: settings.business_phone || '+91 790 715 6100',
    fromEmail: settings.business_email || 'hello@adddesigner.com',
    fromAddress: settings.business_address || 'Calicut, Kerala 673001',
    
    formattedInvoiceDate: formatDate(invoice.createdAt),
    formattedDueDate: formatDate(job.date), 
    
    jobDate: formatDate(job.date),
    location: job.location || 'N/A',
    packageName: job.packageName || 'N/A',
    assignees: job.assignments?.map((a) => a.user.name).filter(Boolean).join(', ') || 'Team Add designer',
    
    status,
    statusText: statusTextMap[status],
    statusColor: statusColorMap[status],
    
    heroImageUrl,
    qrCodeDataUrl: qrCodeDataUrl || '',
    
    items,
    summaryCardVariant,
    summaryRows,
    paymentProgress: {
      percentage: paymentPercentage,
      steps
    },
    
    footerMode: status === 'PAID' ? 'review' : 'payment',
    footerNotes,
    
    socials: {
      instagram: settings.business_instagram || 'instagram.com/adddesigner',
      website: settings.business_website || 'www.adddesigner.com',
      phone: settings.business_phone || '+91 790 715 6100',
      email: settings.business_email || 'hello@adddesigner.com',
    },
    
    settings,

    print: buildPrintInvoice(invoice, job, payments, settings, layout),
  };
};
