import { NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import prisma from '@/lib/prisma';
import { notFound, route } from '@/lib/api/http';
import { requirePermission } from '@/lib/auth/session';
import { getGoogleDriveToken } from '@/lib/googleDriveAuth';
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
];

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requirePermission('manage_transactions');
  const { id: invoiceId } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true },
  });
  if (!invoice || invoice.deletedAt) throw notFound('Invoice not found');

  const job = await prisma.job.findUnique({
    where: { id: invoice.jobId },
    include: { client: true },
  });
  if (!job || job.deletedAt) throw notFound('Associated job not found');

  const [transactions, settingsRecords] = await Promise.all([
    prisma.transaction.findMany({ where: { jobId: job.id, type: 'INCOME', deletedAt: null } }),
    prisma.systemSetting.findMany({ where: { key: { in: INVOICE_SETTING_KEYS } } }),
  ]);
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
  if (typeof fileId === 'string' && /^[\w-]{10,200}$/.test(fileId)) {
    heroImageUrl = await driveImageDataUrl(fileId, user.id);
  }

  const viewModel = buildInvoiceViewModel(invoice, job, transactions, settings, qrCodeDataUrl);
  if (heroImageUrl) viewModel.heroImageUrl = heroImageUrl;

  initFonts();
  const stream = await renderToStream(InvoiceDocument({ viewModel }) as Parameters<typeof renderToStream>[0]);

  const headers = new Headers();
  headers.set('Content-Type', 'application/pdf');
  headers.set('Content-Disposition', `inline; filename="${invoice.invoiceNumber.replace(/[^\w.-]/g, '_')}.pdf"`);
  headers.set('Cache-Control', 'private, no-store');

  return new NextResponse(stream as unknown as ReadableStream, { headers });
});

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
