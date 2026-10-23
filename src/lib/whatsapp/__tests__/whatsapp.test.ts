import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, waChatUrl } from "../phone";
import { CHAT_TEMPLATES, renderTemplate, withoutMissing } from "../templates";

describe("whatsapp phone numbers", () => {
  it("normalises Indian numbers in the formats people type", () => {
    expect(normalizePhone("+91 73737 87172")).toBe("917373787172");
    expect(normalizePhone("073737 87172")).toBe("917373787172");
    expect(normalizePhone("7373787172")).toBe("917373787172");
    expect(normalizePhone("0091 7373787172")).toBe("917373787172");
    expect(normalizePhone("(737) 378-7172")).toBe("917373787172");
    expect(normalizePhone("9876543210", "971")).toBe("9719876543210");
  });

  it("rejects what WhatsApp can't use", () => {
    for (const bad of ["12345", "", "   ", "abc", "0000", "1234567890123456"]) expect(normalizePhone(bad)).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(9876543210)).toBeNull();
  });

  it("formats numbers for display", () => {
    expect(formatPhone("917373787172")).toBe("+91 73737 87172");
    expect(formatPhone("9719876543210")).toBe("+9719876543210");
  });
});

describe("click-to-chat links", () => {
  it("opens the chat with the message typed in, safely encoded", () => {
    expect(waChatUrl("917373787172", "Hi Rahul, ₹600 due & 10% off? #J-1\nThanks")).toBe(
      `https://wa.me/917373787172?text=${encodeURIComponent("Hi Rahul, ₹600 due & 10% off? #J-1\nThanks")}`
    );
    const text = new URL(waChatUrl("917373787172", "a&b=c?d#e")).searchParams.get("text");
    expect(text).toBe("a&b=c?d#e");
  });

  it("opens a blank chat when there's no text", () => {
    expect(waChatUrl("917373787172")).toBe("https://wa.me/917373787172");
    expect(waChatUrl("917373787172", "   ")).toBe("https://wa.me/917373787172");
  });
});

describe("whatsapp templates", () => {
  it("fills placeholders and leaves typos visible", () => {
    expect(renderTemplate("Hi {customer}, job {job} is {status}. {nope}", { customer: "Rahul", job: "#J-1", status: "Printing" })).toBe("Hi Rahul, job #J-1 is Printing. {nope}");
  });

  it("drops the UPI and phone sentences when the shop hasn't set them", () => {
    const vars = { customer: "Rahul", job: "#J-1", balance: "₹600", total: "₹1,000", paid: "₹400", shop: "Add designer", upi: "", phone: "" };
    expect(renderTemplate(withoutMissing(CHAT_TEMPLATES.paymentDue, vars), vars)).toBe(
      "Hi Rahul, a gentle reminder from Add designer: job #J-1 has a balance of ₹600 (total ₹1,000, paid ₹400). Thank you!"
    );
    expect(renderTemplate(withoutMissing(CHAT_TEMPLATES.stageChanged, { ...vars, status: "Ready for Delivery" }), { ...vars, status: "Ready for Delivery" })).toBe(
      "Hi Rahul, an update on job #J-1: it is now Ready for Delivery. — Add designer"
    );
    const withUpi = { ...vars, upi: "shop@okhdfc", phone: "98765 43210" };
    expect(renderTemplate(withoutMissing(CHAT_TEMPLATES.paymentDue, withUpi), withUpi)).toContain("You can pay by UPI to shop@okhdfc.");
  });

  it("keeps amounts out of the confirmation for people who can't see them", () => {
    expect(CHAT_TEMPLATES.jobCreatedNoAmounts).not.toMatch(/\{(total|paid|balance)\}/);
    expect(CHAT_TEMPLATES.stageChanged).not.toMatch(/\{(total|paid|balance)\}/);
  });

  it("sends the invoice link on its own line, with the balance or a thank-you when paid", () => {
    const base = { customer: "Rahul", job: "#J-1", shop: "Add designer", invoice: "INV-0007", link: "https://x.app/api/public/invoice/t", total: "₹1,000", paid: "₹400", balance: "₹600", upi: "shop@okhdfc" };
    expect(renderTemplate(withoutMissing(CHAT_TEMPLATES.invoice, base), base)).toBe(
      "Hi Rahul, here is your invoice INV-0007 from Add designer for job #J-1:\nhttps://x.app/api/public/invoice/t\nTotal ₹1,000, paid ₹400, balance ₹600. You can pay by UPI to shop@okhdfc. Thank you!"
    );
    const noUpi = { ...base, upi: "" };
    expect(renderTemplate(withoutMissing(CHAT_TEMPLATES.invoice, noUpi), noUpi)).toMatch(/balance ₹600\. Thank you!$/);
    expect(renderTemplate(CHAT_TEMPLATES.invoicePaid, { ...base, paid: "₹1,000", balance: "₹0" })).toMatch(/\nTotal ₹1,000, fully paid\. Thank you for your business!$/);
  });
});
