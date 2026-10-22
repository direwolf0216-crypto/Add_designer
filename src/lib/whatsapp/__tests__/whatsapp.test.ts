import { describe, expect, it } from "vitest";
import { chatIdFor, normalizePhone, phoneFromChatId } from "../phone";
import { DEFAULT_RULES, mergeRules, renderTemplate } from "../templates";

describe("whatsapp phone numbers", () => {
  it("normalises Indian numbers in the formats people type", () => {
    expect(normalizePhone("+91 73737 87172")).toBe("917373787172");
    expect(normalizePhone("073737 87172")).toBe("917373787172");
    expect(normalizePhone("7373787172")).toBe("917373787172");
    expect(normalizePhone("0091 7373787172")).toBe("917373787172");
    expect(normalizePhone("9876543210", "971")).toBe("9719876543210");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(chatIdFor("917373787172")).toBe("917373787172@c.us");
    expect(phoneFromChatId("917373787172@c.us")).toBe("917373787172");
  });
});

describe("whatsapp templates", () => {
  it("fills placeholders and leaves typos visible", () => {
    expect(renderTemplate("Hi {customer}, job {job} is {status}. {nope}", { customer: "Rahul", job: "#J-1", status: "Printing" })).toBe("Hi Rahul, job #J-1 is Printing. {nope}");
    expect(renderTemplate("Pay {balance} to {upi}", { balance: "Rs 600", upi: "" })).toBe("Pay Rs 600 to");
  });

  it("merges saved rules over the defaults", () => {
    const r = mergeRules({ customer: { stages: ["Delivered"] }, templates: { paymentDue: "Custom {balance}" }, defaultCountryCode: "x" });
    expect(r.customer.stages).toEqual(["Delivered"]);
    expect(r.customer.jobCreated).toBe(true);
    expect(r.templates.paymentDue).toBe("Custom {balance}");
    expect(r.templates.assigned).toBe(DEFAULT_RULES.templates.assigned);
    expect(r.defaultCountryCode).toBe("91");
  });
});
