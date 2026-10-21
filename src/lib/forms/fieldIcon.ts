/** Phosphor icon class shown inside a job-form input, guessed from the field's name and type. */
export function getFieldIcon(fieldName: string, type: string): string {
  const name = (fieldName || "").toLowerCase();
  if (name.includes("client") || name.includes("user") || name.includes("name")) return "ph-user";
  if (name.includes("phone") || name.includes("mobile")) return "ph-phone";
  if (name.includes("email") || name.includes("mail")) return "ph-envelope-simple";
  if (name.includes("date") || type === "DATE") return "ph-calendar-blank";
  if (type === "TIME") return "ph-clock";
  if (name.includes("category") || name.includes("type")) return "ph-list-dashes";
  if (name.includes("size")) return "ph-ruler";
  if (name.includes("qty") || name.includes("quantity")) return "ph-hash";
  if (name.includes("advance")) return "ph-wallet";
  if (name.includes("payment mode")) return "ph-credit-card";
  if (name.includes("discount")) return "ph-tag";
  if (type === "CURRENCY") return "ph-currency-inr";
  return "ph-text-aa";
}
