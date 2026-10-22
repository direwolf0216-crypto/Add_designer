// Ready-made layouts for a print shop. Applying one replaces the draft (undoable); built-in field ids are
// kept so pricing, the board, invoices and reports keep working.
import { DEFAULT_LAYOUTS } from "@/lib/defaultLayouts";
import type { FormSchema } from "./types";

export interface LayoutTemplate {
  id: string;
  formKey: string;
  name: string;
  description: string;
  /** Short bullets shown on the card. */
  highlights: string[];
  schema: FormSchema;
}

const STAGES = (labels: [string, string][]) => labels.map(([label, color]) => ({ label, color }));

const clientSection = {
  id: "sec_job_basic",
  title: "Client Info",
  description: "Contact details for communication.",
  icon: "ph-user-circle",
  fields: [
    { id: "fld_b_client", name: "Client Name / Company", type: "SINGLE_LINE", mandatory: true, role: "customer" as const, placeholder: "e.g. Rahul Sharma" },
    { id: "fld_b_phone", name: "Phone Number", type: "PHONE", mandatory: true, role: "phone" as const, validation: { pattern: "phone" as const } },
    { id: "fld_b_email", name: "Email Address", type: "EMAIL", mandatory: false, role: "email" as const, validation: { pattern: "email" as const } },
  ],
};

const financialSection = {
  id: "sec_job_financial",
  title: "Financials",
  description: "Package value, advance paid, and calculated remainder.",
  icon: "ph-currency-inr",
  fields: [
    { id: "fld_b_package", name: "Total Amount (₹)", type: "CURRENCY", mandatory: true, role: "total" as const },
    { id: "fld_b_discount", name: "Discount (₹)", type: "CURRENCY", mandatory: false, role: "discount" as const },
    { id: "fld_b_advance", name: "Advance Paid (₹)", type: "CURRENCY", mandatory: false, role: "advance" as const },
  ],
};

const dateFields = [
  { id: "fld_b_date", name: "Order Date", type: "DATE", mandatory: true, role: "orderDate" as const, isRepeatableField: false, isRecordDate: true, defaultValue: "@today" },
  { id: "fld_due_date", name: "Due date", type: "DATE", mandatory: true, role: "dueDate" as const, isRepeatableField: false },
];

const statusField = (stages: [string, string][]) => ({
  id: "fld_b_status",
  name: "Status",
  type: "STATUS_PICKER",
  mandatory: false,
  role: "status" as const,
  isRepeatableField: false,
  statusOptions: STAGES(stages),
});

const printShopStandard = DEFAULT_LAYOUTS.find((l) => l.formKey === "JOB_FORM")!.schema as unknown as FormSchema;

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: "job-standard",
    formKey: "JOB_FORM",
    name: "Print shop · standard",
    description: "The built-in form: client, job details, specifications and financials.",
    highlights: ["Client, job, specs, money", "One job per form", "Good starting point"],
    schema: printShopStandard,
  },
  {
    id: "job-large-format",
    formKey: "JOB_FORM",
    name: "Large format · flex & signage",
    description: "Per-job cards with size in feet or square feet, finishing options and a printing-floor status flow.",
    highlights: ["Each Job Details card becomes its own job", "Size with ft / in / sqft units", "Finishing: eyelets, pasting, frame"],
    schema: {
      sections: [
        clientSection,
        {
          id: "sec_job_event",
          title: "Job Details",
          description: "One card per job; each gets its own dates, item and people.",
          icon: "ph-printer",
          isRepeatable: true,
          fields: [
            ...dateFields,
            { id: "fld_b_job_category", name: "Job Category", type: "PICK_LIST", mandatory: true, role: "category" as const, options: ["Flex Printing", "Vinyl Printing", "Lighting Board", "LED Lighting Board", "Standee", "Banner"] },
            { id: "fld_size", name: "Size", type: "SIZE", mandatory: true, role: "size" as const, sizeUnits: ["ft", "in", "sqft"], defaultUnit: "ft", placeholder: "e.g. 10 x 6" },
            { id: "fld_qty", name: "Quantity", type: "NUMBER", mandatory: true, role: "quantity" as const, defaultValue: "1", validation: { min: 1 } },
            { id: "fld_finishing", name: "Finishing", type: "MULTI_SELECT", mandatory: false, options: ["Eyelets", "Pasting", "Frame", "Pole pockets", "None"] },
            { id: "fld_artwork", name: "Artwork", type: "FILE", mandatory: false },
            statusField([["Pending", "bg-red-500"], ["Designing", "bg-yellow-500"], ["Printing", "bg-blue-500"], ["Finishing", "bg-violet-500"], ["Ready for Delivery", "bg-emerald-500"], ["Delivered", "bg-slate-500"], ["Cancelled", "bg-gray-500"]]),
          ],
        },
        financialSection,
      ],
    },
  },
  {
    id: "job-offset",
    formKey: "JOB_FORM",
    name: "Offset & stationery",
    description: "Cards, invitations and brochures: paper, GSM, lamination and sizes in inches or millimetres.",
    highlights: ["Paper type and GSM per job", "Size in in / cm / mm", "Proofing stage before print"],
    schema: {
      sections: [
        clientSection,
        {
          id: "sec_job_event",
          title: "Job Details",
          description: "One card per job; each gets its own dates, item and people.",
          icon: "ph-printer",
          isRepeatable: true,
          fields: [
            ...dateFields,
            { id: "fld_b_job_category", name: "Job Category", type: "PICK_LIST", mandatory: true, role: "category" as const, options: ["Visiting Cards", "Invitations", "Brochures", "Letterheads", "Bill Books", "Posters", "Stickers"] },
            { id: "fld_qty", name: "Quantity", type: "NUMBER", mandatory: true, role: "quantity" as const, defaultValue: "100", validation: { min: 1 } },
            { id: "fld_size", name: "Size", type: "SIZE", mandatory: false, role: "size" as const, sizeUnits: ["in", "cm", "mm"], defaultUnit: "in", placeholder: "e.g. 3.5 x 2" },
            { id: "fld_paper", name: "Paper Type", type: "PICK_LIST", mandatory: false, options: ["Art Card", "Art Paper", "Maplitho", "Ivory", "Kraft", "Sticker"] },
            { id: "fld_gsm", name: "GSM", type: "NUMBER", mandatory: false, placeholder: "e.g. 300", validation: { min: 60, max: 450 } },
            { id: "fld_lamination", name: "Lamination", type: "PICK_LIST", mandatory: false, options: ["None", "Matte", "Glossy", "Velvet", "Spot UV"] },
            { id: "fld_artwork", name: "Artwork", type: "FILE", mandatory: false },
            statusField([["Pending", "bg-red-500"], ["Designing", "bg-yellow-500"], ["Proof Approved", "bg-cyan-500"], ["Printing", "bg-blue-500"], ["Ready for Delivery", "bg-emerald-500"], ["Delivered", "bg-slate-500"], ["Cancelled", "bg-gray-500"]]),
          ],
        },
        financialSection,
      ],
    },
  },
  {
    id: "tx-standard",
    formKey: "TRANSACTION_FORM",
    name: "Daily ledger · standard",
    description: "The built-in income / expense form.",
    highlights: ["Amount, type, date, category", "Payment mode", "Description"],
    schema: DEFAULT_LAYOUTS.find((l) => l.formKey === "TRANSACTION_FORM")!.schema as unknown as FormSchema,
  },
];

export const templatesFor = (formKey: string) => LAYOUT_TEMPLATES.filter((t) => t.formKey === formKey);
