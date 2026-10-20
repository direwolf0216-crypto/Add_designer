import { NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import prisma from '@/lib/prisma';
import { notFound, route } from '@/lib/api/http';
import { requirePermission } from '@/lib/auth/session';
import InvoiceDocument from '@/components/invoices/InvoiceDocument';
import { initFonts } from '@/components/invoices/theme/invoiceTheme';
import { buildInvoiceViewModel } from '@/components/invoices/utils/invoiceLogic';

const INVOICE_SETTING_KEYS = [
  'studio_upi_id',
  'studio_bank_name',
  'studio_name',
  'studio_phone',
  'studio_email',
  'studio_address',
  'studio_instagram',
  'studio_website',
];

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requirePermission('manage_transactions');
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
  if (settings.studio_upi_id) {
    const upi = new URLSearchParams({ pa: settings.studio_upi_id, pn: settings.studio_bank_name || 'Studio' });
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
  if (typeof fileId === 'string' && fileId) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    heroImageUrl = `${baseUrl}/api/integrations/google/thumbnail?fileId=${encodeURIComponent(fileId)}`;
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
