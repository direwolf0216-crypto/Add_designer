import { Invoice, Job, Transaction, InvoiceLineItem, Client } from '@prisma/client';
import { InvoiceViewModel, InvoiceLineItemVM, SummaryCardVariant } from '../types/invoiceViewModel';
import { InvoiceStatus } from '../types/invoiceStatus';
import { SummaryRow } from '../types/summaryRow';
import { PaymentProgress, PaymentStep } from '../types/paymentProgress';
import { formatCurrency } from './currency';
import { formatDate } from './date';
import { INVOICE_CONSTANTS } from '../theme/constants';
import { colors } from '../theme/invoiceTheme';
import { assets } from './assetRegistry';

type FullJob = Job & { client: Client };
type FullInvoice = Invoice & { lineItems: InvoiceLineItem[] };

export const buildInvoiceViewModel = (
  invoice: FullInvoice,
  job: FullJob,
  transactions: Transaction[],
  settings: Record<string, string>,
  qrCodeDataUrl?: string
): InvoiceViewModel => {
  
  // Calculate Totals (Removed GST completely)
  const safeNumber = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val.toNumber === 'function') return val.toNumber();
    if (typeof val === 'string') return Number(val) || 0;
    return Number(val) || 0;
  };
  
  const subtotal = invoice.lineItems.reduce((acc, item) => acc + safeNumber(item.amount), 0);
  const discount = safeNumber(invoice.discount);
  const total = subtotal - discount;
  
  // Calculate Paid and Balance
  const amountPaid = transactions
    .filter(t => t.status === 'SETTLED' || t.status === 'COMPLETED')
    .reduce((acc, t) => acc + safeNumber(t.amount), 0);
    
  let balanceDue = total - amountPaid;
  if (balanceDue < 0) balanceDue = 0; // clamp display

  // Determine Status
  let status: InvoiceStatus = 'PENDING';
  if (balanceDue === 0 && total > 0) {
    status = 'PAID';
  } else if (amountPaid > 0 && balanceDue > 0) {
    status = 'PARTIALLY_PAID';
  } else if (new Date() > new Date(job.date) && balanceDue > 0) {
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
  
  const sortedTransactions = [...transactions]
    .filter(t => t.status === 'SETTLED' || t.status === 'COMPLETED')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedTransactions.forEach((t, i) => {
    steps.push({
      label: i === 0 ? 'Advance' : `Payment ${i + 1}`,
      amount: formatCurrency(safeNumber(t.amount)),
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

  // Hero Image resolution hierarchy: Album Cover -> Job Thumbnail -> Fallback Placeholder
  const heroImageUrl = (job.customData as any)?.albumCoverUrl || (job.customData as any)?.thumbnailUrl || assets.photoPlaceholder;

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
    'Balance to be cleared before the event or delivery.',
    'Album delivery within 30 working days after the event.',
    'Raw photos/videos will not be shared.',
    'Cancellation 15 days before the event is non-refundable.'
  ];

  return {
    invoiceNumber: invoice.invoiceNumber,
    clientName: job.client.name,
    clientPhone: job.client.phone,
    clientEmail: job.client.email || 'N/A',
    clientAddress: 'N/A',
    
    fromName: settings.studio_name || 'Add designer',
    fromPhone: settings.studio_phone || '+91 790 715 6100',
    fromEmail: settings.studio_email || 'hello@adddesigner.com',
    fromAddress: settings.studio_address || 'Calicut, Kerala 673001',
    
    formattedInvoiceDate: formatDate(invoice.createdAt),
    formattedDueDate: formatDate(job.date), 
    
    eventDate: formatDate(job.date),
    venue: job.location || 'N/A',
    packageName: job.packageName || 'N/A',
    photographers: job.photographers ? String(job.photographers) : 'Team Add designer',
    
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
      instagram: settings.studio_instagram || 'instagram.com/adddesigner',
      website: settings.studio_website || 'www.adddesigner.com',
      phone: settings.studio_phone || '+91 790 715 6100',
      email: settings.studio_email || 'hello@adddesigner.com',
    },
    
    settings
  };
};
