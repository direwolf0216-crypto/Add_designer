import "server-only";
import prisma from "@/lib/prisma";
import { BUSINESS_DETAILS } from "@/lib/constants";

export type LegalBusiness = { name: string; address: string; phone: string; email: string; website: string };

const KEYS = ["business_name", "business_address", "business_phone", "business_email", "business_website"] as const;

/** The shop's details for the legal pages: Settings → Business & Invoice, falling back to the built-in defaults. */
export async function getLegalBusiness(): Promise<LegalBusiness> {
  const saved: Record<string, string> = {};
  try {
    const rows = await prisma.systemSetting.findMany({ where: { key: { in: [...KEYS] } } });
    for (const r of rows) if (typeof r.value === "string" && r.value.trim()) saved[r.key] = r.value.trim();
  } catch {
    // No database (e.g. during a static build): the defaults below still render a complete page.
  }
  return {
    name: saved.business_name || BUSINESS_DETAILS.name,
    address: saved.business_address || BUSINESS_DETAILS.address,
    phone: saved.business_phone || BUSINESS_DETAILS.phone,
    email: saved.business_email || BUSINESS_DETAILS.email,
    website: saved.business_website || "",
  };
}
