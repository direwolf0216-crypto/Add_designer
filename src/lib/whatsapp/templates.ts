// Ready-made WhatsApp messages for a job's customer, with {placeholders}. Staff pick one in the job's
// "Chat on WhatsApp" dialog, can edit it, and send it from the shop's own WhatsApp (click-to-chat).

export type ChatMessageKind = "stageChanged" | "paymentDue" | "jobCreated" | "jobCreatedNoAmounts" | "invoice" | "invoicePaid";

export const CHAT_TEMPLATES: Record<ChatMessageKind, string> = {
  stageChanged: "Hi {customer}, an update on job {job}: it is now {status}. Call {phone} if you have any questions. — {shop}",
  paymentDue: "Hi {customer}, a gentle reminder from {shop}: job {job} has a balance of {balance} (total {total}, paid {paid}). You can pay by UPI to {upi}. Thank you!",
  jobCreated: "Hi {customer}, thank you for your order with {shop}. Job {job} ({category}) is confirmed and due on {due}. Total {total}, paid {paid}, balance {balance}. We'll keep you posted.",
  // For staff who can't see amounts: the same confirmation without any money in it.
  jobCreatedNoAmounts: "Hi {customer}, thank you for your order with {shop}. Job {job} ({category}) is confirmed and due on {due}. We'll keep you posted.",
  // {link} opens the invoice PDF without an account (a signed link that expires).
  invoice: "Hi {customer}, here is your invoice {invoice} from {shop} for job {job}:\n{link}\nTotal {total}, paid {paid}, balance {balance}. You can pay by UPI to {upi}. Thank you!",
  invoicePaid: "Hi {customer}, here is your invoice {invoice} from {shop} for job {job}:\n{link}\nTotal {total}, fully paid. Thank you for your business!",
};

/** Fills {placeholders}; unknown ones are left as typed so a typo is visible before sending. */
export function renderTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template
    .replace(/\{([a-zA-Z]+)\}/g, (match, key: string) => {
      const v = vars[key];
      return v === undefined || v === null || v === "" ? (key in vars ? "" : match) : String(v);
    })
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Sentences that only make sense with a value, dropped when the shop hasn't set it. */
const NEEDS: Record<string, string[]> = {
  upi: [" You can pay by UPI to {upi}."],
  phone: [" Call {phone} if you have any questions."],
};

/** The template with the sentences for missing values (no UPI ID, no shop phone) taken out. */
export function withoutMissing(template: string, vars: Record<string, string | number | null | undefined>): string {
  let out = template;
  for (const [key, sentences] of Object.entries(NEEDS)) {
    if (vars[key] === undefined || vars[key] === null || vars[key] === "") for (const sentence of sentences) out = out.replace(sentence, "");
  }
  return out;
}
