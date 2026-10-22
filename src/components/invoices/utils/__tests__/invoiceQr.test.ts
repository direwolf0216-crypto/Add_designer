import { describe, expect, it } from "vitest";
import { buildInvoiceViewModel } from "../invoiceLogic";

const invoice = (amount: number) =>
  ({ id: "inv", invoiceNumber: "INV-1", jobId: "job", discount: 0, createdAt: new Date("2026-10-01"), dueDate: new Date("2026-10-10"), lineItems: [{ id: "li", description: "Flex", quantity: 1, rate: amount, amount }] }) as never;
const job = { id: "job", date: new Date("2026-10-01"), dueDate: null, location: "Chennai", packageName: "Flex", customData: {}, order: { package: 1000 }, client: { name: "Rahul", phone: "9876543210", email: "" }, assignments: [] } as never;
const income = (amount: number) => [{ id: "t", type: "INCOME", amount, deletedAt: null, date: new Date("2026-10-02") }] as never;
const GPAY = "data:image/png;base64,AAAA";
const GENERATED = "data:image/png;base64,BBBB";

describe("invoice QR codes", () => {
  it("prints the uploaded GPay QR only while a balance is due", () => {
    const due = buildInvoiceViewModel(invoice(1000), job, income(400), { business_gpay_qr: GPAY });
    expect(due.print.payQr).toEqual({ image: GPAY, caption: "Scan to pay the balance of Rs 600.00" });
    const settled = buildInvoiceViewModel(invoice(1000), job, income(1000), { business_gpay_qr: GPAY });
    expect(settled.print.payQr).toBeNull();
  });

  it("falls back to the QR generated from the UPI ID, and prints nothing without either", () => {
    expect(buildInvoiceViewModel(invoice(1000), job, [], { business_upi_id: "shop@okhdfc" }, GENERATED).print.payQr?.image).toBe(GENERATED);
    expect(buildInvoiceViewModel(invoice(1000), job, [], {}).print.payQr).toBeNull();
  });

  it("passes the uploaded review QR through; empty means the built-in one", () => {
    expect(buildInvoiceViewModel(invoice(1000), job, [], { business_review_qr: GPAY }).print.business.reviewQr).toBe(GPAY);
    expect(buildInvoiceViewModel(invoice(1000), job, [], {}).print.business.reviewQr).toBe("");
  });
});
