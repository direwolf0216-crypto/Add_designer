import 'server-only';
import type { Prisma } from '@prisma/client';
import { renderToStream } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import prisma from '@/lib/prisma';
import { getGoogleDriveToken } from '@/lib/googleDriveAuth';
import type { PricingRules } from '@/lib/jobs/pricing';
import type { FormLayout } from '@/lib/forms/types';
import InvoiceDocument from '@/components/invoices/InvoiceDocument';
import { initFonts } from '@/components/invoices/theme/invoiceTheme';
import { buildInvoiceViewModel } from '@/components/invoices/utils/invoiceLogic';

const INVOICE_SETTING_KEYS = [
  'business_upi_id',
  'business_bank_name',
  'business_name',
  'business_phone',
  'business_email',
  'business_address',
  'business_instagram',
  'business_website',
  'business_phone_2',
  'business_gstin',
  'business_gst_rate',
  'business_bank_account_name',
  'business_bank_account_no',
  'business_bank_ifsc',
  'business_bank_branch',
  'business_tagline',
  'business_logo',
  'business_review_qr',
  'business_gpay_qr',
];

/**
 * The printed invoice as a PDF stream, or null when the invoice (or its job, within `jobWhere`) is
 * gone. Staff downloads pass their job scope and their id (for the job's Drive photo); a customer's
 * shared link passes neither, so the photo is left off.
 */
export async function renderInvoicePdf(
  invoiceId: string,
  opts: { jobWhere?: Prisma.JobWhereInput; driveUserId?: string } = {}
): Promise<{ stream: NodeJS.ReadableStream; filename: string } | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true },
  });
  if (!invoice || invoice.deletedAt) return null;

  const job = await prisma.job.findFirst({
    where: { id: invoice.jobId, deletedAt: undefined, ...(opts.jobWhere ?? {}) },
    include: { client: true, order: true, assignments: { select: { user: { select: { name: true } } } } },
  });
  if (!job || job.deletedAt) return null;

  const [transactions, settingsRecords, layoutRecord, pricingRecord] = await Promise.all([
    prisma.transaction.findMany({ where: { jobId: job.id, type: 'INCOME', deletedAt: null } }),
    prisma.systemSetting.findMany({ where: { key: { in: INVOICE_SETTING_KEYS } } }),
    // The job form's layout says which fields hold each line item's category, size and quantity.
    prisma.formLayout.findUnique({ where: { formKey: 'JOB_FORM' }, select: { schema: true } }),
    prisma.systemSetting.findUnique({ where: { key: 'pricing_rules' }, select: { value: true } }),
  ]);
  const pricingRules = (pricingRecord?.value && typeof pricingRecord.value === 'object' && !Array.isArray(pricingRecord.value) ? pricingRecord.value : {}) as PricingRules;
  const settings: Record<string, string> = {};
  for (const s of settingsRecords) {
    if (typeof s.value === 'string' || typeof s.value === 'number') settings[s.key] = String(s.value);
  }

  let qrCodeDataUrl = '';
  if (settings.business_upi_id) {
    const upi = new URLSearchParams({ pa: settings.business_upi_id, pn: settings.business_bank_name || 'Add designer' });
    qrCodeDataUrl = await QRCode.toDataURL(`upi://pay?${upi.toString()}`, {
      margin: 1,
      width: 200,
      color: { dark: '#000000', light: '#ffffff' },
    });
  }

  // Hero image from the job's first Drive attachment, if any.
  let heroImageUrl = '';
  const attachments = (Array.isArray(job.attachments) ? job.attachments : []) as { id?: unknown; fileId?: unknown }[];
  const driveFile = attachments.find((a) => a && typeof a === 'object' && (a.id || a.fileId));
  const fileId = driveFile?.id || driveFile?.fileId;
  if (opts.driveUserId && typeof fileId === 'string' && /^[\w-]{10,200}$/.test(fileId)) {
    heroImageUrl = await driveImageDataUrl(fileId, opts.driveUserId);
  }

  const viewModel = buildInvoiceViewModel(invoice, job, transactions, settings, qrCodeDataUrl, layoutRecord?.schema as FormLayout | null, pricingRules);
  if (heroImageUrl) viewModel.heroImageUrl = heroImageUrl;

  initFonts();
  const stream = await renderToStream(InvoiceDocument({ viewModel }) as Parameters<typeof renderToStream>[0]);
  return { stream, filename: `${invoice.invoiceNumber.replace(/[^\w.-]/g, '_')}.pdf` };
}

const HERO_IMAGE_TYPES = new Set(['image/png', 'image/jpeg']);
const HERO_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Download a Drive image with the requesting user's token and inline it as a data URL. The PDF renderer
 * runs server-side without the user's cookies, so it can't go through the thumbnail proxy. Any failure
 * just omits the image.
 */
async function driveImageDataUrl(fileId: string, userId: string): Promise<string> {
  try {
    const token = await getGoogleDriveToken(userId);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!res.ok || !HERO_IMAGE_TYPES.has(type)) return '';
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength > HERO_IMAGE_MAX_BYTES) return '';
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch {
    return '';
  }
}
