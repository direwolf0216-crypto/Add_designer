import { describe, expect, it } from "vitest";
import { SHARE_DAYS, signInvoiceToken, verifyInvoiceToken } from "../shareLink";

const SECRET = "test-secret-123";
const ID = "cmvkigk1h000ixqrtax7hdqii";
const NOW = Date.UTC(2026, 9, 23);
const DAY = 86_400_000;

describe("signed invoice links", () => {
  it("opens the invoice it was made for until it expires", () => {
    const t = signInvoiceToken(ID, SECRET, NOW);
    expect(verifyInvoiceToken(t, SECRET, NOW)).toBe(ID);
    expect(verifyInvoiceToken(t, SECRET, NOW + (SHARE_DAYS - 1) * DAY)).toBe(ID);
    expect(verifyInvoiceToken(t, SECRET, NOW + (SHARE_DAYS + 1) * DAY)).toBeNull();
  });

  it("can't be pointed at another invoice, extended or forged", () => {
    const [id, exp, sig] = signInvoiceToken(ID, SECRET, NOW).split(".");
    expect(verifyInvoiceToken(`cmvkigk1h000ixqrtax7hdqij.${exp}.${sig}`, SECRET, NOW)).toBeNull();
    expect(verifyInvoiceToken(`${id}.${(parseInt(exp, 36) + 9_999_999).toString(36)}.${sig}`, SECRET, NOW)).toBeNull();
    expect(verifyInvoiceToken(`${id}.${exp}.${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`, SECRET, NOW)).toBeNull();
    expect(verifyInvoiceToken(signInvoiceToken(ID, "another-secret", NOW), SECRET, NOW)).toBeNull();
  });

  it.each([undefined, null, "", "abc", `${ID}..`, `${ID}.zz.short`, "a".repeat(200), `../../etc.${"x".repeat(5)}.${"y".repeat(32)}`, 42])("rejects malformed token %j", (bad) => {
    expect(verifyInvoiceToken(bad, SECRET, NOW)).toBeNull();
  });

  it("refuses to sign or verify without a secret", () => {
    expect(() => signInvoiceToken(ID, "", NOW)).toThrow();
    expect(verifyInvoiceToken(signInvoiceToken(ID, SECRET, NOW), "", NOW)).toBeNull();
  });
});
