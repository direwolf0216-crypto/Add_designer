import { describe, expect, it } from "vitest";
import { buildInvoiceViewModel } from "../invoiceLogic";
import { DEFAULT_LAYOUTS } from "@/lib/defaultLayouts";

const invoice = { id: "inv", invoiceNumber: "INV-1", jobId: "job", discount: 0, createdAt: new Date("2026-10-01"), dueDate: new Date("2026-10-10"), lineItems: [{ id: "li", description: "Flex", quantity: 1, rate: 600, amount: 600 }] } as never;
const jobWith = (over: Record<string, unknown>) =>
  ({ id: "job", date: new Date("2026-10-01"), dueDate: null, location: "", packageName: "Flex", customData: {}, order: { package: 600 }, client: { name: "Nandha", phone: "4567856789", email: "" }, assignments: [], ...over }) as never;
const rows = (job: never, layout: unknown = null) => buildInvoiceViewModel(invoice, job, [], {}, undefined, layout as never).print.billTo.rows;

// A shop's own layout: its own labels and order, the address in a separate "Client Info" section.
const shopLayout = {
  sections: [
    { id: "sec_client", title: "Customer", fields: [
      { id: "fld_b_phone", name: "Mobile", type: "PHONE" },
      { id: "fld_b_client", name: "Customer name", type: "SINGLE_LINE" },
      { id: "fld_b_email", name: "Mail", type: "EMAIL" },
    ] },
    { id: "sec_job_event", title: "Job Details", isRepeatable: true, fields: [{ id: "fld_b_location", name: "Delivery at", type: "SINGLE_LINE" }] },
    { id: "sec_client_info", title: "Client Info", fields: [
      { id: "fld_addr", name: "Billing address", type: "MULTI_LINE" },
      { id: "fld_gst", name: "GSTIN", type: "SINGLE_LINE" },
      { id: "fld_logo", name: "Logo", type: "FILE" },
    ] },
  ],
};

describe("Bill To", () => {
  it("uses the layout's own labels and order, and prints nothing empty", () => {
    const job = jobWith({ location: "Chennai", customData: { fld_addr: "Mela bazar, Tenkasi", fld_gst: "N/A", fld_logo: "x.png" } });
    expect(rows(job, shopLayout)).toEqual([
      { label: "Mobile", value: "4567856789" },
      { label: "Name", value: "Nandha" },
      { label: "Delivery at", value: "Chennai" },
      { label: "Billing address", value: "Mela bazar, Tenkasi" },
    ]);
  });

  it("follows renamed fields without any code change (the customer's name always reads Name)", () => {
    const renamed = structuredClone(shopLayout);
    renamed.sections[0].fields[1].name = "Name / Company";
    renamed.sections[0].fields[2].name = "E-mail";
    const job = jobWith({ client: { name: "Kavi Prints", phone: "", email: "kavi@x.in" } });
    expect(rows(job, renamed)).toEqual([
      { label: "Name", value: "Kavi Prints" },
      { label: "E-mail", value: "kavi@x.in" },
    ]);
  });

  it("still prints a location the job holds when the shop's layout has no field for it", () => {
    const noLocation = { sections: [shopLayout.sections[0]] };
    const def = DEFAULT_LAYOUTS.find((l) => l.formKey === "JOB_FORM")!.schema.sections.flatMap((s) => s.fields);
    expect(rows(jobWith({ location: "Tenkasi" }), noLocation)).toEqual([
      { label: "Mobile", value: "4567856789" },
      { label: "Name", value: "Nandha" },
      { label: def.find((f) => f.id === "fld_b_location")!.name, value: "Tenkasi" },
    ]);
  });

  it("falls back to the built-in layout's labels when the shop has none saved", () => {
    const def = DEFAULT_LAYOUTS.find((l) => l.formKey === "JOB_FORM")!.schema.sections.flatMap((s) => s.fields);
    const label = (id: string) => def.find((f) => f.id === id)!.name;
    expect(rows(jobWith({ location: "Tenkasi" }))).toEqual([
      { label: "Name", value: "Nandha" },
      { label: label("fld_b_phone"), value: "4567856789" },
      { label: label("fld_b_location"), value: "Tenkasi" },
    ]);
  });
});
