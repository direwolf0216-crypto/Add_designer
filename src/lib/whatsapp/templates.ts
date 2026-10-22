// Message templates with {placeholders}; admins edit them in Settings → WhatsApp.

export type CustomerEvent = "jobCreated" | "stageChanged" | "paymentDue";
export type StaffEvent = "assigned" | "handoff";
export type TemplateKey = CustomerEvent | StaffEvent;

export interface WhatsAppRules {
  /** Country code added to 10-digit numbers. */
  defaultCountryCode: string;
  customer: {
    jobCreated: boolean;
    /** Stage names that message the customer when a job reaches them (case-insensitive). */
    stages: string[];
    /** Send the payment reminder when an invoice is generated with a balance due. */
    paymentDueOnInvoice: boolean;
  };
  staff: {
    assigned: boolean;
    handoff: boolean;
  };
  templates: Record<TemplateKey, string>;
}

export const PLACEHOLDERS: { key: string; meaning: string }[] = [
  { key: "{customer}", meaning: "Customer name" },
  { key: "{job}", meaning: "Job number" },
  { key: "{category}", meaning: "Job category" },
  { key: "{status}", meaning: "Current stage" },
  { key: "{due}", meaning: "Due date" },
  { key: "{total}", meaning: "Total amount" },
  { key: "{paid}", meaning: "Amount paid" },
  { key: "{balance}", meaning: "Balance due" },
  { key: "{upi}", meaning: "Shop UPI ID" },
  { key: "{shop}", meaning: "Shop name" },
  { key: "{phone}", meaning: "Shop phone" },
  { key: "{staff}", meaning: "Staff member's name" },
  { key: "{actor}", meaning: "Who made the change" },
  { key: "{team}", meaning: "Team name" },
  { key: "{link}", meaning: "Link to the job (staff only)" },
];

export const DEFAULT_RULES: WhatsAppRules = {
  defaultCountryCode: "91",
  customer: { jobCreated: true, stages: ["Ready for Delivery", "Delivered"], paymentDueOnInvoice: true },
  staff: { assigned: true, handoff: true },
  templates: {
    jobCreated: "Hi {customer}, thank you for your order with {shop}. Job {job} ({category}) is confirmed and due on {due}. Total {total}, paid {paid}, balance {balance}. We'll keep you posted.",
    stageChanged: "Hi {customer}, an update on job {job}: it is now {status}. Call {phone} if you have any questions. — {shop}",
    paymentDue: "Hi {customer}, a gentle reminder from {shop}: job {job} has a balance of {balance} (total {total}, paid {paid}). You can pay by UPI to {upi}. Thank you!",
    assigned: "Hi {staff}, {actor} assigned you job {job} ({customer}). Due {due}. {link}",
    handoff: "Hi {staff}, job {job} ({customer}) moved to {status} and is waiting in the {team} queue. {link}",
  },
};

/** Fills {placeholders}; unknown ones are left as typed so a typo is visible in the log. */
export function renderTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, key: string) => {
    const v = vars[key];
    return v === undefined || v === null || v === "" ? (key in vars ? "" : match) : String(v);
  }).replace(/[ \t]{2,}/g, " ").trim();
}

/** Merges saved rules over the defaults so new keys always have a value. */
export function mergeRules(saved: unknown): WhatsAppRules {
  const s = (saved && typeof saved === "object" ? saved : {}) as Partial<WhatsAppRules>;
  return {
    defaultCountryCode: typeof s.defaultCountryCode === "string" && /^\d{1,4}$/.test(s.defaultCountryCode) ? s.defaultCountryCode : DEFAULT_RULES.defaultCountryCode,
    customer: { ...DEFAULT_RULES.customer, ...(s.customer ?? {}) },
    staff: { ...DEFAULT_RULES.staff, ...(s.staff ?? {}) },
    templates: { ...DEFAULT_RULES.templates, ...(s.templates ?? {}) },
  };
}
