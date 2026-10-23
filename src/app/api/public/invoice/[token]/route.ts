import { NextResponse } from "next/server";
import { renderInvoicePdf } from "@/lib/invoices/renderInvoicePdf";
import { invoiceLinkSecret, verifyInvoiceToken } from "@/lib/invoices/shareLink";

export const dynamic = "force-dynamic";

const gone = () =>
  new NextResponse("This invoice link is invalid or has expired. Please ask the shop for a new one.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });

/** A customer's invoice PDF from a signed link (no account needed); see lib/invoices/shareLink. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invoiceId = verifyInvoiceToken(token, invoiceLinkSecret());
  if (!invoiceId) return gone();
  try {
    const pdf = await renderInvoicePdf(invoiceId);
    if (!pdf) return gone();
    return new NextResponse(pdf.stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${pdf.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    console.error("[public invoice]", e);
    return new NextResponse("Couldn't open the invoice right now. Please try again.", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
