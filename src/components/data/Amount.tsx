import { formatCompactINR, formatINR } from "@/lib/money";

/**
 * Currency amount that switches to the compact form (₹6.01 Cr) when the full value would be longer than
 * `maxChars`; the full value is always available as the tooltip.
 */
export default function Amount({ value, maxChars = 11, className = "" }: { value: number; maxChars?: number; className?: string }) {
  const full = formatINR(value);
  const text = full.length > maxChars ? formatCompactINR(value) : full;
  return (
    <span className={`tabular-nums ${className}`} title={full}>
      {text}
    </span>
  );
}
