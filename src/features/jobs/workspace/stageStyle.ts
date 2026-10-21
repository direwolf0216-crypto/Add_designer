// Stage colours come from the job layout as Tailwind class names (stored data, so Tailwind never sees
// them at build time). Map them to concrete colours and style inline.
const HEX: Record<string, string> = {
  red: "#ef4444", rose: "#f43f5e", orange: "#f97316", amber: "#f59e0b", yellow: "#eab308", lime: "#84cc16",
  green: "#22c55e", emerald: "#10b981", teal: "#14b8a6", cyan: "#06b6d4", sky: "#0ea5e9", blue: "#3b82f6",
  indigo: "#6366f1", violet: "#8b5cf6", purple: "#a855f7", fuchsia: "#d946ef", pink: "#ec4899",
  slate: "#64748b", gray: "#6b7280", zinc: "#71717a", neutral: "#737373", stone: "#78716c",
};

export function stageHex(colorClass: string | undefined): string {
  if (colorClass?.startsWith("#")) return colorClass;
  const m = /(?:bg|text)-([a-z]+)-\d{2,3}/.exec(colorClass ?? "");
  return (m && HEX[m[1]]) || "#64748b";
}

/** Icon per common stage name (falls back to a generic dot). */
export function stageIcon(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("pend")) return "ph-hourglass-medium";
  if (l.includes("design") && l.includes("complet")) return "ph-check-square-offset";
  if (l.includes("design")) return "ph-paint-brush";
  if (l.includes("print")) return "ph-printer";
  if (l.includes("finish") || l.includes("bind")) return "ph-book-bookmark";
  if (l.includes("ready")) return "ph-package";
  if (l.includes("deliver")) return "ph-check-circle";
  if (l.includes("cancel")) return "ph-x-circle";
  return "ph-circle";
}
