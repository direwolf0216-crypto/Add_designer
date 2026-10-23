// Signed links that let a customer open their invoice PDF without an account. The token carries the
// invoice id and an expiry, signed with the app's secret, so it can't be guessed, edited or reused for
// another invoice. Deleting the invoice also turns the link off.
import { createHmac, timingSafeEqual } from "node:crypto";

/** How long a shared invoice link works. */
export const SHARE_DAYS = 90;

const sign = (secret: string, invoiceId: string, exp: string) =>
  createHmac("sha256", secret).update(`invoice:${invoiceId}:${exp}`).digest("base64url").slice(0, 32);

/** "<invoiceId>.<expiry, base 36 seconds>.<signature>" */
export function signInvoiceToken(invoiceId: string, secret: string, now = Date.now(), days = SHARE_DAYS): string {
  if (!secret) throw new Error("No secret to sign invoice links with");
  const exp = Math.floor((now + days * 86_400_000) / 1000).toString(36);
  return `${invoiceId}.${exp}.${sign(secret, invoiceId, exp)}`;
}

/** The invoice id when the token is genuine and unexpired, else null. */
export function verifyInvoiceToken(token: unknown, secret: string, now = Date.now()): string | null {
  if (typeof token !== "string" || !secret || token.length > 120) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [invoiceId, exp, sig] = parts;
  if (!/^[a-z0-9]{10,40}$/i.test(invoiceId) || !/^[0-9a-z]{1,10}$/.test(exp) || !/^[\w-]{32}$/.test(sig)) return null;
  const expMs = parseInt(exp, 36) * 1000;
  if (!Number.isFinite(expMs) || expMs < now) return null;
  const want = Buffer.from(sign(secret, invoiceId, exp));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? invoiceId : null;
}

/** The secret links are signed with: a dedicated one when set, else the session secret. */
export const invoiceLinkSecret = () => process.env.INVOICE_LINK_SECRET || process.env.NEXTAUTH_SECRET || "";
