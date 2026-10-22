// Phone numbers as the gateway wants them: international digits with no "+", e.g. 917373787172.

/** Digits only, with the default country code (India) added to 10-digit local numbers; null when unusable. */
export function normalizePhone(raw: unknown, defaultCountryCode = "91"): string | null {
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

/** The gateway's chat id for an individual number. */
export const chatIdFor = (phone: string) => `${phone}@c.us`;

/** Phone digits from a chat id or sender id the gateway reports ("917373787172@c.us" → "917373787172"). */
export const phoneFromChatId = (chatId: unknown) => (typeof chatId === "string" ? chatId.split("@")[0].replace(/\D/g, "") || null : null);
