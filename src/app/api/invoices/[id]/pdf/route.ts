import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { renderToStream } from '@react-pdf/renderer';
import InvoiceDocument from '@/components/invoices/InvoiceDocument';
import QRCode from 'qrcode';
import { initFonts } from '@/components/invoices/theme/invoiceTheme';
import { buildInvoiceViewModel } from '@/components/invoices/utils/invoiceLogic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role || 'STAFF';
    const permission = await prisma.rolePermission.findUnique({
      where: { role_permission: { role: userRole, permission: 'manage_transactions' } }
    });

    if (!permission?.enabled && userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id: invoiceId } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId, deletedAt: null },
      include: { lineItems: true }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const job = await prisma.job.findUnique({
      where: { id: invoice.jobId, deletedAt: null },
      include: { client: true }
    });

    if (!job) {
      return NextResponse.json({ error: 'Associated job not found' }, { status: 404 });
    }

    const transactions = await prisma.transaction.findMany({
      where: { jobId: job.id, deletedAt: null }
    });

    const settingsRecords = await prisma.systemSetting.findMany();
    const settings = settingsRecords.reduce((acc, s) => {
      acc[s.key] = s.value as any;
      return acc;
    }, {} as Record<string, string>);

    let qrCodeDataUrl = '';
    if (settings.studio_upi_id) {
      const upiUrl = `upi://pay?pa=${settings.studio_upi_id}&pn=${settings.studio_bank_name || 'Studio'}`;
      qrCodeDataUrl = await QRCode.toDataURL(upiUrl, { margin: 1, width: 200, color: { dark: '#000000', light: '#ffffff' } });
    }

    // Try to get hero image from Drive if attachment exists
    let heroImageUrl = '';
    const attachments = job.attachments as any;
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      // Find a Google Drive file ID
      const driveFile = attachments.find((a: any) => a.id || a.fileId);
      const fileId = driveFile?.id || driveFile?.fileId;
      if (fileId) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        heroImageUrl = `${baseUrl}/api/integrations/google/thumbnail?fileId=${fileId}`;
      }
    }

    const viewModel = buildInvoiceViewModel(
      invoice,
      job as any,
      transactions,
      settings,
      qrCodeDataUrl
    );

    if (heroImageUrl) {
      viewModel.heroImageUrl = heroImageUrl;
    }

    initFonts();
    
    const stream = await renderToStream(
      InvoiceDocument({ viewModel }) as any
    );

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);

    return new NextResponse(stream as any, { headers });

  } catch (error: any) {
    console.error('Failed to generate PDF:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
