/** Phosphor icon class shown inside a job-form input, guessed from the field's name and type. */
const ROLE_ICONS: Record<string, string> = {
  customer: "ph-user", phone: "ph-phone", email: "ph-envelope-simple", orderDate: "ph-calendar-blank", dueDate: "ph-calendar-check",
  category: "ph-list-dashes", size: "ph-ruler", quantity: "ph-hash", status: "ph-palette", total: "ph-currency-inr", advance: "ph-wallet", discount: "ph-tag",
};

export function getFieldIcon(fieldName: string, type: string, role?: string): string {
  if (role && ROLE_ICONS[role]) return ROLE_ICONS[role];
  const name = (fieldName || "").toLowerCase();
  if (name.includes("client") || name.includes("user") || name.includes("name")) return "ph-user";
  if (name.includes("phone") || name.includes("mobile")) return "ph-phone";
  if (name.includes("email") || name.includes("mail")) return "ph-envelope-simple";
  if (name.includes("date") || type === "DATE") return "ph-calendar-blank";
  if (type === "TIME") return "ph-clock";
  if (name.includes("category") || name.includes("type")) return "ph-list-dashes";
  if (type === "SIZE" || name.includes("size")) return "ph-ruler";
  if (name.includes("qty") || name.includes("quantity")) return "ph-hash";
  if (name.includes("advance")) return "ph-wallet";
  if (name.includes("payment mode")) return "ph-credit-card";
  if (name.includes("discount")) return "ph-tag";
  if (type === "CURRENCY") return "ph-currency-inr";
  return "ph-text-aa";
}
