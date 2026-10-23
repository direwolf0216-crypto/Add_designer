// Phone numbers and chat links for WhatsApp click-to-chat (wa.me), which opens the chat in the
// shop's own WhatsApp with the message typed in, ready to send.

/** Country code added to 10-digit local numbers. */
export const DEFAULT_COUNTRY_CODE = "91";

/** International digits with no "+" (e.g. 917373787172), the default country code added to local numbers; null when unusable. */
export function normalizePhone(raw: unknown, defaultCountryCode = DEFAULT_COUNTRY_CODE): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  // A local number: strip a leading trunk 0, then add the country code.
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `${defaultCountryCode}${digits}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

/** "917373787172" → "+91 73737 87172" for display (other countries just get a leading +). */
export function formatPhone(digits: string): string {
  return digits.startsWith("91") && digits.length === 12 ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}` : `+${digits}`;
}

/** The wa.me link that opens a chat with `phone` (normalised digits), with `text` typed in. */
export function waChatUrl(phone: string, text = ""): string {
  const body = text.trim();
  return `https://wa.me/${phone}${body ? `?text=${encodeURIComponent(body)}` : ""}`;
}
