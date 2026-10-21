// Client-side shape of a transaction as returned by /api/transactions and /api/transactions/overview.
export interface TransactionRecord {
  id: string;
  transactionId?: string;
  date: string;
  type: string;
  category: string;
  amount: number;
  paymentMode?: string;
  description?: string | null;
  status?: string;
  groupId?: string | null;
  productOrderId?: string | null;
  jobId?: string | null;
  attachmentUrl?: string | null;
  customData?: unknown;
}
