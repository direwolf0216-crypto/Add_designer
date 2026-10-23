import { formatCompactINR, formatINR } from "@/lib/money";

/**
 * Currency amount that switches to the compact form (₹6.01 Cr) when the full value would be longer than
 * `maxChars`; only then does it carry the full value as a tooltip.
 */
export default function Amount({ value, maxChars = 11, className = "" }: { value: number; maxChars?: number; className?: string }) {
  const full = formatINR(value);
  const text = full.length > maxChars ? formatCompactINR(value) : full;
  return (
    <span className={`tabular-nums ${className}`} title={text === full ? undefined : full}>
      {text}
    </span>
  );
}
