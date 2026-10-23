import { z } from "zod";
import { PRICING_UNITS } from "./pricing";

/** What Settings → Pricing may save: per category, a known unit, an optional non-negative default rate and the Size-field unit it was picked as. */
export const pricingRulesSchema = z.record(
  z.string().trim().min(1).max(100),
  z.object({ unit: z.enum(PRICING_UNITS), defaultRate: z.number().nonnegative().max(10_000_000).optional(), sizeUnit: z.string().trim().min(1).max(8).optional() })
);
