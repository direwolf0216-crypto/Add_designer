import { InvoiceStatus } from './invoiceStatus';
import { SummaryRow } from './summaryRow';
import { PaymentProgress } from './paymentProgress';

export interface InvoiceLineItemVM {
  description: string;
  qty: number;
  unitPrice: string;
  total: string;
}

/** One printed row of the items table (all values already formatted). */
export interface PrintLineItem {
  description: string;
  size: string;
  qty: string;
  rate: string;
  amount: string;
}

/** Everything the printed (A4) invoice shows, taken from the job, its payments and the shop's settings. */
export interface PrintInvoice {
  business: {
    name: string;
    addressLines: string[];
    phones: string[];
    email: string;
    website: string;
    gstin: string;
    /** Only the bank fields that are filled in; empty when no bank details are set. */
    bank: { label: string; value: string }[];
  };
  billTo: {
    name: string;
    lines: string[];
    phone: string;
    email: string;
  };
  dueDate: string;
  items: PrintLineItem[];
  /** Rows above the total box: sub total, discount and (when a GST rate is set) CGST / SGST. */
  summary: { label: string; value: string }[];
  total: string;
  paid: string;
  balance: string;
  /** True when something has been paid, so the paid/balance line is worth printing. */
  showPayments: boolean;
  amountInWords: string;
}

export interface SummaryCardVariant {
  theme: 'dark' | 'success';
  title: string;
  amount: string;
  subLabel: string;
}

export interface InvoiceViewModel {
  invoiceNumber: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  
  fromName: string;
  fromPhone: string;
  fromEmail: string;
  fromAddress: string;
  
  formattedInvoiceDate: string;
  formattedDueDate: string;
  
  jobDate: string;
  location: string;
  packageName: string;
  assignees: string;
  
  status: InvoiceStatus;
  statusText: string;
  statusColor: string;
  
  heroImageUrl: string;
  qrCodeDataUrl: string;
  
  items: InvoiceLineItemVM[];
  
  summaryCardVariant: SummaryCardVariant;
  summaryRows: SummaryRow[];
  paymentProgress: PaymentProgress;
  
  footerMode: 'payment' | 'review';
  footerNotes: string[];
  
  socials: {
    instagram: string;
    website: string;
    phone: string;
    email: string;
  };
  
  settings: Record<string, string>;

  print: PrintInvoice;
}
