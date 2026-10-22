"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import type { PricingRules } from "@/lib/jobs/pricing";

/** Per-category pricing rules from Settings → Pricing (shares the system settings request). */
export function usePricingRules(): PricingRules {
  const { data } = useSWR<{ pricing_rules?: PricingRules }>("/api/settings/system", fetcher, { revalidateOnFocus: false });
  return data?.pricing_rules ?? {};
}
