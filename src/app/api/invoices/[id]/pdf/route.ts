import { NextResponse } from 'next/server';
import { notFound, route } from '@/lib/api/http';
import { requirePermission } from '@/lib/auth/session';
import { jobScope } from '@/lib/jobs/scope';
import { renderInvoicePdf } from '@/lib/invoices/renderInvoicePdf';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requirePermission('create_transactions');
  const { id: invoiceId } = await params;
  const pdf = await renderInvoicePdf(invoiceId, { jobWhere: await jobScope(user), driveUserId: user.id });
  if (!pdf) throw notFound('Invoice not found');

  const headers = new Headers();
  headers.set('Content-Type', 'application/pdf');
  headers.set('Content-Disposition', `inline; filename="${pdf.filename}"`);
  headers.set('Cache-Control', 'private, no-store');
  return new NextResponse(pdf.stream as unknown as ReadableStream, { headers });
});
