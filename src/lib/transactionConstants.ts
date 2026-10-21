// Central source of truth for transaction categories and payment modes.
// Import from here everywhere — never hardcode inline.

export const TRANSACTION_CATEGORIES = [
  "Printing Job",
  "Paper Purchase",
  "Ink/Toner",
  "Maintenance",
  "Equipment",
  "Utilities",
  "Rent",
  "Software",
  "Travel",
  "Marketing",
  "Misc",
  "Printout",
  "Xerox",
  "PP",
  "Others",
  "Chit fund",
  "Tea & snacks",
  "Salary",
  "Bus fare",
  "E-Sevai",
  "Passport Photo",
  "Frame Sales",
  "Design Charges",
  "Binding & Finishing"
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export const PAYMENT_MODES = [
  "UPI",
  "Cash",
  "Bank Transfer",
  "Card",
] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number];
